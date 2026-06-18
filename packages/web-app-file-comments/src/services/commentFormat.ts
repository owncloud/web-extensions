import { dump, load } from 'js-yaml'

export interface CommentMetadata {
  version: 1
  authorId: string
  authorName: string
  createdAt: string
  updatedAt?: string
}

export interface FileComment extends CommentMetadata {
  id: string
  sequence: number
  body: string
}

const FRONT_MATTER_BOUNDARY = '---'

export const serializeComment = (comment: CommentMetadata, body: string): string => {
  const metadata = dump(comment, { lineWidth: -1, noRefs: true, sortKeys: true }).trimEnd()
  return `${FRONT_MATTER_BOUNDARY}\n${metadata}\n${FRONT_MATTER_BOUNDARY}\n\n${body.trim()}\n`
}

export const parseComment = (value: string, sequence: number): FileComment => {
  if (!value.startsWith(`${FRONT_MATTER_BOUNDARY}\n`)) {
    throw new Error('Comment metadata is missing')
  }

  const closingBoundary = value.indexOf(`\n${FRONT_MATTER_BOUNDARY}\n`, 4)
  if (closingBoundary < 0) {
    throw new Error('Comment metadata is malformed')
  }

  const rawMetadata = value.slice(4, closingBoundary)
  const metadata = load(rawMetadata) as Partial<CommentMetadata> | null
  const body = value.slice(closingBoundary + 5).trim()

  if (
    metadata?.version !== 1 ||
    typeof metadata.authorId !== 'string' ||
    typeof metadata.authorName !== 'string' ||
    typeof metadata.createdAt !== 'string' ||
    !body
  ) {
    throw new Error('Comment metadata is incomplete')
  }

  return {
    id: `comment-${String(sequence).padStart(6, '0')}`,
    sequence,
    version: 1,
    authorId: metadata.authorId,
    authorName: metadata.authorName,
    createdAt: metadata.createdAt,
    updatedAt: typeof metadata.updatedAt === 'string' ? metadata.updatedAt : undefined,
    body
  }
}
