export interface FileSupportResource {
  isFolder?: boolean
  extension?: string
}

// Only short text/markdown files are sampled for LLM context — binary or
// structured formats (pdf, docx, csv, ...) are out of scope for this extension.
const SAMPLEABLE_EXTENSIONS = new Set(['txt', 'md'])

export function isFolder(resource: FileSupportResource | undefined): boolean {
  return resource?.isFolder === true
}

export function isSampleableFile(resource: FileSupportResource | undefined): boolean {
  if (!resource || resource.isFolder) {
    return false
  }
  return !!resource.extension && SAMPLEABLE_EXTENSIONS.has(resource.extension.toLowerCase())
}
