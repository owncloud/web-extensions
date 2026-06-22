const SUPPORTED = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

export function isSupportedImage(resource: { extension?: string } | undefined): boolean {
  if (!resource?.extension) return false
  return SUPPORTED.has(resource.extension.toLowerCase())
}
