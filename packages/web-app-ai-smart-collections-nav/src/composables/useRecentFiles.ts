import { ref, type Ref } from 'vue'
import { useClientService, useConfigStore, useSpacesStore } from '@ownclouders/web-pkg'
import type { SpaceResource } from '@ownclouders/web-client'
import { useGettext } from 'vue3-gettext'

// Global cap on how many recent files (across all spaces, after merge+sort) are considered.
const MAX_RECENT_FILES = 100

// Per-space REPORT limit, kept generous relative to MAX_RECENT_FILES so that a user with
// several spaces still surfaces their truly most-recent files after the client-side merge.
const MAX_FILES_PER_SPACE = 50

// Files above this size are skipped for excerpt fetching to avoid buffering large files in
// memory just to build a short prompt snippet — mirrors useInsights.ts's MAX_FILE_BYTES guard.
const MAX_FILE_BYTES = 1_000_000 // 1 MB

// Only these extensions are considered readable as plain text for excerpting. Binary formats
// (images, PDFs, office documents) are skipped outright rather than sniffed.
const TEXT_EXCERPT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'tsv',
  'json',
  'yaml',
  'yml',
  'log',
  'rtf'
])

const REQUEST_TIMEOUT_MS = 30_000

// Byte budget for the ranged excerpt fetch below — comfortably covers MAX_EXCERPT_CHARS (200,
// see useCollections.ts) worth of UTF-8 text with margin for multi-byte characters.
const EXCERPT_FETCH_BYTE_LIMIT = 1024

export interface RecentFile {
  fileId: string
  name: string
  path: string
  storageId: string
  spaceId: string
  mdate: string
  size: number
  extension?: string
  excerpt?: string
}

export interface UseRecentFilesResult {
  isLoading: Ref<boolean>
  error: Ref<string | null>
  fetchRecentFiles: () => Promise<RecentFile[]>
}

function escapeXML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

interface SpaceSearchEntry {
  fileId: string
  name: string
  path: string
  storageId: string
  spaceId: string
  mdate: string
  size: number
  extension?: string
}

/**
 * Parses a WebDAV REPORT multistatus response into flat file entries for one space.
 * Mirrors useAdvancedSearch.ts's parseSearchResponse, trimmed to the fields this
 * composable needs (no photo/EXIF properties, no Resource-shaped canX() methods).
 */
function parseSearchResponse(xmlText: string, spaceId: string): SpaceSearchEntry[] {
  const trimmed = xmlText.trim()
  if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<')) {
    throw new Error('Invalid response: expected XML but received non-XML content')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')
  const parserError = doc.querySelector('parsererror')
  const multistatus = doc.getElementsByTagNameNS('DAV:', 'multistatus')[0]

  if (parserError || !multistatus) {
    throw new Error(
      `XML parsing failed: ${parserError?.textContent?.slice(0, 100) || 'Unexpected response format (not a WebDAV multistatus)'}`
    )
  }

  const responses = doc.getElementsByTagNameNS('DAV:', 'response')
  const items: SpaceSearchEntry[] = []
  const spacePrefix = `/dav/spaces/${spaceId}`
  const encodedSpacePrefix = `/dav/spaces/${encodeURIComponent(spaceId)}`

  for (let i = 0; i < responses.length; i++) {
    const response = responses[i]
    const href = response.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent
    if (!href) continue

    const contentType =
      response.getElementsByTagNameNS('DAV:', 'getcontenttype')[0]?.textContent || ''
    const isFolder = contentType === 'httpd/unix-directory' || href.endsWith('/')
    if (isFolder) continue

    const displayname =
      response.getElementsByTagNameNS('DAV:', 'displayname')[0]?.textContent || ''
    const contentLength =
      response.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]?.textContent || '0'
    const lastModified =
      response.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]?.textContent || ''
    const fileId =
      response.getElementsByTagNameNS('http://owncloud.org/ns', 'fileid')[0]?.textContent || ''

    let path = href
    if (href.startsWith(spacePrefix)) {
      path = decodeURIComponent(href.substring(spacePrefix.length))
    } else if (href.startsWith(encodedSpacePrefix)) {
      path = decodeURIComponent(href.substring(encodedSpacePrefix.length))
    }

    const pathParts = path.split('/')
    const nameFromPath = pathParts.length > 0 ? pathParts[pathParts.length - 1] : ''
    const name = displayname || nameFromPath || 'Unknown'
    const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() : undefined

    items.push({
      fileId: fileId || `${spaceId}!${path}`,
      name,
      path,
      storageId: spaceId,
      spaceId,
      mdate: lastModified,
      size: parseInt(contentLength, 10) || 0,
      extension
    })
  }

  return items
}

export function useRecentFiles(): UseRecentFilesResult {
  const { $gettext } = useGettext()
  const clientService = useClientService()
  const configStore = useConfigStore()
  const spacesStore = useSpacesStore()

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function searchSpace(space: SpaceResource): Promise<SpaceSearchEntry[]> {
    const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
    const searchBody = `<?xml version="1.0" encoding="UTF-8"?>
<oc:search-files xmlns:oc="http://owncloud.org/ns" xmlns:d="DAV:">
  <oc:search>
    <oc:pattern>${escapeXML('*')}</oc:pattern>
    <oc:limit>${MAX_FILES_PER_SPACE}</oc:limit>
  </oc:search>
  <d:prop>
    <d:displayname/>
    <d:getcontenttype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <oc:fileid/>
  </d:prop>
</oc:search-files>`

    const response = await clientService.httpAuthenticated.request({
      method: 'REPORT',
      url: `${serverUrl}/dav/spaces/${encodeURIComponent(space.id as string)}`,
      headers: { 'Content-Type': 'application/xml' },
      data: searchBody,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    const xmlText =
      typeof response.data === 'string'
        ? response.data
        : new XMLSerializer().serializeToString(response.data)
    return parseSearchResponse(xmlText, space.id as string)
  }

  async function fetchExcerpt(
    space: SpaceResource,
    entry: SpaceSearchEntry
  ): Promise<string | undefined> {
    if (!entry.extension || !TEXT_EXCERPT_EXTENSIONS.has(entry.extension)) {
      return undefined
    }
    if (entry.size > MAX_FILE_BYTES) {
      return undefined
    }
    try {
      const { response } = await clientService.webdav.getFileContents(
        space,
        { path: entry.path },
        {
          responseType: 'text',
          headers: { Range: `bytes=0-${EXCERPT_FETCH_BYTE_LIMIT - 1}` },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        }
      )
      const text = response.data
      // A byte-range request can split a trailing multi-byte UTF-8 character, which some text
      // decoders surface as a replacement character — trim it since only a display excerpt.
      return typeof text === 'string' ? text.replace(/�+$/, '') : undefined
    } catch {
      // Excerpting is best-effort — a fetch failure (including a timeout) just means no
      // excerpt for this file, mirroring searchSpace's REPORT call: every network call here
      // must be boundable, or one slow/hanging file blocks the whole Promise.all below.
      return undefined
    }
  }

  async function fetchRecentFiles(): Promise<RecentFile[]> {
    isLoading.value = true
    error.value = null

    try {
      const spaces = spacesStore.spaces as unknown as SpaceResource[]
      if (!spaces || spaces.length === 0) {
        return []
      }

      // One space failing to answer must not take down discovery for the rest — settle each
      // space independently and only skip the ones that actually failed.
      const settled = await Promise.allSettled(spaces.map((space) => searchSpace(space)))
      const failedCount = settled.filter((result) => result.status === 'rejected').length
      const bySpace = settled.map((result) => (result.status === 'fulfilled' ? result.value : []))
      const spaceById = new Map(spaces.map((space) => [space.id as string, space]))

      const merged = bySpace
        .flat()
        .sort((a, b) => Date.parse(b.mdate || '') - Date.parse(a.mdate || ''))
        .slice(0, MAX_RECENT_FILES)

      if (failedCount > 0 && failedCount === spaces.length && merged.length === 0) {
        error.value = $gettext('Could not reach any of your spaces. Please try again later.')
        return []
      }

      const withExcerpts = await Promise.all(
        merged.map(async (entry) => {
          const space = spaceById.get(entry.spaceId)
          const excerpt = space ? await fetchExcerpt(space, entry) : undefined
          const file: RecentFile = {
            fileId: entry.fileId,
            name: entry.name,
            path: entry.path,
            storageId: entry.storageId,
            spaceId: entry.spaceId,
            mdate: entry.mdate,
            size: entry.size,
            extension: entry.extension
          }
          if (excerpt) {
            file.excerpt = excerpt
          }
          return file
        })
      )

      return withExcerpts
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : $gettext('Something went wrong while listing recent files. Please try again.')
      return []
    } finally {
      isLoading.value = false
    }
  }

  return { isLoading, error, fetchRecentFiles }
}
