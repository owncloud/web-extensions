/**
 * Composable for photo filtering and grouping operations
 * Works with oCIS Resource type from @ownclouders/web-client
 */

import type { Resource } from '@ownclouders/web-client'
import { IMAGE_EXTENSIONS, type GroupMode } from '../types'

export function usePhotos() {

  /**
   * Check if a file is an image based on MIME type (primary) and extension (fallback)
   */
  function isImage(file: Resource): boolean {
    const name = (file.name || '').toLowerCase()

    // Exclude metadata/sidecar files
    if (name.includes('.json') || name.includes('.xml') || name.includes('.txt')) {
      return false
    }

    // Check MIME type first (most reliable)
    if (file.mimeType) {
      const mime = file.mimeType.toLowerCase()
      if (!mime.startsWith('image/')) {
        return false
      }
      // Exclude SVG and icons - not photos
      if (mime.includes('svg') || mime.includes('icon')) {
        return false
      }
      return true
    }

    // Fallback: check extension
    const ext = name.split('.').pop() || ''
    return IMAGE_EXTENSIONS.has(ext)
  }

  /**
   * Filter a list of resources to only include images
   */
  function filterImages(files: Resource[]): Resource[] {
    return files.filter(file => {
      if (file.isFolder || file.type === 'folder') {
        return false
      }
      return isImage(file)
    })
  }

  /**
   * Extract EXIF date from a file resource
   * Priority:
   *   1. resource.photo.takenDateTime (official oCIS SDK field)
   *   2. Legacy/fallback property names
   * Returns null if no EXIF date is found
   */
  function getExifDate(file: Resource): Date | null {
    // Primary: Check official oCIS photo.takenDateTime field
    if (file.photo?.takenDateTime) {
      const parsed = parseExifDate(file.photo.takenDateTime)
      if (parsed) {
        return parsed
      }
    }

    // Fallback: Check legacy/alternate property locations
    const f = file as any
    const fallbackSources = [
      f.exifDateTimeOriginal,
      f.exifDate,
      f.dateTaken,
      f.photoTakenTime,
      f.dateTimeOriginal,
      f.metadata?.exifDateTimeOriginal,
      f.metadata?.dateTaken,
      f['oc:exif-date'],
      f['oc:date-taken'],
      f.exif?.DateTimeOriginal,
      f.exif?.DateTime,
    ]

    for (const source of fallbackSources) {
      if (source) {
        const parsed = parseExifDate(source)
        if (parsed) {
          return parsed
        }
      }
    }

    return null
  }

  /**
   * Unix timestamp threshold: Jan 1, 3000 in seconds.
   * Values below this are treated as seconds; above as milliseconds.
   * 32503680000 = new Date('3000-01-01T00:00:00Z').getTime() / 1000
   */
  const UNIX_SECONDS_THRESHOLD = 32503680000

  /**
   * Parse various EXIF date formats into a JavaScript Date object.
   *
   * Supported formats (in order of detection):
   * 1. Unix timestamp in seconds (e.g., 1609459200 → Jan 1, 2021)
   * 2. Unix timestamp in milliseconds (e.g., 1609459200000)
   * 3. Object with timestamp property: { timestamp: "1609459200" } (legacy Tika format)
   * 4. EXIF string format: "YYYY:MM:DD HH:MM:SS" (standard EXIF DateTimeOriginal)
   * 5. ISO 8601 or any format parseable by Date constructor
   *
   * The UNIX_SECONDS_THRESHOLD distinguishes seconds from milliseconds:
   * - Values below this are treated as seconds (year 3000 in Unix seconds)
   * - Values above are treated as milliseconds
   *
   * @param value - The date value in any supported format
   * @returns Parsed Date object, or null if parsing fails
   */
  function parseExifDate(value: any): Date | null {
    if (!value) return null

    // Format 1 & 2: Unix timestamp (seconds or milliseconds)
    if (typeof value === 'number') {
      if (value < UNIX_SECONDS_THRESHOLD) {
        return new Date(value * 1000)
      }
      return new Date(value)
    }

    // Format 3: Legacy Tika extractor format { timestamp: "..." }
    if (typeof value === 'object' && value.timestamp) {
      const ts = parseInt(value.timestamp)
      if (!isNaN(ts)) {
        return new Date(ts * 1000)
      }
    }

    // Format 4 & 5: String formats
    if (typeof value === 'string') {
      // EXIF standard format uses colons in date: "2021:01:15 14:30:00"
      const exifMatch = value.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/)
      if (exifMatch) {
        const [, year, month, day, hour, min, sec] = exifMatch
        return new Date(
          parseInt(year),
          parseInt(month) - 1,  // JS months are 0-indexed
          parseInt(day),
          parseInt(hour),
          parseInt(min),
          parseInt(sec)
        )
      }

      // Try ISO 8601 or other formats parseable by Date constructor
      const parsed = new Date(value)
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
    }

    return null
  }

  /**
   * Get the best available date for a photo
   * Priority: 1) EXIF data, 2) File modification date
   */
  function getPhotoDate(file: Resource): Date {
    const exifDate = getExifDate(file)
    if (exifDate) {
      return exifDate
    }

    if (file.mdate) {
      return new Date(file.mdate)
    }

    return new Date()
  }

  /**
   * Get date string based on grouping mode
   */
  function getDateKey(file: Resource, mode: GroupMode = 'day'): string {
    const date = getPhotoDate(file)

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    switch (mode) {
      case 'year':
        return `${year}`
      case 'month':
        return `${year}-${month}`
      case 'week':
        const weekNum = getISOWeek(date) ?? 1  // Default to week 1 for invalid dates
        return `${year}-W${String(weekNum).padStart(2, '0')}`
      case 'day':
      default:
        return `${year}-${month}-${day}`
    }
  }

  /**
   * Calculate ISO 8601 week number for a given date.
   *
   * ISO 8601 week rules:
   * - Weeks start on Monday (not Sunday)
   * - Week 1 is the week containing the first Thursday of the year
   * - Days before week 1 belong to the last week of the previous year
   *
   * Algorithm explanation:
   * 1. Convert to UTC to avoid timezone issues
   * 2. Map Sunday (0) to 7, keeping Mon=1...Sat=6 (ISO weekday numbering)
   * 3. Find the Thursday of the current week (Thursday determines the week's year)
   * 4. Calculate days since Jan 1 of that Thursday's year
   * 5. Divide by 7 (86400000ms/day) and round up for week number
   *
   * @param date - The date to get the week number for
   * @returns ISO week number (1-53), or null for invalid dates
   */
  function getISOWeek(date: Date): number | null {
    // Validate input date - return null for invalid dates to allow caller to handle
    if (!date || isNaN(date.getTime())) {
      return null
    }
    // Use UTC to avoid timezone-related date shifts
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    // ISO weekday: Mon=1, Tue=2, ..., Sun=7 (JS getUTCDay returns Sun=0)
    const dayNum = d.getUTCDay() || 7
    // Move to Thursday of current week (Thursday determines the week's year)
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    // January 1st of the Thursday's year
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    // Calculate week number: days since year start / 7, rounded up
    // 86400000 = milliseconds per day (24 * 60 * 60 * 1000)
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  /**
   * Get the start and end dates for a given ISO week.
   * Shared utility used by formatDateKey.
   *
   * @param year - The year
   * @param week - ISO week number (1-53)
   * @returns Object with start (Monday) and end (Sunday) dates
   */
  function getWeekDateRange(year: number, week: number): { start: Date; end: Date } {
    // Find January 1st of the year
    const jan1 = new Date(year, 0, 1)
    // Calculate the Monday of the first week
    // ISO weeks start on Monday; Jan 1 could be any day
    const jan1DayOfWeek = jan1.getDay() || 7  // Convert Sunday (0) to 7
    // Days to add to get to Monday of week 1
    const daysToWeek1Monday = (1 - jan1DayOfWeek)
    // Calculate the Monday of the requested week
    const startDate = new Date(year, 0, 1 + daysToWeek1Monday + (week - 1) * 7)
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6)
    return { start: startDate, end: endDate }
  }

  /**
   * Format date key for display based on mode
   */
  function formatDateKey(dateKey: string, mode: GroupMode): string {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    switch (mode) {
      case 'year':
        return dateKey
      case 'month': {
        const [year, month] = dateKey.split('-').map(Number)
        const date = new Date(year, month - 1, 1)
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
      }
      case 'week': {
        const [year, weekPart] = dateKey.split('-W')
        const weekNum = parseInt(weekPart)
        const { start: weekStart, end: weekEnd } = getWeekDateRange(parseInt(year), weekNum)
        return `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      }
      case 'day':
      default: {
        const [year, month, day] = dateKey.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        if (date.toDateString() === today.toDateString()) return 'Today'
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
        return date.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      }
    }
  }

  /**
   * Group photos by date with specified mode
   */
  function groupByDate(photos: Resource[], mode: GroupMode = 'day'): Map<string, Resource[]> {
    const groups = new Map<string, Resource[]>()

    for (const photo of photos) {
      const dateKey = getDateKey(photo, mode)
      const existing = groups.get(dateKey) || []
      existing.push(photo)
      groups.set(dateKey, existing)
    }

    // Sort each group by time (newest first within each group)
    for (const [, groupPhotos] of groups) {
      groupPhotos.sort((a, b) => {
        const timeA = getPhotoDate(a).getTime()
        const timeB = getPhotoDate(b).getTime()
        return timeB - timeA
      })
    }

    // Sort by date key (newest first)
    const sortedEntries = Array.from(groups.entries())
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))

    return new Map(sortedEntries)
  }

  /**
   * Get photo count by date for statistics
   */
  function getPhotoCountsByDate(photos: Resource[]): Record<string, number> {
    const counts: Record<string, number> = {}

    for (const photo of photos) {
      const dateKey = getDateKey(photo)
      counts[dateKey] = (counts[dateKey] || 0) + 1
    }

    return counts
  }

  /**
   * Validate that a latitude value is within valid range.
   * @param lat - Latitude value to validate
   * @returns true if latitude is a valid number in [-90, 90]
   */
  function isValidLatitude(lat: number): boolean {
    return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90
  }

  /**
   * Validate that a longitude value is within valid range.
   * @param lon - Longitude value to validate
   * @returns true if longitude is a valid number in [-180, 180]
   */
  function isValidLongitude(lon: number): boolean {
    return typeof lon === 'number' && !isNaN(lon) && lon >= -180 && lon <= 180
  }

  /**
   * Calculate great-circle distance between two GPS coordinates using the Haversine formula.
   *
   * The Haversine formula calculates the shortest distance over the Earth's surface
   * (the "as-the-crow-flies" distance), accounting for the Earth's spherical shape.
   *
   * Formula: a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
   *          c = 2 × atan2(√a, √(1−a))
   *          d = R × c
   *
   * Accuracy: ~0.5% error due to Earth being an oblate spheroid, not a perfect sphere.
   * For photo clustering purposes (comparing distances of ~100m to ~10km), this is sufficient.
   *
   * @param lat1 - Latitude of first point in degrees
   * @param lon1 - Longitude of first point in degrees
   * @param lat2 - Latitude of second point in degrees
   * @param lon2 - Longitude of second point in degrees
   * @returns Distance in meters, or Infinity for invalid coordinates
   */
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Validate coordinate ranges - return Infinity for invalid to prevent clustering
    if (!isValidLatitude(lat1) || !isValidLatitude(lat2)) {
      return Infinity
    }
    if (!isValidLongitude(lon1) || !isValidLongitude(lon2)) {
      return Infinity
    }

    // Earth's mean radius in meters (WGS84 approximation)
    const R = 6371000
    // Convert degree differences to radians
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    // Haversine formula
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * Format file size for display
   */
  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  /**
   * Format date for display
   */
  function formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return {
    isImage,
    filterImages,
    groupByDate,
    getDateKey,
    formatDateKey,
    getPhotoCountsByDate,
    getPhotoDate,
    getExifDate,
    parseExifDate,
    getISOWeek,
    calculateDistance,
    formatSize,
    formatDate,
    IMAGE_EXTENSIONS: Array.from(IMAGE_EXTENSIONS)
  }
}

export type { GroupMode }
