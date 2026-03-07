/**
 * Composable for advanced search functionality
 * Handles KQL query building and search execution via WebDAV REPORT
 */

import { ref, computed, reactive, onUnmounted, getCurrentInstance } from 'vue'
import { useClientService, useConfigStore, useSpacesStore } from '@ownclouders/web-pkg'
import type { Resource, SpaceResource } from '@ownclouders/web-client'
import type {
  SearchFilters,
  AdvancedSearchState,
  ActiveFilter,
  SortConfig,
  ResultViewMode,
} from '../types'
import { createEmptyFilters, createEmptyResults } from '../types'
import {
  escapeXML,
  buildStandardKQL,
  buildPhotoKQL,
} from '../utils/kql'
import { formatBytes } from '../utils/format'
import { useTranslations } from './useTranslations'

/**
 * Parse WebDAV REPORT search response XML into Resource objects.
 *
 * The oCIS search API returns XML in WebDAV multistatus format:
 * <d:multistatus>
 *   <d:response>
 *     <d:href>/dav/spaces/space-id/path/to/file.pdf</d:href>
 *     <d:propstat>
 *       <d:prop>
 *         <d:displayname>file.pdf</d:displayname>
 *         <d:getcontenttype>application/pdf</d:getcontenttype>
 *         ...
 *       </d:prop>
 *     </d:propstat>
 *   </d:response>
 * </d:multistatus>
 *
 * @param xmlText - Raw XML response from WebDAV REPORT request
 * @param spaceId - The space ID used in the request (for path extraction)
 * @param driveAlias - Drive alias for navigation (e.g., "personal/admin")
 * @returns Array of Resource objects ready for display
 * @throws Error if XML is malformed or contains parser errors
 */
function parseSearchResponse(xmlText: string, spaceId: string, driveAlias: string): Resource[] {
  // Pre-validate that response looks like XML
  const trimmed = xmlText.trim()
  if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<')) {
    throw new Error('Invalid response: expected XML but received non-XML content')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')

  // DOMParser doesn't throw on invalid XML - check for parsererror element instead
  const parserError = doc.querySelector('parsererror')

  // Also verify we got the expected WebDAV multistatus root element
  const multistatus = doc.getElementsByTagNameNS('DAV:', 'multistatus')[0]

  if (parserError || !multistatus) {
    throw new Error(`XML parsing failed: ${parserError?.textContent?.slice(0, 100) || 'Unexpected response format (not a WebDAV multistatus)'}`)
  }

  const responses = doc.getElementsByTagNameNS('DAV:', 'response')
  const items: Resource[] = []
  let skippedCount = 0

  for (let i = 0; i < responses.length; i++) {
    const response = responses[i]
    const href = response.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent

    // href is required - skip malformed response entries
    if (!href) {
      skippedCount++
      continue
    }

    // Extract standard WebDAV properties
    const displayname = response.getElementsByTagNameNS('DAV:', 'displayname')[0]?.textContent || ''
    const contentType = response.getElementsByTagNameNS('DAV:', 'getcontenttype')[0]?.textContent || ''
    const contentLength = response.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]?.textContent || '0'
    const lastModified = response.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]?.textContent || ''

    // Extract ownCloud-specific properties (oc: namespace)
    const fileId = response.getElementsByTagNameNS('http://owncloud.org/ns', 'fileid')[0]?.textContent || ''
    const parentId = response.getElementsByTagNameNS('http://owncloud.org/ns', 'file-parent')[0]?.textContent || ''

    // Extract file path from href by removing the WebDAV space prefix.
    // Server may return spaceId URL-encoded or not, so check both formats.
    const spacePrefix = `/dav/spaces/${spaceId}`
    const encodedSpacePrefix = `/dav/spaces/${encodeURIComponent(spaceId)}`
    let path = href
    if (href.startsWith(spacePrefix)) {
      path = decodeURIComponent(href.substring(spacePrefix.length))
    } else if (href.startsWith(encodedSpacePrefix)) {
      path = decodeURIComponent(href.substring(encodedSpacePrefix.length))
    }

    // Folders have special MIME type or trailing slash
    const isFolder = contentType === 'httpd/unix-directory' || href.endsWith('/')

    // Fallback: extract filename from path if displayname element is empty
    const pathParts = path.split('/')
    const nameFromPath = pathParts.length > 0 ? pathParts[pathParts.length - 1] : ''

    items.push({
      // Generate synthetic ID if server doesn't return fileid
      id: fileId || `${spaceId}!${path}`,
      fileId,
      name: displayname || nameFromPath || 'Unknown',
      path: path,
      webDavPath: href,
      mimeType: contentType,
      size: parseInt(contentLength, 10) || 0,
      mdate: lastModified,
      type: isFolder ? 'folder' : 'file',
      isFolder,
      // Required fields for Resource type compatibility
      etag: '',
      permissions: '',
      starred: false,
      spaceId: spaceId,
      driveAlias: driveAlias,
      parentId: parentId,
    } as Resource)
  }

  if (skippedCount > 0 && typeof console !== 'undefined') {
    console.warn(`[parseSearchResponse] Skipped ${skippedCount} items with missing href`)
  }

  return items
}

/**
 * Main advanced search composable
 */
export function useAdvancedSearch() {
  // Get services from web-pkg
  const clientService = useClientService()
  const configStore = useConfigStore()
  const spacesStore = useSpacesStore()
  const { $gettext } = useTranslations()

  // Reactive state
  const state = reactive<AdvancedSearchState>({
    filters: createEmptyFilters(),
    results: null,
    loading: false,
    error: null,
    kqlQuery: '',
    viewMode: 'list',
    sort: { field: 'mtime', direction: 'desc' },
  })

  // Page size for pagination
  const pageSize = ref(100)

  // Request timeout in milliseconds (30 seconds)
  const REQUEST_TIMEOUT_MS = 30000

  // AbortController for cancelling in-flight requests
  let currentAbortController: AbortController | null = null
  let currentTimeoutId: ReturnType<typeof setTimeout> | null = null

  // Clean up on component unmount to prevent memory leaks and orphaned requests
  // Only register if we're inside a component context (not in tests)
  if (getCurrentInstance()) {
    onUnmounted(() => {
      if (currentTimeoutId) {
        clearTimeout(currentTimeoutId)
        currentTimeoutId = null
      }
      if (currentAbortController) {
        currentAbortController.abort()
        currentAbortController = null
      }
    })
  }

  /**
   * Build KQL query string from current filters
   */
  const buildKQLQuery = computed(() => {
    const { standard, photo, term } = state.filters
    const parts = [
      ...buildStandardKQL(standard, term || ''),
      ...buildPhotoKQL(photo)
    ]
    return parts.length > 0 ? parts.join(' AND ') : '*'
  })

  /**
   * Get list of active filters for display as chips
   */
  const activeFilters = computed<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = []
    const { standard, photo, term } = state.filters

    // Text term
    if (term && term.trim()) {
      filters.push({
        id: 'term',
        label: $gettext('Search'),
        field: 'name',
        value: term.trim(),
        category: 'text',
      })
    }

    // Standard filters
    if (standard.name) {
      filters.push({
        id: 'name',
        label: $gettext('Name'),
        field: 'name',
        value: standard.name,
        category: 'standard',
      })
    }

    if (standard.type) {
      filters.push({
        id: 'type',
        label: $gettext('Type'),
        field: 'type',
        value: standard.type,
        category: 'standard',
      })
    }

    if (standard.mediaType) {
      filters.push({
        id: 'mediaType',
        label: $gettext('Media Type'),
        field: 'mediatype',
        value: standard.mediaType,
        category: 'standard',
      })
    }

    if (standard.tags) {
      filters.push({
        id: 'tags',
        label: $gettext('Tags'),
        field: 'tags',
        value: standard.tags,
        category: 'standard',
      })
    }

    if (standard.sizeRange && (standard.sizeRange.min || standard.sizeRange.max)) {
      const min = standard.sizeRange.min ? formatBytes(standard.sizeRange.min) : '0'
      const max = standard.sizeRange.max ? formatBytes(standard.sizeRange.max) : '∞'
      filters.push({
        id: 'size',
        label: $gettext('Size'),
        field: 'size',
        value: `${min} - ${max}`,
        category: 'standard',
      })
    }

    if (standard.modifiedRange && (standard.modifiedRange.start || standard.modifiedRange.end)) {
      filters.push({
        id: 'mtime',
        label: $gettext('Modified'),
        field: 'mtime',
        value: `${standard.modifiedRange.start || '*'} ${$gettext('to')} ${standard.modifiedRange.end || '*'}`,
        category: 'standard',
      })
    }

    if (standard.content) {
      filters.push({
        id: 'content',
        label: $gettext('Content'),
        field: 'content',
        value: standard.content,
        category: 'text',
      })
    }

    // Photo filters
    if (photo.cameraMake) {
      filters.push({
        id: 'cameraMake',
        label: $gettext('Camera Make'),
        field: 'photo.cameraMake',
        value: photo.cameraMake,
        category: 'photo',
      })
    }

    if (photo.cameraModel) {
      filters.push({
        id: 'cameraModel',
        label: $gettext('Camera Model'),
        field: 'photo.cameraModel',
        value: photo.cameraModel,
        category: 'photo',
      })
    }

    if (photo.objectCaption) {
      filters.push({
        id: 'objectCaption',
        label: $gettext('Image Caption'),
        field: 'objectCaption',
        value: photo.objectCaption,
        category: 'photo',
      })
    }

    if (photo.objectLabel) {
      filters.push({
        id: 'objectLabel',
        label: $gettext('Object Detection'),
        field: 'objectLabel',
        value: photo.objectLabel,
        category: 'photo',
      })
    }

    if (photo.takenDateRange && (photo.takenDateRange.start || photo.takenDateRange.end)) {
      filters.push({
        id: 'takenDate',
        label: $gettext('Date Taken'),
        field: 'photo.takenDateTime',
        value: `${photo.takenDateRange.start || '*'} ${$gettext('to')} ${photo.takenDateRange.end || '*'}`,
        category: 'photo',
      })
    }

    if (photo.isoRange && (photo.isoRange.min || photo.isoRange.max)) {
      filters.push({
        id: 'iso',
        label: $gettext('ISO'),
        field: 'photo.iso',
        value: `${photo.isoRange.min || '0'} - ${photo.isoRange.max || '∞'}`,
        category: 'photo',
      })
    }

    if (photo.fNumberRange && (photo.fNumberRange.min || photo.fNumberRange.max)) {
      filters.push({
        id: 'fNumber',
        label: $gettext('Aperture'),
        field: 'photo.fNumber',
        value: `f/${photo.fNumberRange.min || '?'} - f/${photo.fNumberRange.max || '?'}`,
        category: 'photo',
      })
    }

    if (photo.focalLengthRange && (photo.focalLengthRange.min || photo.focalLengthRange.max)) {
      filters.push({
        id: 'focalLength',
        label: $gettext('Focal Length'),
        field: 'photo.focalLength',
        value: `${photo.focalLengthRange.min || '?'}mm - ${photo.focalLengthRange.max || '?'}mm`,
        category: 'photo',
      })
    }

    return filters
  })

  /**
   * Execute search with current filters using WebDAV REPORT
   */
  async function executeSearch(page = 0): Promise<void> {
    // Cancel any in-flight request to prevent race conditions
    if (currentTimeoutId) {
      clearTimeout(currentTimeoutId)
      currentTimeoutId = null
    }
    if (currentAbortController) {
      currentAbortController.abort()
    }
    currentAbortController = new AbortController()
    const abortSignal = currentAbortController.signal

    // Track if abort was due to timeout (vs user cancellation or new search)
    let timedOut = false

    // Set request timeout
    currentTimeoutId = setTimeout(() => {
      timedOut = true
      currentAbortController?.abort()
    }, REQUEST_TIMEOUT_MS)

    state.loading = true
    state.error = null
    state.kqlQuery = buildKQLQuery.value

    try {
      const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')

      // Get the personal space (or first available space)
      const spaces = spacesStore.spaces as SpaceResource[]
      const personalSpace = spaces.find((s: SpaceResource) => s.driveType === 'personal') || spaces[0]

      if (!personalSpace) {
        throw new Error($gettext('No space available for search'))
      }

      const spaceId = personalSpace.id
      const driveAlias = personalSpace.driveAlias || 'personal/home'

      const limit = pageSize.value
      const pattern = state.kqlQuery

      // Build WebDAV REPORT search request
      // Pattern must be XML-escaped since KQL can contain < > (comparison operators)
      const searchBody = `<?xml version="1.0" encoding="UTF-8"?>
<oc:search-files xmlns:oc="http://owncloud.org/ns" xmlns:d="DAV:">
  <oc:search>
    <oc:pattern>${escapeXML(pattern)}</oc:pattern>
    <oc:limit>${limit}</oc:limit>
  </oc:search>
  <d:prop>
    <d:displayname/>
    <d:getcontenttype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <oc:fileid/>
    <oc:file-parent/>
    <oc:photo-taken-date-time/>
    <oc:photo-camera-make/>
    <oc:photo-camera-model/>
  </d:prop>
</oc:search-files>`

      const response = await clientService.httpAuthenticated.request({
        method: 'REPORT',
        url: `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}`,
        headers: {
          'Content-Type': 'application/xml'
        },
        data: searchBody,
        signal: abortSignal
      })

      // Clear timeout on successful response
      if (currentTimeoutId) {
        clearTimeout(currentTimeoutId)
        currentTimeoutId = null
      }

      const xmlText = typeof response.data === 'string' ? response.data : new XMLSerializer().serializeToString(response.data)
      const items = parseSearchResponse(xmlText, spaceId, driveAlias)

      state.results = {
        totalCount: items.length,
        items: page === 0 ? items : [...(state.results?.items || []), ...items],
        hasMore: items.length === limit,
        currentPage: page,
      }
    } catch (err: unknown) {
      // Clear timeout on error
      if (currentTimeoutId) {
        clearTimeout(currentTimeoutId)
        currentTimeoutId = null
      }

      // Handle timeout abort specially
      if (timedOut) {
        state.error = $gettext('Search timed out. Try a more specific query or check if the search service is responding.')
        state.results = createEmptyResults()
        return
      }

      // Ignore abort errors (request was cancelled by a newer search)
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      // Also check for axios cancel
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ERR_CANCELED') {
        return
      }

      const error = err as { response?: { status?: number; data?: unknown }; code?: string; message?: string }
      const status = error.response?.status

      // Specific HTTP error handling
      if (status === 503) {
        state.error = $gettext('The search service is temporarily unavailable (503 Service Unavailable). The service may be starting up or under maintenance.')
      } else if (status === 502) {
        state.error = $gettext('The search service is not responding (502 Bad Gateway). Please try again in a moment.')
      } else if (status === 500) {
        state.error = $gettext('The search service encountered an error (500 Internal Server Error). Please try again.')
      } else if (status === 401 || status === 403) {
        state.error = $gettext('Authentication error (401 Unauthorized). Your session may have expired.')
      } else if (error.code === 'ECONNREFUSED' || error.message?.includes('Network') || error.message?.includes('network')) {
        state.error = $gettext('Unable to connect to the server. Please check your network connection.')
      } else {
        state.error = error.message || $gettext('Search failed. Please try again.')
      }

      state.results = createEmptyResults()
    } finally {
      state.loading = false
    }
  }

  /**
   * Load next page of results
   */
  async function loadMore(): Promise<void> {
    if (!state.results || !state.results.hasMore || state.loading) {
      return
    }
    await executeSearch(state.results.currentPage + 1)
  }

  /**
   * Clear all filters and reset state
   */
  function clearFilters(): void {
    state.filters = createEmptyFilters()
    state.results = null
    state.kqlQuery = ''
  }

  // Filter registry: maps filter ID to reset action
  const filterResetRegistry: Record<string, () => void> = {
    term: () => { state.filters.term = '' },
    name: () => { state.filters.standard.name = undefined },
    type: () => { state.filters.standard.type = '' },
    mediaType: () => { state.filters.standard.mediaType = undefined },
    tags: () => { state.filters.standard.tags = undefined },
    size: () => { state.filters.standard.sizeRange = undefined },
    mtime: () => { state.filters.standard.modifiedRange = undefined },
    content: () => { state.filters.standard.content = undefined },
    cameraMake: () => { state.filters.photo.cameraMake = undefined },
    cameraModel: () => { state.filters.photo.cameraModel = undefined },
    objectCaption: () => { state.filters.photo.objectCaption = undefined },
    objectLabel: () => { state.filters.photo.objectLabel = undefined },
    takenDate: () => { state.filters.photo.takenDateRange = undefined },
    iso: () => { state.filters.photo.isoRange = undefined },
    fNumber: () => { state.filters.photo.fNumberRange = undefined },
    focalLength: () => { state.filters.photo.focalLengthRange = undefined },
  }

  /**
   * Remove a specific filter by ID
   */
  function removeFilter(filterId: string): void {
    filterResetRegistry[filterId]?.()
  }

  /**
   * Set view mode
   */
  function setViewMode(mode: ResultViewMode): void {
    state.viewMode = mode
  }

  /**
   * Set sort configuration
   */
  function setSort(sort: SortConfig): void {
    state.sort = sort
  }

  /**
   * Update filters (partial update)
   */
  function updateFilters(updates: Partial<SearchFilters>): void {
    Object.assign(state.filters, updates)
  }

  /**
   * Update standard filters
   */
  function updateStandardFilters(updates: Partial<SearchFilters['standard']>): void {
    Object.assign(state.filters.standard, updates)
  }

  /**
   * Update photo filters
   */
  function updatePhotoFilters(updates: Partial<SearchFilters['photo']>): void {
    Object.assign(state.filters.photo, updates)
  }

  /**
   * Fetch camera makes - returns empty, uses static list only
   * TODO: WebDAV doesn't return photo-camera-make property in responses,
   * so dynamic discovery requires a different approach (faceted search or probing)
   */
  function fetchCameraMakes(): Promise<string[]> {
    // Static list is used from KNOWN_CAMERA_MAKES in types.ts
    return Promise.resolve([])
  }

  /**
   * Fetch camera models - returns empty, no static list available
   * TODO: WebDAV doesn't return photo-camera-model property in responses
   */
  function fetchCameraModels(): Promise<string[]> {
    return Promise.resolve([])
  }

  /**
   * Set KQL query directly (for manual editing)
   */
  function setKqlQuery(query: string): void {
    state.kqlQuery = query
  }

  /**
   * Maximum recursion depth for KQL parsing.
   * Prevents stack overflow from maliciously crafted or malformed nested queries.
   * Value of 10 is generous for legitimate queries (rarely >3 levels deep).
   */
  const MAX_KQL_PARSE_DEPTH = 10

  /**
   * Parse a KQL query string and populate the filters (reverse of buildKQLQuery).
   *
   * Algorithm:
   * 1. Reset all filters to empty state
   * 2. Split the KQL string by AND operators (respecting parentheses)
   * 3. Parse each part to extract field:value pairs or range expressions
   * 4. Map parsed values to corresponding filter fields
   *
   * Handles: field:value, field>=value, field<=value, (range AND range), nested parentheses
   *
   * @param kql - KQL query string (e.g., "name:*.pdf AND size>=1000")
   */
  function parseKqlToFilters(kql: string): void {
    state.filters = createEmptyFilters()

    if (!kql || kql === '*') {
      return
    }

    // Split by AND while preserving parenthesized expressions as single units
    const parts = splitKqlParts(kql)

    for (const part of parts) {
      parseKqlPart(part.trim(), 0)
    }
  }

  /**
   * Split KQL string by AND operators, respecting parentheses.
   *
   * Example: "name:foo AND (size>=100 AND size<=1000) AND type:file"
   * Returns: ["name:foo", "(size>=100 AND size<=1000)", "type:file"]
   *
   * The parenthesized range expression is kept together because AND inside
   * parentheses should not split the expression.
   *
   * @param kql - KQL query string
   * @returns Array of KQL parts to be parsed individually
   */
  function splitKqlParts(kql: string): string[] {
    const parts: string[] = []
    let current = ''
    let depth = 0 // Tracks parenthesis nesting depth

    // Split by AND keyword (case-insensitive), capturing the AND token
    const tokens = kql.split(/\s+(AND)\s+/i)

    for (const token of tokens) {
      if (token.toUpperCase() === 'AND') {
        // Only split on AND when at depth 0 (not inside parentheses)
        if (depth === 0) {
          if (current.trim()) {
            parts.push(current.trim())
          }
          current = ''
        } else {
          // Inside parentheses - keep AND as part of the expression
          current += ' AND '
        }
      } else {
        // Count parentheses using regex (faster than char-by-char iteration)
        const openCount = (token.match(/\(/g) || []).length
        const closeCount = (token.match(/\)/g) || []).length
        depth += openCount - closeCount
        current += token
      }
    }

    if (current.trim()) {
      parts.push(current.trim())
    }

    return parts
  }

  /**
   * Parse a single KQL part and update the corresponding filter fields.
   *
   * Handles three types of expressions:
   * 1. Parenthesized: "(expr)" - unwrap and recurse, or detect range pairs
   * 2. Range comparison: "field>=value" or "field<=value"
   * 3. Field:value: "name:*.pdf", "mediatype:image/*"
   * 4. Free text: anything without ":" becomes a search term
   *
   * @param part - The KQL part to parse (e.g., "name:foo", "size>=100")
   * @param depth - Current recursion depth to prevent stack overflow from malformed queries
   */
  function parseKqlPart(part: string, depth: number): void {
    if (depth >= MAX_KQL_PARSE_DEPTH) {
      console.warn('[useAdvancedSearch] KQL parsing depth limit reached, skipping:', part.slice(0, 50))
      return
    }

    // Handle parenthesized expressions - either range pairs or nested queries
    if (part.startsWith('(') && part.endsWith(')')) {
      const inner = part.slice(1, -1)

      // Check if this is a range expression like "(size>=100 AND size<=1000)"
      // Heuristic: if it has AND with exactly 2 parts that are both range
      // comparisons on the same field, treat as a combined min/max range
      if (inner.includes(' AND ')) {
        const rangeParts = inner.split(/\s+AND\s+/i)
        if (rangeParts.length === 2) {
          const range1 = parseRangePart(rangeParts[0])
          const range2 = parseRangePart(rangeParts[1])
          // Both parts are ranges on the same field = combined range filter
          if (range1 && range2 && range1.field === range2.field) {
            applyRangeToFilters(range1.field, range1, range2)
            return
          }
        }
      }

      // Not a range pair - recursively parse the inner content
      const subParts = splitKqlParts(inner)
      for (const subPart of subParts) {
        parseKqlPart(subPart.trim(), depth + 1)
      }
      return
    }

    // Try to parse as range comparison (field>=value or field<=value)
    const rangeMatch = parseRangePart(part)
    if (rangeMatch) {
      applyRangeToFilters(rangeMatch.field, rangeMatch, null)
      return
    }

    // Parse field:value patterns
    const colonIndex = part.indexOf(':')
    if (colonIndex === -1) {
      // Free text search term
      if (part.trim()) {
        state.filters.term = (state.filters.term ? state.filters.term + ' ' : '') + part.trim()
      }
      return
    }

    const field = part.substring(0, colonIndex).toLowerCase()
    let value = part.substring(colonIndex + 1)

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    // Unescape KQL escapes
    value = value.replace(/\\([+\-=&|><!(){}[\]^"~:\\/])/g, '$1')

    // Map field to filter
    switch (field) {
      case 'name':
        state.filters.standard.name = value
        break
      case 'type':
        if (value === '1') state.filters.standard.type = 'file'
        else if (value === '2') state.filters.standard.type = 'folder'
        else state.filters.standard.type = value as 'file' | 'folder'
        break
      case 'mediatype':
        state.filters.standard.mediaType = value
        break
      case 'tags':
      case 'tag':
        // Only add non-empty tag values
        if (value && value.trim()) {
          const trimmedValue = value.trim()
          state.filters.standard.tags = state.filters.standard.tags
            ? state.filters.standard.tags + ',' + trimmedValue
            : trimmedValue
        }
        break
      case 'content':
        state.filters.standard.content = value
        break
      case 'photo.cameramake':
        state.filters.photo.cameraMake = value
        break
      case 'photo.cameramodel':
        state.filters.photo.cameraModel = value
        break
      case 'photo.orientation':
        state.filters.photo.orientation = parseInt(value, 10)
        break
      case 'objectcaption':
      case 'objectcaptions':
        state.filters.photo.objectCaption = value
        break
      case 'objectlabel':
      case 'objectlabels':
        state.filters.photo.objectLabel = value
        break
      default:
        // Unknown field - ignore silently
        break
    }
  }

  /**
   * Parse a range comparison expression (e.g., "size>=100", "mtime<=2024-01-01").
   *
   * Regex breakdown: ^([a-z.]+)(>=|<=|>|<)(.+)$
   * - ([a-z.]+)  = field name (allows dots for photo.iso, photo.fnumber, etc.)
   * - (>=|<=|>|<) = comparison operator
   * - (.+)       = value (number or date string)
   *
   * @param part - KQL part that might be a range expression
   * @returns Parsed field/operator/value or null if not a range expression
   */
  function parseRangePart(part: string): { field: string; op: string; value: string } | null {
    const match = part.match(/^([a-z.]+)(>=|<=|>|<)(.+)$/i)
    if (match) {
      return {
        field: match[1].toLowerCase(),
        op: match[2],
        value: match[3]
      }
    }
    return null
  }

  /**
   * Apply parsed range values to the appropriate filter field.
   *
   * Maps KQL field names to filter objects with appropriate type conversions:
   * - size: parseInt for bytes
   * - mtime: string for ISO date
   * - photo.iso: parseInt for numeric ISO
   * - photo.fnumber, photo.focallength: parseFloat for decimal values
   *
   * @param field - KQL field name (e.g., "size", "photo.iso")
   * @param range1 - First range comparison (always present)
   * @param range2 - Second range comparison (for combined min/max), or null
   */
  function applyRangeToFilters(
    field: string,
    range1: { op: string; value: string },
    range2: { op: string; value: string } | null
  ): void {
    const ranges = [range1]
    if (range2) ranges.push(range2)

    // Extract min and max from the range operators
    let min: string | number | undefined
    let max: string | number | undefined

    for (const r of ranges) {
      if (r.op === '>=' || r.op === '>') {
        min = r.value
      } else if (r.op === '<=' || r.op === '<') {
        max = r.value
      }
    }

    switch (field) {
      case 'size':
        state.filters.standard.sizeRange = {
          min: min !== undefined ? parseInt(min as string, 10) : undefined,
          max: max !== undefined ? parseInt(max as string, 10) : undefined
        }
        break
      case 'mtime':
        state.filters.standard.modifiedRange = {
          start: min as string || '',
          end: max as string || ''
        }
        break
      case 'photo.takendatetime':
        state.filters.photo.takenDateRange = {
          start: min as string || '',
          end: max as string || ''
        }
        break
      case 'photo.iso':
        state.filters.photo.isoRange = {
          min: min !== undefined ? parseInt(min as string, 10) : undefined,
          max: max !== undefined ? parseInt(max as string, 10) : undefined
        }
        break
      case 'photo.fnumber':
        state.filters.photo.fNumberRange = {
          min: min !== undefined ? parseFloat(min as string) : undefined,
          max: max !== undefined ? parseFloat(max as string) : undefined
        }
        break
      case 'photo.focallength':
        state.filters.photo.focalLengthRange = {
          min: min !== undefined ? parseFloat(min as string) : undefined,
          max: max !== undefined ? parseFloat(max as string) : undefined
        }
        break
      default:
        // Unknown range field - ignore silently
        break
    }
  }

  return {
    // State
    state,
    pageSize,

    // Computed
    kqlQuery: buildKQLQuery,
    activeFilters,

    // Methods
    executeSearch,
    loadMore,
    clearFilters,
    removeFilter,
    setViewMode,
    setSort,
    updateFilters,
    updateStandardFilters,
    updatePhotoFilters,
    setKqlQuery,
    parseKqlToFilters,
    fetchCameraMakes,
    fetchCameraModels,
  }
}
