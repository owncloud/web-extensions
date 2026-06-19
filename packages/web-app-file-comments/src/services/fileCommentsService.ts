import type { Resource } from '@ownclouders/web-client'
import { parseComment, serializeComment, type FileComment } from './commentFormat'

export const COMMENTS_NAMESPACE = 'urn:owncloud:file-comments'
// `count` is a monotonic high-water allocator: it only ever grows, so a deleted
// comment's sequence number is never reused and stays a stable id. `index`
// holds the sequence numbers that are currently live. Keeping them separate
// means list() fetches only existing comments (not every slot 1..count) and a
// file with a long add/delete history neither bloats the PROPFIND body nor
// locks out new comments once the high-water mark is large.
const COUNT_PROPERTY = 'count'
const INDEX_PROPERTY = 'index'
const MAX_COMMENTS = 10_000 // upper bound on *live* comments per resource
const MAX_SEQUENCE = 999_999 // structural limit from the 6-digit propertyName() padding

const parseIndex = (value: string | undefined): number[] => {
  if (!value) {
    return []
  }
  const sequences = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number.parseInt(part, 10))
  const invalid = sequences.some(
    (sequence) => !Number.isSafeInteger(sequence) || sequence < 1 || sequence > MAX_SEQUENCE
  )
  if (invalid || sequences.length > MAX_COMMENTS) {
    throw new Error('The stored comment index is invalid')
  }
  return sequences
}

// A LOCK can momentarily fail when another collaborator holds the write lock
// while allocating their own comment sequence. Retry a few times with a short
// linear backoff before surfacing the failure to the user.
const DEFAULT_LOCK_ATTEMPTS = 3
const DEFAULT_LOCK_RETRY_DELAY_MS = 150

const delay = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()

interface DavResponse {
  data: unknown
  headers: Record<string, string | undefined>
}

export interface DavHttpClient {
  request(config: Record<string, unknown>): Promise<DavResponse>
}

export interface CommentAuthor {
  id: string
  name: string
}

const propertyName = (sequence: number): string =>
  `comment-${String(sequence).padStart(6, '0')}`

const davUrl = (resource: Resource): string => {
  if (!resource.webDavPath) {
    throw new Error('The selected file has no WebDAV path')
  }
  return resource.webDavPath.startsWith('/dav/')
    ? resource.webDavPath
    : `/dav${resource.webDavPath}`
}

const createXmlDocument = (rootName: string): XMLDocument => {
  return document.implementation.createDocument('DAV:', `d:${rootName}`, null)
}

const appendElement = (
  documentNode: XMLDocument,
  parent: Element,
  namespace: string,
  qualifiedName: string,
  value?: string
): Element => {
  const element = documentNode.createElementNS(namespace, qualifiedName)
  if (value !== undefined) {
    element.textContent = value
  }
  parent.appendChild(element)
  return element
}

const serializeXml = (documentNode: XMLDocument): string =>
  `<?xml version="1.0" encoding="UTF-8"?>${new XMLSerializer().serializeToString(documentNode)}`

const buildPropfindBody = (properties: string[]): string => {
  const documentNode = createXmlDocument('propfind')
  const root = documentNode.documentElement
  const prop = appendElement(documentNode, root, 'DAV:', 'd:prop')
  properties.forEach((name) => appendElement(documentNode, prop, COMMENTS_NAMESPACE, `fc:${name}`))
  return serializeXml(documentNode)
}

const buildProppatchBody = ({
  set = {},
  remove = []
}: {
  set?: Record<string, string>
  remove?: string[]
}): string => {
  const documentNode = createXmlDocument('propertyupdate')
  const root = documentNode.documentElement

  if (Object.keys(set).length) {
    const setElement = appendElement(documentNode, root, 'DAV:', 'd:set')
    const prop = appendElement(documentNode, setElement, 'DAV:', 'd:prop')
    Object.entries(set).forEach(([name, value]) =>
      appendElement(documentNode, prop, COMMENTS_NAMESPACE, `fc:${name}`, value)
    )
  }

  if (remove.length) {
    const removeElement = appendElement(documentNode, root, 'DAV:', 'd:remove')
    const prop = appendElement(documentNode, removeElement, 'DAV:', 'd:prop')
    remove.forEach((name) => appendElement(documentNode, prop, COMMENTS_NAMESPACE, `fc:${name}`))
  }

  return serializeXml(documentNode)
}

const parseXml = (value: unknown): XMLDocument => {
  if (typeof value !== 'string') {
    throw new Error('The WebDAV server returned an invalid XML response')
  }

  const result = new DOMParser().parseFromString(value, 'application/xml')
  if (result.querySelector('parsererror')) {
    throw new Error('The WebDAV server returned malformed XML')
  }
  return result
}

// Note: getElementsByTagNameNS() would be the native equivalent, but happy-dom
// (the unit-test DOM) does not implement its namespace matching, so we filter
// getElementsByTagName('*') by namespace/localName for portability. The scan is
// negligible now that list() only fetches the live comment slots.
const findElements = (parent: Document | Element, namespace: string, localName: string) =>
  Array.from(parent.getElementsByTagName('*')).filter(
    (element) => element.namespaceURI === namespace && element.localName === localName
  )

const parseSuccessfulProperties = (value: unknown): Map<string, string> => {
  const result = new Map<string, string>()
  const documentNode = parseXml(value)

  findElements(documentNode, 'DAV:', 'propstat').forEach((propstat) => {
    const status = findElements(propstat, 'DAV:', 'status')[0]?.textContent ?? ''
    if (!status.includes(' 200 ')) {
      return
    }

    const prop = findElements(propstat, 'DAV:', 'prop')[0]
    Array.from(prop?.children ?? []).forEach((element) => {
      if (element.namespaceURI === COMMENTS_NAMESPACE) {
        result.set(element.localName, element.textContent ?? '')
      }
    })
  })

  return result
}

const assertProppatchSucceeded = (value: unknown): void => {
  const documentNode = parseXml(value)
  const failures = findElements(documentNode, 'DAV:', 'propstat').filter((propstat) => {
    const status = findElements(propstat, 'DAV:', 'status')[0]?.textContent ?? ''
    return !status.includes(' 200 ')
  })

  if (failures.length) {
    throw new Error('The WebDAV server rejected the comment update')
  }
}

export class FileCommentsService {
  constructor(
    private readonly http: DavHttpClient,
    private readonly lockRetry: { attempts?: number; delayMs?: number } = {}
  ) {}

  async list(resource: Resource): Promise<FileComment[]> {
    const indexResult = await this.propfind(resource, [INDEX_PROPERTY])
    const sequences = parseIndex(indexResult.get(INDEX_PROPERTY))
    if (sequences.length === 0) {
      return []
    }

    // Fetch only the live slots, never the full 1..count range.
    const values = await this.propfind(
      resource,
      sequences.map((sequence) => propertyName(sequence))
    )
    const comments: FileComment[] = []

    sequences.forEach((sequence) => {
      const value = values.get(propertyName(sequence))
      if (!value) {
        return
      }
      try {
        comments.push(parseComment(value, sequence))
      } catch {
        // Keep one malformed property from hiding the rest of the conversation.
      }
    })

    return comments
  }

  add(resource: Resource, body: string, author: CommentAuthor): Promise<FileComment> {
    return this.withLock(resource, async (lockToken) => {
      const state = await this.propfind(resource, [COUNT_PROPERTY, INDEX_PROPERTY])
      const highWater = Number.parseInt(state.get(COUNT_PROPERTY) || '0', 10)
      if (!Number.isSafeInteger(highWater) || highWater < 0 || highWater > MAX_SEQUENCE) {
        throw new Error('The stored comment count is invalid')
      }
      // Bound the number of *live* comments, not the all-time allocator, so
      // deleting comments always frees capacity for new ones.
      const sequences = parseIndex(state.get(INDEX_PROPERTY))
      const sequence = highWater + 1
      if (sequences.length >= MAX_COMMENTS || sequence > MAX_SEQUENCE) {
        throw new Error('This item has reached the maximum number of comments')
      }

      const createdAt = new Date().toISOString()
      const metadata = {
        version: 1 as const,
        authorId: author.id,
        authorName: author.name,
        createdAt
      }
      await this.proppatch(
        resource,
        {
          set: {
            [propertyName(sequence)]: serializeComment(metadata, body),
            [COUNT_PROPERTY]: String(sequence),
            [INDEX_PROPERTY]: [...sequences, sequence].join(',')
          }
        },
        lockToken
      )

      return { id: propertyName(sequence), sequence, body: body.trim(), ...metadata }
    })
  }

  async update(resource: Resource, comment: FileComment, body: string): Promise<FileComment> {
    const updatedAt = new Date().toISOString()
    const updatedComment = { ...comment, body: body.trim(), updatedAt }
    const metadata = {
      version: 1 as const,
      authorId: comment.authorId,
      authorName: comment.authorName,
      createdAt: comment.createdAt,
      updatedAt
    }
    await this.withLock(resource, (lockToken) =>
      this.proppatch(
        resource,
        {
          set: {
            [propertyName(comment.sequence)]: serializeComment(metadata, updatedComment.body)
          }
        },
        lockToken
      )
    )
    return updatedComment
  }

  async remove(resource: Resource, comment: FileComment): Promise<void> {
    await this.withLock(resource, async (lockToken) => {
      const indexResult = await this.propfind(resource, [INDEX_PROPERTY])
      const sequences = parseIndex(indexResult.get(INDEX_PROPERTY)).filter(
        (sequence) => sequence !== comment.sequence
      )
      // Drop the slot from the live index and delete the property in one patch.
      // `count` is intentionally left untouched so sequence numbers are never reused.
      await this.proppatch(
        resource,
        {
          set: { [INDEX_PROPERTY]: sequences.join(',') },
          remove: [propertyName(comment.sequence)]
        },
        lockToken
      )
    })
  }

  private async propfind(resource: Resource, properties: string[]): Promise<Map<string, string>> {
    const response = await this.http.request({
      method: 'PROPFIND',
      url: davUrl(resource),
      data: buildPropfindBody(properties),
      headers: {
        Depth: '0',
        'Content-Type': 'application/xml; charset=utf-8'
      },
      responseType: 'text'
    })
    return parseSuccessfulProperties(response.data)
  }

  private async proppatch(
    resource: Resource,
    change: { set?: Record<string, string>; remove?: string[] },
    lockToken: string
  ): Promise<void> {
    const response = await this.http.request({
      method: 'PROPPATCH',
      url: davUrl(resource),
      data: buildProppatchBody(change),
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Lock-Token': lockToken
      },
      responseType: 'text'
    })
    assertProppatchSucceeded(response.data)
  }

  private async withLock<T>(resource: Resource, operation: (lockToken: string) => Promise<T>) {
    const lockToken = await this.acquireLock(resource)

    try {
      return await operation(lockToken)
    } finally {
      // Releasing the lock is best-effort: a failed UNLOCK must not mask the
      // result (or error) of the operation it protected. The server-side lock
      // expires on its own via the LOCK Timeout if this request is lost.
      try {
        await this.http.request({
          method: 'UNLOCK',
          url: davUrl(resource),
          headers: { 'Lock-Token': lockToken }
        })
      } catch {
        // ignore — the lock timeout is the backstop
      }
    }
  }

  private async acquireLock(resource: Resource): Promise<string> {
    const attempts = Math.max(1, this.lockRetry.attempts ?? DEFAULT_LOCK_ATTEMPTS)
    const retryDelay = this.lockRetry.delayMs ?? DEFAULT_LOCK_RETRY_DELAY_MS
    let lastError: unknown = new Error('The WebDAV server did not return a lock token')

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await this.http.request({
          method: 'LOCK',
          url: davUrl(resource),
          data:
            '<?xml version="1.0" encoding="UTF-8"?>' +
            '<d:lockinfo xmlns:d="DAV:"><d:lockscope><d:exclusive/></d:lockscope>' +
            '<d:locktype><d:write/></d:locktype><d:owner>ownCloud File Comments</d:owner></d:lockinfo>',
          headers: {
            Depth: '0',
            Timeout: 'Second-15',
            'Content-Type': 'application/xml; charset=utf-8'
          },
          responseType: 'text'
        })
        const lockToken = response.headers['lock-token'] || response.headers['Lock-Token']
        if (lockToken) {
          return lockToken
        }
      } catch (cause) {
        lastError = cause
      }

      if (attempt < attempts) {
        await delay(retryDelay * attempt)
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('The WebDAV server did not return a lock token')
  }
}
