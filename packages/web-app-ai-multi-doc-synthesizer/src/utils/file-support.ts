export interface FileResourceLike {
  extension?: string
}

const SUPPORTED_EXTENSIONS = ['txt', 'md']

export function isSupportedFile(
  resource: FileResourceLike | undefined,
  supported: string[] = SUPPORTED_EXTENSIONS
): boolean {
  if (!resource?.extension) {
    return false
  }
  return supported.includes(resource.extension.toLowerCase())
}
