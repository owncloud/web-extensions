/**
 * Composable for handling Google Photos JSON sidecar files
 * These contain metadata like photoTakenTime and geoData
 */

import type { Resource } from '@ownclouders/web-client'

export interface GeoData {
  latitude: number
  longitude: number
  altitude?: number
}

export interface PhotoMetadata {
  title?: string
  description?: string
  photoTakenTime?: {
    timestamp: string
    formatted?: string
  }
  geoData?: GeoData
  geoDataExif?: GeoData
  creationTime?: {
    timestamp: string
    formatted?: string
  }
}

export interface EnrichedPhoto extends Resource {
  metadata?: PhotoMetadata
  takenAt?: Date
  location?: GeoData
  hasMetadata?: boolean
}

/**
 * Validate that an object has a valid timestamp structure.
 */
function isValidTimestamp(obj: unknown): obj is { timestamp: string; formatted?: string } {
  return typeof obj === 'object' &&
    obj !== null &&
    'timestamp' in obj &&
    typeof (obj as any).timestamp === 'string'
}

/**
 * Validate that an object has valid GeoData structure.
 */
function isValidGeoData(obj: unknown): obj is GeoData {
  return typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as any).latitude === 'number' &&
    typeof (obj as any).longitude === 'number'
}

/**
 * Parse Google Photos JSON sidecar content with validation.
 * Validates that the parsed JSON is a proper object and has expected structure.
 */
export function parseSidecarJson(jsonContent: string): PhotoMetadata | null {
  try {
    const data = JSON.parse(jsonContent)

    // Validate that data is a non-null object (not array, string, number, etc.)
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      if (import.meta.env.DEV) {
        console.warn('Sidecar JSON is not a valid object')
      }
      return null
    }

    // Type-safe extraction with validation
    return {
      title: typeof data.title === 'string' ? data.title : undefined,
      description: typeof data.description === 'string' ? data.description : undefined,
      photoTakenTime: isValidTimestamp(data.photoTakenTime) ? data.photoTakenTime : undefined,
      geoData: isValidGeoData(data.geoData) ? data.geoData : undefined,
      geoDataExif: isValidGeoData(data.geoDataExif) ? data.geoDataExif : undefined,
      creationTime: isValidTimestamp(data.creationTime) ? data.creationTime : undefined
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('Failed to parse sidecar JSON:', e)
    }
    return null
  }
}

/**
 * Sidecar filename patterns used by Google Photos/Takeout:
 * - photo.jpg.json (standard)
 * - photo.jpg.supplemental-metadata.json (Google Takeout)
 * - photo.jpg.suppl.json (shortened version)
 */
const SIDECAR_PATTERNS = [
  /^(.+\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|mov))\.json$/i,
  /^(.+\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|mov))\.supplemental-metadata\.json$/i,
  /^(.+\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|mov))\.suppl\.json$/i,
]

/**
 * Get the expected sidecar filenames for an image (multiple patterns)
 */
export function getSidecarFilenames(imageFilename: string): string[] {
  return [
    `${imageFilename}.json`,
    `${imageFilename}.supplemental-metadata.json`,
    `${imageFilename}.suppl.json`
  ]
}

/**
 * Check if a filename is a sidecar JSON file
 */
export function isSidecarFile(filename: string): boolean {
  return SIDECAR_PATTERNS.some(pattern => pattern.test(filename))
}

/**
 * Get the image filename from a sidecar filename
 */
export function getImageFromSidecar(sidecarFilename: string): string | null {
  for (const pattern of SIDECAR_PATTERNS) {
    const match = sidecarFilename.match(pattern)
    if (match) {
      return match[1] // First capture group is the image filename
    }
  }
  return null
}

/**
 * Extract the actual photo date from metadata
 * Prioritizes: photoTakenTime > creationTime > file mdate
 */
export function getPhotoDate(photo: EnrichedPhoto): Date {
  // Use photoTakenTime if available (actual capture time)
  if (photo.metadata?.photoTakenTime?.timestamp) {
    const ts = parseInt(photo.metadata.photoTakenTime.timestamp)
    if (!isNaN(ts)) {
      return new Date(ts * 1000)
    }
  }

  // Fall back to creationTime
  if (photo.metadata?.creationTime?.timestamp) {
    const ts = parseInt(photo.metadata.creationTime.timestamp)
    if (!isNaN(ts)) {
      return new Date(ts * 1000)
    }
  }

  // Fall back to file modification date
  if (photo.mdate) {
    return new Date(photo.mdate)
  }

  return new Date()
}

/**
 * Get location from metadata
 */
export function getPhotoLocation(photo: EnrichedPhoto): GeoData | null {
  // Prefer geoDataExif (more accurate) over geoData
  const geo = photo.metadata?.geoDataExif || photo.metadata?.geoData

  if (geo && geo.latitude !== 0 && geo.longitude !== 0) {
    return geo
  }

  return null
}

/**
 * Build a map of sidecar files keyed by lowercase image filename.
 *
 * IMPORTANT: Keys are normalized to lowercase for case-insensitive matching.
 * Use findSidecar() for lookups to ensure proper case normalization.
 *
 * @param files - Array of Resource objects to scan for sidecar files
 * @returns Map with lowercase image names as keys and sidecar Resources as values
 */
export function buildSidecarMap(files: Resource[]): Map<string, Resource> {
  const sidecarMap = new Map<string, Resource>()

  for (const file of files) {
    if (file.name && isSidecarFile(file.name)) {
      const imageName = getImageFromSidecar(file.name)
      if (imageName) {
        // Key by lowercase for case-insensitive matching
        sidecarMap.set(imageName.toLowerCase(), file)
      }
    }
  }

  return sidecarMap
}

/**
 * Look up sidecar file for an image (handles case normalization).
 * Use this instead of directly accessing the map to ensure consistent case handling.
 *
 * @param sidecarMap - Map built by buildSidecarMap
 * @param imageName - The image filename to look up
 * @returns The sidecar Resource if found, undefined otherwise
 */
export function findSidecar(
  sidecarMap: Map<string, Resource>,
  imageName: string
): Resource | undefined {
  return sidecarMap.get(imageName.toLowerCase())
}

export function useSidecar() {
  return {
    parseSidecarJson,
    getSidecarFilenames,
    isSidecarFile,
    getImageFromSidecar,
    getPhotoDate,
    getPhotoLocation,
    buildSidecarMap,
    findSidecar
  }
}
