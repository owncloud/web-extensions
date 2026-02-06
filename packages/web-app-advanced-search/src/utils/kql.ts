/**
 * KQL (Keyword Query Language) utilities for oCIS search.
 *
 * KQL is the query language used by oCIS's Bleve-based search engine.
 * This module handles:
 * - Building KQL query strings from filter objects
 * - Escaping special characters in search values
 * - Formatting range queries (size, dates, etc.)
 * - XML escaping for WebDAV REPORT requests
 */

import type { SearchFilters, DateRange, NumericRange } from '../types'
import { formatDateForKQL } from './format'

/**
 * Regex patterns for escaping KQL special characters.
 * Pre-compiled and stored outside functions to avoid regex recompilation overhead.
 *
 * KQL_SPECIAL_CHARS: Escapes ALL special chars including wildcards (* ?)
 *   Used when the value should be treated as literal text.
 *   Characters: + - = & | > < ! ( ) { } [ ] ^ " ~ * ? : \ / whitespace
 *
 * KQL_SPECIAL_CHARS_KEEP_WILDCARDS: Escapes special chars BUT preserves * and ?
 *   Used when the user intentionally included wildcards for pattern matching.
 *   Characters: + - = & | > < ! ( ) { } [ ] ^ " ~ : \ /
 */
const KQL_SPECIAL_CHARS = /[+\-=&|><!(){}[\]^"~*?:\\/\s]/g
const KQL_SPECIAL_CHARS_KEEP_WILDCARDS = /[+\-=&|><!(){}[\]^"~:\\/]/g

/**
 * Escape special characters in a KQL query value.
 *
 * If the value contains wildcards (* or ?), they are preserved (user intent).
 * Otherwise, all special characters are escaped with backslash.
 *
 * @example
 * escapeKQL("hello world") // "hello\\ world"
 * escapeKQL("test*.pdf")   // "test*.pdf" (wildcard preserved)
 * escapeKQL("file (1)")    // "file\\ \\(1\\)"
 *
 * @param value - The raw value to escape
 * @returns Escaped value safe for KQL queries
 */
export function escapeKQL(value: string): string {
  // Detect intentional wildcards and preserve them
  if (value.includes('*') || value.includes('?')) {
    // Reset lastIndex - global regexes are stateful and can cause bugs
    KQL_SPECIAL_CHARS_KEEP_WILDCARDS.lastIndex = 0
    return value.replace(KQL_SPECIAL_CHARS_KEEP_WILDCARDS, '\\$&')
  }
  KQL_SPECIAL_CHARS.lastIndex = 0
  return value.replace(KQL_SPECIAL_CHARS, '\\$&')
}

/**
 * Build a range query for KQL using comparison operators
 * oCIS KQL doesn't support [x TO y] syntax, use >= and <= instead
 */
export function buildRangeQuery(field: string, range: NumericRange): string | null {
  if (range.min === undefined && range.max === undefined) {
    return null
  }

  const parts: string[] = []
  if (range.min !== undefined) {
    parts.push(`${field}>=${range.min}`)
  }
  if (range.max !== undefined) {
    parts.push(`${field}<=${range.max}`)
  }

  // If both min and max, wrap in parentheses
  if (parts.length === 2) {
    return `(${parts.join(' AND ')})`
  }
  return parts[0]
}

/**
 * Build a date range query for KQL using comparison operators
 * oCIS KQL doesn't support [x TO y] syntax, use >= and <= instead
 */
export function buildDateRangeQuery(field: string, range: DateRange): string | null {
  if (!range.start && !range.end) {
    return null
  }

  const parts: string[] = []
  if (range.start) {
    const formattedStart = formatDateForKQL(range.start)
    if (formattedStart) {
      parts.push(`${field}>=${formattedStart}`)
    }
  }
  if (range.end) {
    const formattedEnd = formatDateForKQL(range.end)
    if (formattedEnd) {
      parts.push(`${field}<=${formattedEnd}`)
    }
  }

  // If both min and max, wrap in parentheses
  if (parts.length === 2) {
    return `(${parts.join(' AND ')})`
  }
  return parts.length > 0 ? parts[0] : null
}

/**
 * Escape special XML characters in a string
 * Required when embedding KQL in XML body (< > & need escaping)
 */
export function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Wrap a search value for KQL, handling phrases and wildcards correctly.
 *
 * KQL phrase search rules:
 * - Multi-word phrases must be quoted: "hello world"
 * - Wildcards inside quotes are treated literally: "test*" matches "test*" not "testing"
 * - Wildcards outside quotes work: "*test*" matches "testing", "contest", etc.
 *
 * This function handles the quote/wildcard placement automatically:
 * - Single word: *word* (wildcards wrap the escaped word)
 * - Multi-word phrase: "*phrase here*" (quotes wrap phrase, wildcards outside)
 *
 * @example
 * wrapForSearch("report")        // "*report*"
 * wrapForSearch("annual report") // ""*annual report*""
 * wrapForSearch("*.pdf", false)  // "*.pdf" (no extra wildcards)
 *
 * @param value - The search value
 * @param addWildcards - Whether to add * wildcards for partial matching (default: true)
 * @returns KQL-safe search term with proper quoting and wildcards
 */
function wrapForSearch(value: string, addWildcards: boolean = true): string {
  const trimmed = value.trim()
  const hasSpaces = /\s/.test(trimmed)

  if (hasSpaces) {
    // Multi-word phrase: must quote, wildcards go OUTSIDE quotes to work
    if (addWildcards) {
      return `"*${trimmed}*"`
    }
    return `"${trimmed}"`
  }

  // Single word: escape special chars, optionally wrap with wildcards
  if (addWildcards) {
    return `*${escapeKQL(trimmed)}*`
  }
  return escapeKQL(trimmed)
}

/**
 * Build KQL query parts for standard (non-photo) filters.
 *
 * Converts filter object fields into KQL expressions that can be
 * joined with AND to form a complete query.
 *
 * @param standard - Standard filter fields (name, type, size, dates, etc.)
 * @param term - Free-text search term from the main search input
 * @returns Array of KQL expressions (e.g., ["name:*report*", "Type:1", "size>=1000"])
 */
export function buildStandardKQL(standard: SearchFilters['standard'], term: string): string[] {
  const parts: string[] = []

  // Handle the main search term input
  if (term && term.trim()) {
    // If term contains ":" it's already a field query (e.g., "content:budget")
    // Pass it through unchanged to allow power users to write raw KQL
    if (!term.includes(':')) {
      parts.push(`name:${wrapForSearch(term.trim(), true)}`)
    } else {
      parts.push(term.trim())
    }
  }

  if (standard.name) {
    // Don't add extra wildcards if user already included them
    parts.push(`name:${wrapForSearch(standard.name, !standard.name.includes('*'))}`)
  }

  // oCIS uses numeric type values: 1 = file, 2 = folder (not strings)
  if (standard.type === 'file') {
    parts.push('Type:1')
  } else if (standard.type === 'folder') {
    parts.push('Type:2')
  }

  if (standard.sizeRange) {
    const sizeQuery = buildRangeQuery('size', standard.sizeRange)
    if (sizeQuery) parts.push(sizeQuery)
  }

  if (standard.modifiedRange) {
    const mtimeQuery = buildDateRangeQuery('mtime', standard.modifiedRange)
    if (mtimeQuery) parts.push(mtimeQuery)
  }

  if (standard.mediaType) {
    parts.push(`mediatype:${escapeKQL(standard.mediaType)}`)
  }

  if (standard.tags) {
    const tagList = standard.tags.split(',').map(t => t.trim()).filter(Boolean)
    if (tagList.length === 1) {
      // Quote tag values to preserve special characters like colons (e.g., "exif:make:HP")
      // Escaping colons breaks oCIS tag search
      parts.push(`tags:"${tagList[0]}"`)
    } else if (tagList.length > 1) {
      const tagQuery = tagList.map(t => `tags:"${t}"`).join(' OR ')
      parts.push(`(${tagQuery})`)
    }
  }

  if (standard.content) {
    // Content search also needs phrase handling for multi-word searches
    parts.push(`content:${wrapForSearch(standard.content, false)}`)
  }

  return parts
}

/**
 * Build KQL query parts for photo/EXIF filters
 */
export function buildPhotoKQL(photo: SearchFilters['photo']): string[] {
  const parts: string[] = []

  if (photo.cameraMake) {
    // Camera makes can have spaces (e.g., "FUJIFILM CORPORATION")
    parts.push(`photo.cameramake:${wrapForSearch(photo.cameraMake, false)}`)
  }

  if (photo.cameraModel) {
    // Camera models often have spaces (e.g., "EOS R5", "iPhone 14 Pro")
    parts.push(`photo.cameramodel:${wrapForSearch(photo.cameraModel, false)}`)
  }

  if (photo.takenDateRange) {
    const takenQuery = buildDateRangeQuery('photo.takendatetime', photo.takenDateRange)
    if (takenQuery) parts.push(takenQuery)
  }

  if (photo.isoRange) {
    const isoQuery = buildRangeQuery('photo.iso', photo.isoRange)
    if (isoQuery) parts.push(isoQuery)
  }

  if (photo.fNumberRange) {
    const fQuery = buildRangeQuery('photo.fnumber', photo.fNumberRange)
    if (fQuery) parts.push(fQuery)
  }

  if (photo.focalLengthRange) {
    const flQuery = buildRangeQuery('photo.focallength', photo.focalLengthRange)
    if (flQuery) parts.push(flQuery)
  }

  if (photo.orientation !== undefined && photo.orientation > 0) {
    parts.push(`photo.orientation:${photo.orientation}`)
  }

  return parts
}

/**
 * Build complete KQL query from filters
 */
export function buildKQL(filters: SearchFilters): string {
  const { standard, photo, term } = filters
  const parts = [
    ...buildStandardKQL(standard, term || ''),
    ...buildPhotoKQL(photo)
  ]
  return parts.length > 0 ? parts.join(' AND ') : '*'
}
