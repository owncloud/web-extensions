export interface FileResourceLike {
  extension?: string
}

export function isSupportedFile(
  resource: FileResourceLike | undefined,
  supported: string[]
): boolean {
  if (!resource?.extension) return false
  return supported.includes(resource.extension.toLowerCase())
}
