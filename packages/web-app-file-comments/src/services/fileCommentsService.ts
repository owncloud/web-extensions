import type { Resource } from '@ownclouders/web-client'
import { parseComment, serializeComment, type FileComment } from './commentFormat'

export const COMMENTS_NAMESPACE = 'urn:owncloud:file-comments'
const COUNT_PROPERTY = 'count'
const MAX_COMMENTS = 10_000

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
  constructor(private readonly http: DavHttpClient) {}

  async list(resource: Resource): Promise<FileComment[]> {
    const countResult = await this.propfind(resource, [COUNT_PROPERTY])
    const count = Number.parseInt(countResult.get(COUNT_PROPERTY) || '0', 10)
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_COMMENTS) {
      throw new Error('The stored comment count is invalid')
    }
    if (count === 0) {
      return []
    }

    const names = Array.from({ length: count }, (_, index) => propertyName(index + 1))
    const values = await this.propfind(resource, names)
    const comments: FileComment[] = []

    names.forEach((name, index) => {
      const value = values.get(name)
      if (!value) {
        return
      }
      try {
        comments.push(parseComment(value, index + 1))
      } catch {
        // Keep one malformed property from hiding the rest of the conversation.
      }
    })

    return comments
  }

  add(resource: Resource, body: string, author: CommentAuthor): Promise<FileComment> {
    return this.withLock(resource, async (lockToken) => {
      const countResult = await this.propfind(resource, [COUNT_PROPERTY])
      const currentCount = Number.parseInt(countResult.get(COUNT_PROPERTY) || '0', 10)
      if (!Number.isSafeInteger(currentCount) || currentCount < 0 || currentCount >= MAX_COMMENTS) {
        throw new Error('The stored comment count is invalid')
      }

      const sequence = currentCount + 1
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
            [COUNT_PROPERTY]: String(sequence)
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
    await this.withLock(resource, (lockToken) =>
      this.proppatch(resource, { remove: [propertyName(comment.sequence)] }, lockToken)
    )
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
    if (!lockToken) {
      throw new Error('The WebDAV server did not return a lock token')
    }

    try {
      return await operation(lockToken)
    } finally {
      await this.http.request({
        method: 'UNLOCK',
        url: davUrl(resource),
        headers: { 'Lock-Token': lockToken }
      })
    }
  }
}
