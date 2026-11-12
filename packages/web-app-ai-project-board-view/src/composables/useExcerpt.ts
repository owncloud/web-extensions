import { useClientService, useSpacesStore } from '@ownclouders/web-pkg'
import type { Resource } from '@ownclouders/web-client'

// Byte budget for the excerpt actually sent to the LLM prompt.
export const MAX_EXCERPT_BYTES = 2_000
// Files larger than this are skipped outright rather than fetched and truncated —
// mirrors useInsights' MAX_FILE_BYTES guard against buffering large files in memory.
const MAX_FETCHABLE_BYTES = 2 * 1024 * 1024

const TEXT_MIME_PREFIXES = ['text/']
const TEXT_MIME_TYPES = new Set(['application/json', 'application/xml', 'application/x-yaml'])

export type ExcerptResource = Pick<Resource, 'storageId' | 'path' | 'mimeType' | 'size' | 'isFolder'>

export interface UseExcerptResult {
  fetchExcerpt(resource: ExcerptResource): Promise<string | undefined>
}

function isTextLike(mimeType?: string): boolean {
  if (!mimeType) return false
  if (TEXT_MIME_TYPES.has(mimeType)) return true
  return TEXT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))
}

function resourceSizeBytes(size: Resource['size']): number | undefined {
  if (typeof size === 'number') return size
  if (typeof size === 'string') {
    const parsed = parseInt(size, 10)
    return isNaN(parsed) ? undefined : parsed
  }
  return undefined
}

export function useExcerpt(): UseExcerptResult {
  const clientService = useClientService()
  const spacesStore = useSpacesStore()

  async function fetchExcerpt(resource: ExcerptResource): Promise<string | undefined> {
    if (resource.isFolder) return undefined
    if (!resource.storageId || !resource.path) return undefined
    if (!isTextLike(resource.mimeType)) return undefined

    const size = resourceSizeBytes(resource.size)
    if (size !== undefined && size > MAX_FETCHABLE_BYTES) return undefined

    const space = spacesStore.getSpace(resource.storageId)
    if (!space) return undefined

    try {
      const { response } = await clientService.webdav.getFileContents(
        space,
        { path: resource.path },
        {
          responseType: 'text',
          headers: { Range: `bytes=0-${MAX_EXCERPT_BYTES - 1}` }
        }
      )
      const text = response.data as string
      return typeof text === 'string' ? text.slice(0, MAX_EXCERPT_BYTES) : undefined
    } catch {
      // Excerpt is a best-effort enrichment — a failed fetch degrades to filename-only.
      return undefined
    }
  }

  return { fetchExcerpt }
}
