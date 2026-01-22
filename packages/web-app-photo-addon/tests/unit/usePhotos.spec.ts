import { describe, it, expect } from 'vitest'
import { usePhotos } from '../../src/composables/usePhotos'
import type { Resource } from '@ownclouders/web-client'

// Helper to create mock resources for testing
// Uses 'as any' to allow partial mocks with flexible types in tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockResource = (props: Record<string, any>): Resource =>
  ({ path: '', ...props } as Resource)

describe('usePhotos', () => {
  const {
    isImage,
    filterImages,
    groupByDate,
    getDateKey,
    formatDateKey,
    parseExifDate,
    getISOWeek,
    calculateDistance,
    formatSize,
    formatDate,
    getPhotoDate,
    getExifDate
  } = usePhotos()

  describe('isImage', () => {
    it('should identify jpg files as images', () => {
      expect(isImage(mockResource({ id: '1', name: 'photo.jpg' }))).toBe(true)
      expect(isImage(mockResource({ id: '2', name: 'photo.JPEG' }))).toBe(true)
      expect(isImage(mockResource({ id: '3', name: 'photo.JPG' }))).toBe(true)
    })

    it('should identify png files as images', () => {
      expect(isImage(mockResource({ id: '1', name: 'image.png' }))).toBe(true)
      expect(isImage(mockResource({ id: '2', name: 'image.PNG' }))).toBe(true)
    })

    it('should identify other image formats', () => {
      expect(isImage(mockResource({ id: '1', name: 'photo.gif' }))).toBe(true)
      expect(isImage(mockResource({ id: '2', name: 'photo.webp' }))).toBe(true)
      expect(isImage(mockResource({ id: '3', name: 'photo.heic' }))).toBe(true)
      expect(isImage(mockResource({ id: '4', name: 'photo.heif' }))).toBe(true)
      expect(isImage(mockResource({ id: '5', name: 'photo.tiff' }))).toBe(true)
      expect(isImage(mockResource({ id: '6', name: 'photo.tif' }))).toBe(true)
    })

    it('should identify files by MIME type', () => {
      expect(isImage(mockResource({ id: '1', name: 'file', mimeType: 'image/jpeg' }))).toBe(true)
      expect(isImage(mockResource({ id: '2', name: 'file', mimeType: 'image/png' }))).toBe(true)
      expect(isImage(mockResource({ id: '3', name: 'file', mimeType: 'image/gif' }))).toBe(true)
      expect(isImage(mockResource({ id: '4', name: 'file', mimeType: 'image/webp' }))).toBe(true)
    })

    it('should reject non-image files', () => {
      expect(isImage(mockResource({ id: '1', name: 'document.pdf' }))).toBe(false)
      expect(isImage(mockResource({ id: '2', name: 'video.mp4' }))).toBe(false)
      expect(isImage(mockResource({ id: '3', name: 'readme.txt' }))).toBe(false)
      expect(isImage(mockResource({ id: '4', name: 'data.json' }))).toBe(false)
      expect(isImage(mockResource({ id: '5', name: 'config.xml' }))).toBe(false)
    })

    it('should reject SVG and icon files', () => {
      expect(isImage(mockResource({ id: '1', name: 'icon.svg', mimeType: 'image/svg+xml' }))).toBe(false)
      expect(isImage(mockResource({ id: '2', name: 'logo.svg', mimeType: 'image/svg+xml' }))).toBe(false)
      expect(isImage(mockResource({ id: '3', name: 'favicon.ico', mimeType: 'image/x-icon' }))).toBe(false)
    })

    it('should reject sidecar/metadata files with image-like names', () => {
      expect(isImage(mockResource({ id: '1', name: 'photo.jpg.json' }))).toBe(false)
      expect(isImage(mockResource({ id: '2', name: 'image.xml' }))).toBe(false)
      expect(isImage(mockResource({ id: '3', name: 'metadata.txt' }))).toBe(false)
    })
  })

  describe('filterImages', () => {
    it('should filter out non-image files', () => {
      const files = [
        mockResource({ id: '1', name: 'photo1.jpg' }),
        mockResource({ id: '2', name: 'document.pdf' }),
        mockResource({ id: '3', name: 'photo2.png' }),
        mockResource({ id: '4', name: 'folder', type: 'folder' }),
      ]

      const result = filterImages(files)

      expect(result).toHaveLength(2)
      expect(result.map(f => f.name)).toEqual(['photo1.jpg', 'photo2.png'])
    })

    it('should exclude folders', () => {
      const files = [
        mockResource({ id: '1', name: 'Photos', type: 'folder' }),
        mockResource({ id: '2', name: 'photo.jpg' }),
      ]

      const result = filterImages(files)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('photo.jpg')
    })

    it('should exclude folders by isFolder property', () => {
      const files = [
        mockResource({ id: '1', name: 'Photos', isFolder: true }),
        mockResource({ id: '2', name: 'photo.jpg' }),
      ]

      const result = filterImages(files)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('photo.jpg')
    })
  })

  describe('parseExifDate', () => {
    it('should parse EXIF format "YYYY:MM:DD HH:MM:SS"', () => {
      const result = parseExifDate('2024:06:15 14:30:45')
      expect(result).toBeInstanceOf(Date)
      expect(result?.getFullYear()).toBe(2024)
      expect(result?.getMonth()).toBe(5) // 0-indexed
      expect(result?.getDate()).toBe(15)
      expect(result?.getHours()).toBe(14)
      expect(result?.getMinutes()).toBe(30)
      expect(result?.getSeconds()).toBe(45)
    })

    it('should parse ISO 8601 format', () => {
      const result = parseExifDate('2024-06-15T14:30:45Z')
      expect(result).toBeInstanceOf(Date)
      expect(result?.getFullYear()).toBe(2024)
      expect(result?.getMonth()).toBe(5)
      expect(result?.getDate()).toBe(15)
    })

    it('should parse Unix timestamp in seconds', () => {
      const timestamp = 1718456400 // 2024-06-15 14:00:00 UTC
      const result = parseExifDate(timestamp)
      expect(result).toBeInstanceOf(Date)
      expect(result?.getFullYear()).toBe(2024)
    })

    it('should parse Unix timestamp in milliseconds', () => {
      const timestamp = 1718456400000 // 2024-06-15 14:00:00 UTC
      const result = parseExifDate(timestamp)
      expect(result).toBeInstanceOf(Date)
      expect(result?.getFullYear()).toBe(2024)
    })

    it('should parse timestamp object', () => {
      const result = parseExifDate({ timestamp: '1718456400' })
      expect(result).toBeInstanceOf(Date)
      expect(result?.getFullYear()).toBe(2024)
    })

    it('should return null for invalid input', () => {
      expect(parseExifDate(null)).toBeNull()
      expect(parseExifDate(undefined)).toBeNull()
      expect(parseExifDate('')).toBeNull()
      expect(parseExifDate('not a date')).toBeNull()
    })
  })

  describe('getISOWeek', () => {
    it('should return correct week number for first week of year', () => {
      const date = new Date(2024, 0, 1) // January 1, 2024
      expect(getISOWeek(date)).toBe(1)
    })

    it('should return correct week number for mid-year', () => {
      const date = new Date(2024, 5, 15) // June 15, 2024
      const week = getISOWeek(date)
      expect(week).toBeGreaterThanOrEqual(24)
      expect(week).toBeLessThanOrEqual(25)
    })

    it('should return correct week number for end of year', () => {
      const date = new Date(2024, 11, 31) // December 31, 2024
      const week = getISOWeek(date)
      expect(week).toBeGreaterThanOrEqual(1)
      expect(week).toBeLessThanOrEqual(53)
    })
  })

  describe('getDateKey', () => {
    it('should format date as YYYY-MM-DD for day mode', () => {
      // Use explicit local date to avoid timezone issues
      const date = new Date(2026, 0, 10, 12, 0, 0) // Jan 10, 2026 at noon local time
      const file = mockResource({ id: '1', name: 'photo.jpg', mdate: date.getTime() })
      expect(getDateKey(file, 'day')).toBe('2026-01-10')
    })

    it('should format date as YYYY-MM for month mode', () => {
      const date = new Date(2026, 0, 10, 12, 0, 0)
      const file = mockResource({ id: '1', name: 'photo.jpg', mdate: date.getTime() })
      expect(getDateKey(file, 'month')).toBe('2026-01')
    })

    it('should format date as YYYY for year mode', () => {
      const date = new Date(2026, 0, 10, 12, 0, 0)
      const file = mockResource({ id: '1', name: 'photo.jpg', mdate: date.getTime() })
      expect(getDateKey(file, 'year')).toBe('2026')
    })

    it('should format date as YYYY-Wnn for week mode', () => {
      const date = new Date(2026, 0, 10, 12, 0, 0)
      const file = mockResource({ id: '1', name: 'photo.jpg', mdate: date.getTime() })
      const key = getDateKey(file, 'week')
      expect(key).toMatch(/^2026-W\d{2}$/)
    })

    it('should handle mdate as fallback', () => {
      const date = new Date(2025, 11, 25, 12, 0, 0) // Dec 25, 2025 at noon local time
      const file = mockResource({ id: '1', name: 'photo.jpg', mdate: date.getTime() })
      expect(getDateKey(file)).toBe('2025-12-25')
    })

    it('should use EXIF date when available', () => {
      const mdateDate = new Date(2026, 0, 1, 12, 0, 0)
      const file = mockResource({
        id: '1',
        name: 'photo.jpg',
        mdate: mdateDate.getTime(),
        photo: { takenDateTime: '2025-06-15T10:30:00Z' }
      })
      // Note: The EXIF date is in UTC, getDateKey will convert to local timezone
      const result = getDateKey(file)
      expect(result).toMatch(/^2025-06-1[45]$/) // Allow for timezone variations
    })
  })

  describe('formatDateKey', () => {
    it('should format day key with full date', () => {
      const result = formatDateKey('2026-01-15', 'day')
      expect(result).toContain('2026')
      expect(result).toContain('January') // or localized month
    })

    it('should return "Today" for today\'s date', () => {
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      const key = `${year}-${month}-${day}`
      expect(formatDateKey(key, 'day')).toBe('Today')
    })

    it('should return "Yesterday" for yesterday\'s date', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const year = yesterday.getFullYear()
      const month = String(yesterday.getMonth() + 1).padStart(2, '0')
      const day = String(yesterday.getDate()).padStart(2, '0')
      const key = `${year}-${month}-${day}`
      expect(formatDateKey(key, 'day')).toBe('Yesterday')
    })

    it('should format month key', () => {
      const result = formatDateKey('2026-06', 'month')
      expect(result).toContain('2026')
    })

    it('should return year directly for year mode', () => {
      expect(formatDateKey('2026', 'year')).toBe('2026')
    })
  })

  describe('groupByDate', () => {
    it('should group photos by date', () => {
      // Use explicit local dates to avoid timezone issues
      const photos = [
        mockResource({ id: '1', name: 'a.jpg', mdate: new Date(2026, 0, 10, 12, 0, 0).getTime() }),
        mockResource({ id: '2', name: 'b.jpg', mdate: new Date(2026, 0, 10, 14, 0, 0).getTime() }),
        mockResource({ id: '3', name: 'c.jpg', mdate: new Date(2026, 0, 9, 12, 0, 0).getTime() }),
      ]

      const result = groupByDate(photos)

      expect(result.size).toBe(2)
      expect(result.get('2026-01-10')).toHaveLength(2)
      expect(result.get('2026-01-09')).toHaveLength(1)
    })

    it('should sort groups newest first', () => {
      const photos = [
        mockResource({ id: '1', name: 'a.jpg', mdate: new Date(2026, 0, 8, 12, 0, 0).getTime() }),
        mockResource({ id: '2', name: 'b.jpg', mdate: new Date(2026, 0, 10, 12, 0, 0).getTime() }),
        mockResource({ id: '3', name: 'c.jpg', mdate: new Date(2026, 0, 9, 12, 0, 0).getTime() }),
      ]

      const result = groupByDate(photos)
      const dates = Array.from(result.keys())

      expect(dates).toEqual(['2026-01-10', '2026-01-09', '2026-01-08'])
    })

    it('should group by month when mode is month', () => {
      const photos = [
        mockResource({ id: '1', name: 'a.jpg', mdate: new Date(2026, 0, 5, 12, 0, 0).getTime() }),
        mockResource({ id: '2', name: 'b.jpg', mdate: new Date(2026, 0, 25, 12, 0, 0).getTime() }),
        mockResource({ id: '3', name: 'c.jpg', mdate: new Date(2026, 1, 10, 12, 0, 0).getTime() }),
      ]

      const result = groupByDate(photos, 'month')

      expect(result.size).toBe(2)
      expect(result.get('2026-01')).toHaveLength(2)
      expect(result.get('2026-02')).toHaveLength(1)
    })

    it('should group by year when mode is year', () => {
      const photos = [
        mockResource({ id: '1', name: 'a.jpg', mdate: new Date(2026, 0, 5, 12, 0, 0).getTime() }),
        mockResource({ id: '2', name: 'b.jpg', mdate: new Date(2026, 11, 25, 12, 0, 0).getTime() }),
        mockResource({ id: '3', name: 'c.jpg', mdate: new Date(2025, 5, 10, 12, 0, 0).getTime() }),
      ]

      const result = groupByDate(photos, 'year')

      expect(result.size).toBe(2)
      expect(result.get('2026')).toHaveLength(2)
      expect(result.get('2025')).toHaveLength(1)
    })
  })

  describe('calculateDistance', () => {
    it('should return 0 for same coordinates', () => {
      const distance = calculateDistance(43.6532, -79.3832, 43.6532, -79.3832)
      expect(distance).toBe(0)
    })

    it('should calculate distance between two points', () => {
      // Toronto to Montreal is approximately 505 km
      const distance = calculateDistance(43.6532, -79.3832, 45.5017, -73.5673)
      expect(distance).toBeGreaterThan(500000) // More than 500 km
      expect(distance).toBeLessThan(600000) // Less than 600 km
    })

    it('should calculate short distances accurately', () => {
      // Two points about 1 km apart
      const distance = calculateDistance(43.6532, -79.3832, 43.6622, -79.3832)
      expect(distance).toBeGreaterThan(900) // More than 900 m
      expect(distance).toBeLessThan(1100) // Less than 1100 m
    })
  })

  describe('formatSize', () => {
    it('should format bytes', () => {
      expect(formatSize(500)).toBe('500 B')
      expect(formatSize(1023)).toBe('1023 B')
    })

    it('should format kilobytes', () => {
      expect(formatSize(1024)).toBe('1.0 KB')
      expect(formatSize(2048)).toBe('2.0 KB')
      expect(formatSize(1536)).toBe('1.5 KB')
    })

    it('should format megabytes', () => {
      expect(formatSize(1024 * 1024)).toBe('1.0 MB')
      expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB')
      expect(formatSize(1.5 * 1024 * 1024)).toBe('1.5 MB')
    })

    it('should format gigabytes', () => {
      expect(formatSize(1024 * 1024 * 1024)).toBe('1.00 GB')
      expect(formatSize(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB')
    })
  })

  describe('formatDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date(2026, 0, 15) // January 15, 2026
      expect(formatDate(date)).toBe('2026-01-15')
    })

    it('should pad single-digit months and days', () => {
      const date = new Date(2026, 5, 5) // June 5, 2026
      expect(formatDate(date)).toBe('2026-06-05')
    })
  })

  describe('getPhotoDate', () => {
    it('should return EXIF date when available', () => {
      const file = mockResource({
        id: '1',
        name: 'photo.jpg',
        mdate: new Date('2026-01-01').getTime(),
        photo: { takenDateTime: '2025-06-15T10:30:00Z' }
      })
      const date = getPhotoDate(file)
      expect(date.getFullYear()).toBe(2025)
      expect(date.getMonth()).toBe(5) // June
    })

    it('should fall back to mdate when no EXIF', () => {
      const file = mockResource({
        id: '1',
        name: 'photo.jpg',
        mdate: new Date('2026-03-20').getTime()
      })
      const date = getPhotoDate(file)
      expect(date.getFullYear()).toBe(2026)
      expect(date.getMonth()).toBe(2) // March
    })

    it('should return current date as last resort', () => {
      const file = mockResource({ id: '1', name: 'photo.jpg' })
      const date = getPhotoDate(file)
      const now = new Date()
      expect(date.getFullYear()).toBe(now.getFullYear())
    })
  })

  describe('getExifDate', () => {
    it('should extract date from photo.takenDateTime', () => {
      const file = mockResource({
        id: '1',
        name: 'photo.jpg',
        photo: { takenDateTime: '2025-06-15T10:30:00Z' }
      })
      const date = getExifDate(file)
      expect(date).toBeInstanceOf(Date)
      expect(date?.getFullYear()).toBe(2025)
    })

    it('should return null when no EXIF date available', () => {
      const file = mockResource({ id: '1', name: 'photo.jpg' })
      expect(getExifDate(file)).toBeNull()
    })
  })
})
