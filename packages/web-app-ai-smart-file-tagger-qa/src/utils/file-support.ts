export interface FileResourceLike {
  extension?: string
  mimeType?: string
}

const CONTENT_EXTRACTION_EXTS = new Set(['txt', 'md', 'pdf'])

export function isSupportedForContentExtraction(resource: FileResourceLike | undefined): boolean {
  if (!resource?.extension) return false
  return CONTENT_EXTRACTION_EXTS.has(resource.extension.toLowerCase())
}

export function getFileMimeType(resource: FileResourceLike): string {
  if (resource.mimeType) return resource.mimeType
  const ext = resource.extension?.toLowerCase() ?? ''
  const mimeTypes: Record<string, string> = {
    txt: 'text/plain',
    md: 'text/markdown',
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip',
    json: 'application/json',
    xml: 'application/xml',
    csv: 'text/csv'
  }
  return mimeTypes[ext] ?? 'application/octet-stream'
}
