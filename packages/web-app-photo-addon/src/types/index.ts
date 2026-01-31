/**
 * Shared type definitions for the oCIS photo addon.
 *
 * Type Hierarchy:
 * - Resource (from @ownclouders/web-client) - base file/folder type
 *   └── PhotoWithDate - extended with EXIF metadata and computed fields
 *       └── PhotoSubGroup - grouped photos (stacks) for display
 *
 * Data Flow:
 * 1. Graph API returns DriveItem with photo metadata (GraphDriveItem)
 * 2. Items are converted to PhotoWithDate with extracted EXIF fields
 * 3. Photos are grouped into PhotoSubGroup for UI rendering
 */

import type { Resource } from '@ownclouders/web-client'

/**
 * GPS coordinates from EXIF data.
 *
 * Extracted from EXIF GPS tags:
 * - GPSLatitude/GPSLatitudeRef → latitude (positive = N, negative = S)
 * - GPSLongitude/GPSLongitudeRef → longitude (positive = E, negative = W)
 * - GPSAltitude/GPSAltitudeRef → altitude in meters (above/below sea level)
 */
export interface GeoCoordinates {
  latitude?: number   // Decimal degrees (-90 to 90)
  longitude?: number  // Decimal degrees (-180 to 180)
  altitude?: number   // Meters above sea level
}

/**
 * Photo metadata from EXIF data, exposed via Graph API.
 *
 * These fields are extracted by Tika from EXIF/XMP metadata embedded
 * in image files. Not all photos have all fields (depends on camera).
 *
 * Field origins:
 * - cameraMake: EXIF Make tag (e.g., "Apple", "Samsung", "Canon")
 * - cameraModel: EXIF Model tag (e.g., "iPhone 14 Pro", "SM-S918B")
 * - fNumber: EXIF FNumber tag (aperture, e.g., 1.8, 2.8)
 * - focalLength: EXIF FocalLength in mm (e.g., 26, 50)
 * - iso: EXIF ISOSpeedRatings (e.g., 100, 800, 3200)
 * - orientation: EXIF Orientation tag (1-8, describes rotation)
 * - takenDateTime: EXIF DateTimeOriginal in ISO 8601 format
 * - exposureNumerator/Denominator: EXIF ExposureTime as fraction (e.g., 1/250)
 */
export interface GraphPhoto {
  cameraMake?: string
  cameraModel?: string
  fNumber?: number
  focalLength?: number
  iso?: number
  orientation?: number          // 1-8 per EXIF spec (1=normal, 6=90°CW, etc.)
  takenDateTime?: string        // ISO 8601: "2024-01-15T10:30:00Z"
  exposureNumerator?: number    // e.g., 1 for 1/250s
  exposureDenominator?: number  // e.g., 250 for 1/250s
  location?: GeoCoordinates
}

/**
 * Graph API DriveItem response
 */
export interface GraphDriveItem {
  id: string
  name: string
  file?: { mimeType: string }
  folder?: { childCount: number }
  photo?: GraphPhoto
  location?: GeoCoordinates
  lastModifiedDateTime?: string
  size?: number
  parentReference?: { driveId: string; id: string; path: string }
  webDavUrl?: string
}

/**
 * Graph API response wrapper
 */
export interface GraphResponse {
  value: GraphDriveItem[]
  '@odata.nextLink'?: string
}

/**
 * Extended Resource with photo-specific computed fields.
 *
 * This type bridges the base oCIS Resource (file metadata) with
 * photo-specific EXIF data extracted during loading.
 *
 * Field purposes:
 * - fileId: Unique identifier for caching and API calls
 * - filePath: Full path within the space (for display, breadcrumbs)
 * - webDavPath: Path for WebDAV operations (download, thumbnail)
 * - exifDate/exifTime: Formatted date/time strings for display
 * - timestamp: Unix milliseconds for sorting and grouping calculations
 * - dateSource: Debug field indicating EXIF source (see extractExifDateTime)
 * - graphPhoto: Original Graph API photo object (preserved for lightbox EXIF panel)
 *
 * Why store both exifDate/exifTime AND timestamp?
 * - timestamp: Fast numeric comparison for sorting/grouping (no parsing needed)
 * - exifDate/exifTime: Pre-formatted strings for display (no formatting needed)
 * - Duplication trades memory for CPU cycles in hot paths
 */
export interface PhotoWithDate extends Resource {
  fileId?: string         // Unique ID (from oc:fileid or generated)
  filePath?: string       // e.g., "/Photos/2024/January/IMG_001.jpg"
  webDavPath?: string     // e.g., "/dav/spaces/spaceid/Photos/..."
  exifDate?: string       // "YYYY-MM-DD" for display
  exifTime?: string       // "HH:MM:SS" for display
  timestamp?: number      // Unix ms for sorting (Date.getTime())
  dateSource?: string     // "photo.takenDateTime" | "mdate" | etc. (debug)
  graphPhoto?: GraphPhoto & { location?: GeoCoordinates }
}

/**
 * A sub-group (stack) of photos taken close together in time/location.
 *
 * Stacks are displayed as a single thumbnail with a count badge.
 * Clicking opens lightbox showing all photos in the stack.
 *
 * ID format: "group-{timestamp}-{count}"
 * - timestamp: Milliseconds of first (newest) photo in group
 * - count: Number of photos in the group
 *
 * Note: ID could theoretically collide if two groups have identical
 * timestamps and sizes, but this is rare in practice (would require
 * two separate stacks with same first photo time and same size).
 */
export interface PhotoSubGroup {
  id: string              // Unique identifier for Vue :key
  photos: PhotoWithDate[] // Photos in this stack (newest first)
  timestamp: number       // Timestamp of newest photo (for sorting groups)
}

/**
 * Group mode for date-based grouping
 */
export type GroupMode = 'day' | 'week' | 'month' | 'year'

/**
 * View type for the photos app
 */
export type ViewType = 'calendar' | 'map'

/**
 * Photo group - photos grouped by date
 */
export interface PhotoGroup {
  date: string  // Date key (format depends on GroupMode)
  photos: PhotoWithDate[]
}

/**
 * Plugin configuration
 */
export interface PhotoAddonConfig {
  supportedExtensions?: string[]
  thumbnailSize?: number
  gridColumns?: number
}

/**
 * Supported image extensions (actual photo formats only)
 */
export const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tiff', 'tif'
])
