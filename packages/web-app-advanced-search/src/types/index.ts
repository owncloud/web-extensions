/**
 * Type definitions for the Advanced Search extension
 */

import type { Resource } from '@ownclouders/web-client'

/**
 * Extended Resource type with oCIS-specific properties
 * Used throughout the search extension for proper type safety
 */
export interface SearchResource extends Resource {
  /** Space/drive ID */
  spaceId?: string
  /** Drive alias (e.g., 'personal/home') */
  driveAlias?: string
  /** Parent folder ID */
  parentId?: string
  /** Parent reference object */
  parentReference?: {
    id?: string
    path?: string
  }
  /** Photo/EXIF metadata */
  photo?: {
    cameraMake?: string
    cameraModel?: string
    takenDateTime?: string
    fNumber?: number
    iso?: number
    focalLength?: number
    exposureNumerator?: number
    exposureDenominator?: number
    orientation?: number
  }
  /** GPS location data */
  location?: {
    latitude?: number
    longitude?: number
    altitude?: number
  }
  /** Last modified date (alternative property name) */
  lastModifiedDateTime?: string
}

/**
 * Available search scope options
 */
export type SearchScope = 'allFiles' | 'currentFolder' | 'space'

/**
 * Date range for filtering
 */
export interface DateRange {
  start: string  // ISO date string (YYYY-MM-DD)
  end: string    // ISO date string (YYYY-MM-DD)
}

/**
 * Numeric range for filtering
 */
export interface NumericRange {
  min?: number
  max?: number
}

/**
 * Standard oCIS search filters
 */
export interface StandardFilters {
  /** File name pattern (supports wildcards * and ?) */
  name?: string
  /** File or folder type */
  type?: 'file' | 'folder' | ''
  /** Size range in bytes */
  sizeRange?: NumericRange
  /** Modified date range */
  modifiedRange?: DateRange
  /** MIME type filter (e.g., 'image/*', 'application/pdf') */
  mediaType?: string
  /** Tags filter (comma-separated) */
  tags?: string
  /** Full-text content search */
  content?: string
  /** Include hidden files */
  includeHidden?: boolean
}

/**
 * Photo/EXIF-specific filters (requires custom oCIS build)
 */
export interface PhotoFilters {
  /** Camera manufacturer (e.g., 'Canon', 'Nikon', 'samsung') */
  cameraMake?: string
  /** Camera model (e.g., 'EOS R5', 'SM-G998B') */
  cameraModel?: string
  /** Photo capture date range */
  takenDateRange?: DateRange
  /** ISO sensitivity range */
  isoRange?: NumericRange
  /** Aperture f-number range */
  fNumberRange?: NumericRange
  /** Focal length range in mm */
  focalLengthRange?: NumericRange
  /** Image orientation (1-8 per EXIF spec) */
  orientation?: number
}

/**
 * Combined filter state for advanced search
 */
export interface SearchFilters {
  /** Basic text search term */
  term?: string
  /** Search scope (where to search) */
  scope: SearchScope
  /** Standard file filters */
  standard: StandardFilters
  /** Photo/EXIF filters */
  photo: PhotoFilters
}

/**
 * A single active filter for display as a chip
 */
export interface ActiveFilter {
  /** Unique identifier for the filter */
  id: string
  /** Display label for the filter */
  label: string
  /** The KQL field name */
  field: string
  /** The filter value (for display) */
  value: string
  /** Category for grouping (standard, photo, text) */
  category: 'standard' | 'photo' | 'text'
}

/**
 * Search result with pagination info
 */
export interface SearchResults {
  /** Total number of matching items */
  totalCount: number | null
  /** The matching resources */
  items: Resource[]
  /** Whether more results are available */
  hasMore: boolean
  /** Current page number (0-indexed) */
  currentPage: number
}

/**
 * Saved search query
 */
export interface SavedQuery {
  /** Unique ID */
  id: string
  /** User-friendly name */
  name: string
  /** The filter configuration */
  filters: SearchFilters
  /** When the query was saved */
  savedAt: string
}

/**
 * View mode for results display
 */
export type ResultViewMode = 'list' | 'grid' | 'table'

/**
 * Sort configuration
 */
export interface SortConfig {
  field: 'name' | 'size' | 'mtime' | 'takenDateTime'
  direction: 'asc' | 'desc'
}

/**
 * State for the advanced search composable
 */
export interface AdvancedSearchState {
  /** Current filter configuration */
  filters: SearchFilters
  /** Search results */
  results: SearchResults | null
  /** Loading state */
  loading: boolean
  /** Error message if any */
  error: string | null
  /** Built KQL query string (for debugging/display) */
  kqlQuery: string
  /** Result view mode */
  viewMode: ResultViewMode
  /** Sort configuration */
  sort: SortConfig
}

/**
 * Known camera makes for autocomplete
 */
export const KNOWN_CAMERA_MAKES = [
  'Apple',
  'Canon',
  'DJI',
  'Fujifilm',
  'GoPro',
  'Leica',
  'Nikon',
  'Olympus',
  'Panasonic',
  'Pentax',
  'samsung',
  'Sony',
] as const

/**
 * Media type keywords supported by oCIS KQL compiler
 * The compiler expands these to proper mime type queries server-side
 */
export const COMMON_MEDIA_TYPES = [
  { label: 'All Files', value: '' },
  { label: 'Images', value: 'image' },           // expands to image/*
  { label: 'Videos', value: 'video' },           // expands to video/*
  { label: 'Audio', value: 'audio' },            // expands to audio/*
  { label: 'Documents', value: 'document' },     // expands to Word, ODT, text, etc.
  { label: 'Spreadsheets', value: 'spreadsheet' }, // expands to Excel, ODS, CSV
  { label: 'Presentations', value: 'presentation' }, // expands to PPT, ODP
  { label: 'PDFs', value: 'pdf' },               // expands to application/pdf
  { label: 'Archives', value: 'archive' },       // expands to zip, tar, etc.
  { label: 'Folders', value: 'folder' },         // directories only
] as const

/**
 * Default/empty filter state
 */
export function createEmptyFilters(): SearchFilters {
  return {
    term: '',
    scope: 'allFiles',
    standard: {},
    photo: {},
  }
}

/**
 * Default search results
 */
export function createEmptyResults(): SearchResults {
  return {
    totalCount: null,
    items: [],
    hasMore: false,
    currentPage: 0,
  }
}
