<template>
  <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
  <div
    v-if="photo"
    ref="lightboxRef"
    class="lightbox-overlay"
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="lightbox-title"
    @click.self="closeIfNoMenu"
    @keydown.escape="close"
    @keydown.tab="handleTabKey"
  >
    <!-- Context Menu (inside overlay for proper stacking) -->
    <div v-if="menuVisible" class="lightbox-context-menu" :style="{ top: menuTop, left: menuLeft }" role="menu" tabindex="-1" :aria-label="$gettext('Photo options')" @click.stop @keydown.escape.stop="closeMenuAndFocusButton">
      <button ref="firstMenuItemRef" class="oc-button-reset lbmenu-item" role="menuitem" @click="handleMenuAction('download')">
        <span class="oc-icon oc-icon-m oc-icon-passive" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 19H21V21H3V19ZM13 13.172L19.071 7.1L20.485 8.514L12 17L3.515 8.514L4.929 7.1L11 13.172V2H13V13.172Z" /></svg></span>
        <span>{{ $gettext('Download') }}</span>
      </button>
      <button class="oc-button-reset lbmenu-item" role="menuitem" @click="handleMenuAction('openInFiles')">
        <span class="oc-icon oc-icon-m oc-icon-passive" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M10 6V8H5V19H16V14H18V20C18 20.5523 17.5523 21 17 21H4C3.44772 21 3 20.5523 3 20V7C3 6.44772 3.44772 6 4 6H10ZM21 3V11H19V6.413L11.207 14.207L9.793 12.793L17.585 5H13V3H21Z" /></svg></span>
        <span>{{ $gettext('Open in Files') }}</span>
      </button>
      <button class="oc-button-reset lbmenu-item" role="menuitem" @click="handleMenuAction('copyLink')">
        <span class="oc-icon oc-icon-m oc-icon-passive" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 7H13V5H17C19.7614 5 22 7.23858 22 10C22 12.7614 19.7614 15 17 15H13V13H17C18.6569 13 20 11.6569 20 10C20 8.34315 18.6569 7 17 7ZM7 17H11V19H7C4.23858 19 2 16.7614 2 14C2 11.2386 4.23858 9 7 9H11V11H7C5.34315 11 4 12.3431 4 14C4 15.6569 5.34315 17 7 17ZM8 13H16V11H8V13Z" /></svg></span>
        <span>{{ $gettext('Copy Link') }}</span>
      </button>
      <div class="lbmenu-divider" role="separator"></div>
      <button class="oc-button-reset lbmenu-item lbmenu-item-danger" role="menuitem" @click="handleMenuAction('delete')">
        <span class="oc-icon oc-icon-m oc-icon-passive" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM18 8H6V20H18V8ZM9 11H11V17H9V11ZM13 11H15V17H13V11ZM9 4V6H15V4H9Z" /></svg></span>
        <span>{{ $gettext('Delete') }}</span>
      </button>
    </div>

    <div class="lightbox-container">
      <!-- Top right buttons -->
      <div class="lightbox-top-buttons">
        <button
          ref="menuButtonRef"
          type="button"
          class="lightbox-menu-btn"
          aria-haspopup="menu"
          :aria-expanded="menuVisible"
          :aria-label="$gettext('Photo options')"
          @click.stop="toggleMenu($event)"
        >
          <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 3C10.9 3 10 3.9 10 5C10 6.1 10.9 7 12 7C13.1 7 14 6.1 14 5C14 3.9 13.1 3 12 3ZM12 17C10.9 17 10 17.9 10 19C10 20.1 10.9 21 12 21C13.1 21 14 20.1 14 19C14 17.9 13.1 17 12 17ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z" /></svg>
        </button>
        <button ref="closeButtonRef" type="button" class="lightbox-close" :aria-label="$gettext('Close')" @click="close">
          <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 10.586L16.95 5.636L18.364 7.05L13.414 12L18.364 16.95L16.95 18.364L12 13.414L7.05 18.364L5.636 16.95L10.586 12L5.636 7.05L7.05 5.636L12 10.586Z" /></svg>
        </button>
      </div>

      <!-- Photo counter -->
      <div
        v-if="groupPhotos.length > 1"
        class="lightbox-counter"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        :aria-label="$gettext('Photo %{current} of %{total}').replace('%{current}', String(currentIndex + 1)).replace('%{total}', String(groupPhotos.length))"
      >
        {{ currentIndex + 1 }} / {{ groupPhotos.length }}
      </div>

      <!-- Main image with navigation inside - fixed size frame -->
      <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
      <div
        class="lightbox-image-container"
        role="img"
        :aria-label="photo?.name || 'Photo'"
        :style="{ width: frameWidth + 'px', height: frameHeight + 'px' }"
        @click="closeMenu"
        @keydown.enter="closeMenu"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <!-- Navigation: Previous (inside image container) -->
        <button
          v-if="canNavigatePrev"
          type="button"
          class="lightbox-nav lightbox-nav-prev"
          :aria-label="$gettext('Previous photo')"
          @click.stop="navigate('prev')"
        >
          <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10.828 12L15.778 16.95L14.364 18.364L8 12L14.364 5.636L15.778 7.05L10.828 12Z" /></svg>
        </button>

        <!-- Loading spinner while waiting for full-size image -->
        <div v-if="!fullSizeUrl" class="lightbox-loading">
          <span class="loading-spinner large"></span>
        </div>

        <!-- Error state - file could not be loaded -->
        <div v-else-if="isLoadError" class="lightbox-error">
          <span class="lightbox-error-icon">
            <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 14L7 16.5L10 13L13 17L15 14.5L18 15L15 12L13 14.5L10 9.5L6.5 13.25L3 10V2.9918C3 2.45531 3.44694 2 3.99826 2H14V8C14 8.55228 14.4477 9 15 9H21V20.9925C21 21.5511 20.5552 22 20.0066 22H3.9934C3.44495 22 3 21.556 3 21.0082V14ZM21 7H16V2.00318L21 7Z"></path>
            </svg>
          </span>
          <p class="lightbox-error-text">{{ $gettext('Failed to load "%{name}"').replace('%{name}', photo.name || '') }}</p>
        </div>

        <!-- Full-size image -->
        <img
          v-else
          :src="fullSizeUrl"
          :alt="photo.name || 'Photo'"
          class="lightbox-image"
        />

        <!-- Navigation: Next (inside image container) -->
        <button
          v-if="canNavigateNext"
          type="button"
          class="lightbox-nav lightbox-nav-next"
          :aria-label="$gettext('Next photo')"
          @click.stop="navigate('next')"
        >
          <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M13.172 12L8.222 7.05L9.636 5.636L16 12L9.636 18.364L8.222 16.95L13.172 12Z" /></svg>
        </button>
      </div>

      <!-- Bottom panel with metadata -->
      <div class="lightbox-panel">
        <div class="lightbox-header">
          <div class="lightbox-title-group">
            <h3 id="lightbox-title" class="lightbox-title">{{ photo.name || $gettext('Untitled') }}</h3>
            <span v-if="folderPath" class="lightbox-path">{{ folderPath }}</span>
          </div>
          <div v-if="photoTags.length > 0" class="lightbox-tags" :aria-label="$gettext('Tags')">
            <span v-for="tag in photoTags" :key="tag" class="oc-tag oc-tag-rounded oc-tag-s">{{ tag }}</span>
          </div>
        </div>

        <!-- EXIF Metadata section -->
        <div class="lightbox-metadata" role="region" :aria-label="$gettext('Photo metadata')">
          <div class="metadata-grid" role="list">
            <!-- Date Taken (with source indicator) -->
            <div v-if="displayDate" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ $gettext('Date Taken') }}</span>
              <span class="metadata-value date-with-source">
                {{ displayDate }}
                <span :class="['oc-tag oc-tag-s', isExifDate ? 'badge-exif' : 'badge-upload']">
                  {{ isExifDate ? $gettext('(EXIF)') : $gettext('(Mod time)') }}
                </span>
              </span>
            </div>

            <!-- EXIF: Camera -->
            <div v-if="exifData.cameraMake || exifData.cameraModel" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ $gettext('Camera') }}</span>
              <span class="metadata-value">{{ [exifData.cameraMake, exifData.cameraModel].filter(Boolean).join(' ') }}</span>
            </div>

            <!-- EXIF: Aperture -->
            <div v-if="exifData.fNumber" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ $gettext('Aperture') }}</span>
              <span class="metadata-value">f/{{ exifData.fNumber }}</span>
            </div>

            <!-- EXIF: Focal Length -->
            <div v-if="exifData.focalLength" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ $gettext('Focal Length') }}</span>
              <span class="metadata-value">{{ exifData.focalLength }}mm</span>
            </div>

            <!-- EXIF: ISO -->
            <div v-if="exifData.iso" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ $gettext('ISO') }}</span>
              <span class="metadata-value">{{ exifData.iso }}</span>
            </div>

            <!-- EXIF: Exposure -->
            <div v-if="exifData.exposureNumerator && exifData.exposureDenominator" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ $gettext('Exposure') }}</span>
              <span class="metadata-value">{{ exifData.exposureNumerator }}/{{ exifData.exposureDenominator }}s</span>
            </div>

            <!-- EXIF: Orientation -->
            <div v-if="exifData.orientation" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ $gettext('Orientation') }}</span>
              <span class="metadata-value">{{ getOrientationLabel(exifData.orientation) }}</span>
            </div>

            <!-- EXIF: Location (Lat/Long) -->
            <div v-if="exifData.location?.latitude != null && exifData.location?.longitude != null" class="metadata-item metadata-location" role="listitem" tabindex="0">
              <span class="metadata-label">{{ $gettext('Location') }}</span>
              <span class="metadata-value">
                {{ formatCoordinate(exifData.location.latitude, 'lat') }}, {{ formatCoordinate(exifData.location.longitude, 'lon') }}
                <a
                  :href="getMapUrl(exifData.location.latitude, exifData.location.longitude)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="map-link"
                  @click.stop
                >
                  {{ $gettext('View on Map') }}
                </a>
              </span>
            </div>

            <!-- EXIF: Altitude -->
            <div v-if="exifData.location?.altitude != null" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ $gettext('Altitude') }}</span>
              <span class="metadata-value">{{ exifData.location.altitude.toFixed(1) }}m</span>
            </div>

            <!-- File info -->
            <div v-if="photo.size" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ $gettext('File Size') }}</span>
              <span class="metadata-value">{{ formatSize(Number(photo.size)) }}</span>
            </div>

            <div v-if="photo.mimeType" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ $gettext('Type') }}</span>
              <span class="metadata-value">{{ photo.mimeType }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useClientService, useConfigStore } from '@ownclouders/web-pkg'
import type { Resource } from '@ownclouders/web-client'
import { usePhotos } from '../composables/usePhotos'
import { useTranslations } from '../composables/useTranslations'
import type { GraphPhoto, PhotoWithDate } from '../types'

// Initialize composable for shared utility functions
const { formatSize } = usePhotos()

// Initialize translations
const { $gettext, getUserLocale, getOrientationLabel } = useTranslations()

const props = withDefaults(defineProps<{
  photo: Resource | null
  groupPhotos?: Resource[]
  currentIndex?: number
  thumbnailCache?: Map<string, string>  // Thumbnail blob URLs from parent
}>(), {
  groupPhotos: () => [],
  currentIndex: 0,
  thumbnailCache: () => new Map()
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'navigate', direction: 'prev' | 'next'): void
  (e: 'action', action: string, photo: Resource): void
}>()

const clientService = useClientService()
const configStore = useConfigStore()

// Context menu state
const menuVisible = ref(false)
const menuTop = ref('0px')
const menuLeft = ref('0px')
const menuButtonRef = ref<HTMLButtonElement | null>(null)

// Focus management refs
const lightboxRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)
const firstMenuItemRef = ref<HTMLButtonElement | null>(null)

// Menu positioning is handled via CSS class + inline top/left

// Image loading state
const imageLoading = ref(true)

/**
 * LRU (Least Recently Used) cache configuration for image blob URLs.
 *
 * Cache sizes are tuned based on:
 * - Memory usage: Full-size images are 2-8MB each
 * - Navigation patterns: Users typically view 10-20 images per session
 * - Device constraints: Mobile devices have limited memory
 *
 * 15 full-size images ≈ 30-120MB memory (acceptable for modern devices)
 *
 * Adjust lower for memory-constrained environments (mobile),
 * or higher for desktop with more RAM.
 */
const MAX_FULL_SIZE_CACHE = 15

// Cache for loaded images (full-size) with LRU eviction
const imageCache = ref<Map<string, string>>(new Map())

/**
 * Evict oldest entries when cache exceeds max size (LRU eviction).
 *
 * Uses JavaScript Map's insertion-order iteration guarantee (ES2015+):
 * - Map.keys().next().value returns the first (oldest) inserted key
 * - Deleting and re-inserting a key moves it to the end (most recent)
 *
 * This provides O(1) insertion and eviction for a basic LRU cache.
 * For more sophisticated LRU (with access-order tracking), would need
 * to re-insert on every read, but that's overkill for this use case.
 *
 * @param cache - Map of photo IDs to blob URLs
 * @param maxSize - Maximum number of entries to keep
 */
function evictOldestFromCache(cache: Map<string, string>, maxSize: number) {
  while (cache.size > maxSize) {
    const firstKey = cache.keys().next().value
    if (firstKey) {
      const blobUrl = cache.get(firstKey)
      // Revoke blob URL to release memory (browser doesn't auto-cleanup)
      revokeBlobUrl(blobUrl)
      cache.delete(firstKey)
    }
  }
}

/**
 * Safely revoke a blob URL if it's a valid blob URL.
 * Extracted to avoid duplication across cleanup functions.
 *
 * @param url - The URL to potentially revoke
 */
function revokeBlobUrl(url: string | undefined): void {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

/**
 * Clear all entries from a blob URL cache, revoking each URL.
 *
 * @param cache - Map of IDs to blob URLs
 */
function clearBlobCache(cache: Map<string, string>): void {
  cache.forEach(revokeBlobUrl)
  cache.clear()
}

// Frame dimensions - calculated once when lightbox opens based on stack
const frameWidth = ref(800)
const frameHeight = ref(600)

/**
 * Calculate optimal lightbox frame size for a stack of images.
 *
 * EXIF Orientation Values (standard TIFF/EXIF specification):
 * ┌────┬─────────────────────────────────────────────────────────┐
 * │ 1  │ Normal (no rotation)                                    │
 * │ 2  │ Flipped horizontally                                    │
 * │ 3  │ Rotated 180°                                            │
 * │ 4  │ Flipped vertically                                      │
 * │ 5  │ Rotated 90° CW + flipped horizontally                   │
 * │ 6  │ Rotated 90° CW (portrait, phone held upright)           │
 * │ 7  │ Rotated 90° CCW + flipped horizontally                  │
 * │ 8  │ Rotated 90° CCW                                         │
 * └────┴─────────────────────────────────────────────────────────┘
 *
 * Orientations 5-8 indicate the image needs 90° rotation, meaning:
 * - Camera was held vertically (portrait mode)
 * - The stored image dimensions are swapped from display dimensions
 *
 * Aspect Ratio Selection:
 * - 3:4 (0.75) for portrait: Common phone camera ratio when vertical
 * - 4:3 (1.33) for landscape: Common point-and-shoot/phone horizontal ratio
 * - 1:1 for mixed: Safe fallback that displays both reasonably
 *
 * These ratios are chosen for maximum image area with minimal letterboxing.
 * Modern phones use various ratios (16:9, 4:3, 1:1), but 4:3 is most common
 * for actual photos (vs. video).
 */
function calculateFrameSize(photos: PhotoWithDate[]) {
  const maxWidth = Math.min(1200, Math.round(window.innerWidth * 0.9))
  // Reserve space for the metadata panel below the image (panel + padding + border)
  const panelHeight = 270
  const maxHeight = Math.min(700, Math.round(window.innerHeight * 0.9) - panelHeight)

  // Analyze orientation distribution in the stack
  let hasPortrait = false
  let hasLandscape = false

  for (const photo of photos) {
    const orientation = photo.graphPhoto?.orientation || 1
    // Orientations 5-8 indicate 90° rotation (portrait from landscape sensor)
    const isRotated = orientation >= 5 && orientation <= 8

    if (isRotated) {
      hasPortrait = true
    } else {
      hasLandscape = true
    }
  }

  // Select aspect ratio based on orientation mix
  let aspectRatio: number
  if (hasPortrait && !hasLandscape) {
    aspectRatio = 3 / 4  // Portrait-only: taller container
  } else if (hasLandscape && !hasPortrait) {
    aspectRatio = 4 / 3  // Landscape-only: wider container
  } else {
    aspectRatio = 1  // Mixed: square compromise
  }

  // Calculate dimensions that fit within max constraints
  let width = maxWidth
  let height = width / aspectRatio

  if (height > maxHeight) {
    height = maxHeight
    width = height * aspectRatio
  }

  frameWidth.value = Math.round(width)
  frameHeight.value = Math.round(height)
}

// Touch handling state
let touchStartX = 0
let touchStartY = 0
let touchMoved = false

// Cast to PhotoWithDate for accessing graphPhoto
const photoWithDate = computed(() => props.photo as PhotoWithDate | null)

// Get full-size image URL from local cache
const fullSizeUrl = computed(() => {
  if (!props.photo) return ''
  const photoId = props.photo.id || (props.photo as any).fileId || props.photo.name
  if (!photoId) return ''
  return imageCache.value.get(photoId) || ''
})

// Detect if the cached URL is an error placeholder (data: SVG) vs a real blob URL
const isLoadError = computed(() => {
  const url = fullSizeUrl.value
  return url !== '' && url.startsWith('data:')
})

// Extract EXIF data from graphPhoto
const exifData = computed<GraphPhoto>(() => {
  return photoWithDate.value?.graphPhoto || {}
})

// Extract tags from photo
const photoTags = computed<string[]>(() => {
  return photoWithDate.value?.tags || []
})

// Check if date comes from EXIF data
const isExifDate = computed(() => {
  return photoWithDate.value?.dateSource === 'photo.takenDateTime'
})

// Get display date - prefer EXIF takenDateTime, fallback to timestamp
const displayDate = computed(() => {
  const p = photoWithDate.value
  if (!p) return ''

  // If we have EXIF takenDateTime, use it
  if (p.graphPhoto?.takenDateTime) {
    return formatExifDate(p.graphPhoto.takenDateTime)
  }

  // Fallback to timestamp (from lastModifiedDateTime)
  if (p.timestamp) {
    return formatExifDate(new Date(p.timestamp).toISOString())
  }

  return ''
})

// Navigation computed
const canNavigatePrev = computed(() => props.groupPhotos.length > 1 && props.currentIndex > 0)
const canNavigateNext = computed(() => props.groupPhotos.length > 1 && props.currentIndex < props.groupPhotos.length - 1)

// Extract folder path (without filename) from photo's filePath
const folderPath = computed(() => {
  const p = props.photo as PhotoWithDate | null
  if (!p?.filePath) return ''
  // Remove filename from path
  const lastSlash = p.filePath.lastIndexOf('/')
  if (lastSlash <= 0) return '/'
  return p.filePath.substring(0, lastSlash + 1)
})

// Load current image immediately, then preload others in background
watch(() => props.photo, async (newPhoto, oldPhoto) => {
  if (newPhoto) {
    // Calculate frame size when lightbox first opens (oldPhoto was null)
    if (!oldPhoto && props.groupPhotos.length > 0) {
      calculateFrameSize(props.groupPhotos as PhotoWithDate[])
    }

    await loadCurrentImage(newPhoto as PhotoWithDate)

    // Focus close button when lightbox opens (for keyboard accessibility)
    if (!oldPhoto) {
      nextTick(() => {
        closeButtonRef.value?.focus()
      })
    }
  }
}, { immediate: true })

// Preload nearby images when navigating or group changes
watch([() => props.groupPhotos, () => props.currentIndex], ([photos, currentIdx]) => {
  if (photos.length > 1) {
    preloadNearbyImages(photos as PhotoWithDate[], currentIdx)
  }
}, { immediate: true })

// Create a nice placeholder SVG for files without thumbnails
function createPlaceholderSvg(filename: string, large = false): string {
  const ext = filename.split('.').pop()?.toUpperCase() || '?'
  const size = large ? 200 : 100
  const fontSize = large ? 24 : 12
  const iconScale = large ? 2 : 1

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <rect fill="%23222" width="${size}" height="${size}"/>
    <rect x="${25 * iconScale}" y="${35 * iconScale}" width="${50 * iconScale}" height="${35 * iconScale}" rx="${3 * iconScale}" fill="%23555"/>
    <circle cx="${50 * iconScale}" cy="${52 * iconScale}" r="${10 * iconScale}" fill="%23222"/>
    <circle cx="${50 * iconScale}" cy="${52 * iconScale}" r="${7 * iconScale}" fill="%23444"/>
    <rect x="${35 * iconScale}" y="${30 * iconScale}" width="${12 * iconScale}" height="${6 * iconScale}" rx="${1 * iconScale}" fill="%23555"/>
    <text x="${size / 2}" y="${large ? 170 : 85}" text-anchor="middle" fill="%23888" font-size="${fontSize}" font-family="system-ui, sans-serif" font-weight="600">${ext}</text>
    <text x="${size / 2}" y="${large ? 190 : 95}" text-anchor="middle" fill="%23666" font-size="${fontSize * 0.7}" font-family="system-ui, sans-serif">No preview</text>
  </svg>`

  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

function getPhotoUrl(photo: PhotoWithDate, preview = false): string | null {
  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')

  const filePath = (photo as any).filePath || (photo as any).path || photo.name || ''
  if (!filePath) return null

  let spaceId = (photo as any).parentReference?.driveId || ''
  if (!spaceId && photo.id) {
    const idParts = photo.id.split('!')
    if (idParts.length > 0) {
      spaceId = idParts[0]
    }
  }
  if (!spaceId) return null

  const encodedPath = filePath.split('/').map((segment: string) => encodeURIComponent(segment)).join('/')
  const baseUrl = `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}${encodedPath}`

  if (preview) {
    // Request preview matching lightbox frame dimensions with aspect ratio preserved
    return `${baseUrl}?preview=1&x=${frameWidth.value}&y=${frameHeight.value}&a=1`
  }
  return baseUrl
}

// Load the full-size image for the lightbox
async function loadCurrentImage(photo: PhotoWithDate) {
  if (!photo.id) {
    imageLoading.value = false
    return
  }

  // Check if full-size already cached
  if (imageCache.value.has(photo.id)) {
    imageLoading.value = false
    return
  }

  imageLoading.value = true

  // Load full-size image
  const fullUrl = getPhotoUrl(photo, false)
  if (fullUrl) {
    try {
      const response = await clientService.httpAuthenticated.get(fullUrl, {
        responseType: 'blob'
      } as any)
      const blob = response.data as Blob
      const blobUrl = URL.createObjectURL(blob)
      imageCache.value.set(photo.id!, blobUrl)
      evictOldestFromCache(imageCache.value, MAX_FULL_SIZE_CACHE)
    } catch {
      if (photo.id) {
        const filename = photo.name || 'unknown'
        imageCache.value.set(photo.id, createPlaceholderSvg(filename, true))
      }
    }
  }

  imageLoading.value = false
}

/**
 * Preload nearby images for instant navigation (bidirectional).
 *
 * Preload Strategy:
 * - PRELOAD_AHEAD = 2: Preload next 2 images (users typically browse forward)
 * - PRELOAD_BACK = 1: Preload previous 1 image (for "oops, go back" actions)
 * - MAX_CONCURRENT = 2: Limit parallel network requests to avoid congestion
 *
 * Why asymmetric (2 forward, 1 back)?
 * - User studies show forward navigation is 3-4x more common than backward
 * - Preloading too many wastes bandwidth if user closes lightbox early
 * - 2 ahead provides instant feel for typical "next, next, next" browsing
 * - 1 back handles the common "wait, let me see that again" case
 *
 * Why limit to 2 concurrent?
 * - Browser limits parallel connections per domain (typically 6)
 * - Reserving connections for the current image is more important
 * - On slow networks, too many parallel requests increase total latency
 * - Memory pressure from multiple large images decoding simultaneously
 *
 * Queue-based loading ensures:
 * - Requests complete in priority order (back, then forward)
 * - New requests wait for slots when all are busy
 * - Failed preloads don't block others
 */
function preloadNearbyImages(photos: PhotoWithDate[], currentIdx: number) {
  const PRELOAD_AHEAD = 2
  const PRELOAD_BACK = 1
  const MAX_CONCURRENT = 2

  // Build preload queue (back first, then forward)
  const toPreload: PhotoWithDate[] = []

  // Add backward photos first (will be loaded with higher priority)
  for (let i = 1; i <= PRELOAD_BACK; i++) {
    const backIdx = currentIdx - i
    if (backIdx >= 0) {
      const photo = photos[backIdx]
      if (photo.id && !imageCache.value.has(photo.id)) {
        toPreload.push(photo)
      }
    }
  }

  // Add forward photos
  for (let i = 1; i <= PRELOAD_AHEAD; i++) {
    const nextIdx = currentIdx + i
    if (nextIdx < photos.length) {
      const photo = photos[nextIdx]
      if (photo.id && !imageCache.value.has(photo.id)) {
        toPreload.push(photo)
      }
    }
  }

  if (toPreload.length === 0) return

  // Simple work queue with concurrency limit
  let activeLoads = 0
  const queue = [...toPreload]

  async function loadNext() {
    if (queue.length === 0 || activeLoads >= MAX_CONCURRENT) return

    const photo = queue.shift()!
    if (!photo.id || imageCache.value.has(photo.id)) {
      loadNext()  // Skip already-cached, try next
      return
    }

    activeLoads++
    const url = getPhotoUrl(photo)

    if (url) {
      try {
        const response = await clientService.httpAuthenticated.get(url, {
          responseType: 'blob'
        } as any)
        const blob = response.data as Blob
        const blobUrl = URL.createObjectURL(blob)
        imageCache.value.set(photo.id, blobUrl)
      } catch {
        // Silent failure for background preloads - don't disrupt user experience
      }
    }

    activeLoads--
    loadNext()  // Start next item in queue
  }

  // Kick off initial batch of concurrent loads
  for (let i = 0; i < MAX_CONCURRENT; i++) {
    loadNext()
  }
}

function close() {
  // Clean up all cached blob URLs using shared helper
  clearBlobCache(imageCache.value)

  emit('close')
}

function navigate(direction: 'prev' | 'next') {
  menuVisible.value = false  // Close menu when navigating
  emit('navigate', direction)
}

function toggleMenu(event: MouseEvent) {
  if (menuVisible.value) {
    menuVisible.value = false
  } else {
    const button = event.currentTarget as HTMLElement
    const rect = button.getBoundingClientRect()
    const menuWidth = 160 // min-width from CSS
    // Position menu so right edge aligns with right edge of button
    const left = rect.right - menuWidth
    menuTop.value = `${rect.bottom + 8}px`
    menuLeft.value = `${Math.max(8, left)}px`
    menuVisible.value = true
    // Focus first menu item when menu opens
    nextTick(() => {
      firstMenuItemRef.value?.focus()
    })
  }
}

function closeMenu() {
  menuVisible.value = false
}

function closeMenuAndFocusButton() {
  menuVisible.value = false
  nextTick(() => {
    menuButtonRef.value?.focus()
  })
}

function closeIfNoMenu() {
  if (menuVisible.value) {
    menuVisible.value = false
  } else {
    close()
  }
}

function handleMenuAction(action: string) {
  menuVisible.value = false
  if (props.photo) {
    emit('action', action, props.photo)
  }
}

// Handle escape key and arrow keys
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close()
  } else if (event.key === 'ArrowLeft' && canNavigatePrev.value) {
    navigate('prev')
  } else if (event.key === 'ArrowRight' && canNavigateNext.value) {
    navigate('next')
  }
}

/**
 * Focus trap handler - keeps Tab navigation within the lightbox.
 * When Tab reaches the last focusable element, wraps to first.
 * When Shift+Tab reaches the first element, wraps to last.
 */
function handleTabKey(event: KeyboardEvent) {
  if (!lightboxRef.value) return

  // Get all focusable elements within the lightbox
  const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  const focusableElements = Array.from(
    lightboxRef.value.querySelectorAll<HTMLElement>(focusableSelectors)
  ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null)

  if (focusableElements.length === 0) return

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]
  const activeElement = document.activeElement as HTMLElement

  if (event.shiftKey) {
    // Shift+Tab: if on first element, wrap to last
    if (activeElement === firstElement || !lightboxRef.value.contains(activeElement)) {
      event.preventDefault()
      lastElement.focus()
    }
  } else {
    // Tab: if on last element, wrap to first
    if (activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }
}

/**
 * Touch handlers for swipe navigation on mobile devices.
 *
 * Swipe Detection Logic:
 * 1. Track touch start position
 * 2. During move, prevent browser gestures if horizontal swipe detected
 * 3. On end, check if gesture qualifies as intentional swipe
 *
 * Swipe Qualification Criteria:
 * - Horizontal distance > 50px (intentional gesture, not accidental touch)
 * - Horizontal movement > vertical (avoid triggering on scroll attempts)
 *
 * Why 50px threshold?
 * - Large enough to ignore accidental touches and finger jitter (~5-10px)
 * - Small enough to feel responsive (typical swipe is 100-300px)
 * - Works across device sizes (50px is ~5% of a 1000px mobile width)
 *
 * Why |deltaX| > |deltaY| check?
 * - Distinguishes horizontal swipes from vertical scrolls
 * - Prevents navigation when user is trying to scroll info panel
 * - Diagonal gestures (45°+) treated as vertical (safer default)
 */
function handleTouchStart(event: TouchEvent) {
  touchStartX = event.touches[0].clientX
  touchStartY = event.touches[0].clientY
  touchMoved = false
}

function handleTouchMove(event: TouchEvent) {
  touchMoved = true
  // Prevent browser back/forward swipe navigation when horizontal
  const deltaX = Math.abs(event.touches[0].clientX - touchStartX)
  const deltaY = Math.abs(event.touches[0].clientY - touchStartY)
  if (deltaX > deltaY) {
    event.preventDefault()
  }
}

function handleTouchEnd(event: TouchEvent) {
  if (!touchMoved) return

  const touchEndX = event.changedTouches[0].clientX
  const touchEndY = event.changedTouches[0].clientY
  const deltaX = touchEndX - touchStartX
  const deltaY = touchEndY - touchStartY

  // Minimum 50px horizontal movement, and more horizontal than vertical
  const SWIPE_THRESHOLD = 50
  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
    if (deltaX > 0 && canNavigatePrev.value) {
      navigate('prev')  // Swipe right → previous image
    } else if (deltaX < 0 && canNavigateNext.value) {
      navigate('next')  // Swipe left → next image
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
  document.documentElement.style.overflow = ''
  // Clean up all cached blob URLs using shared helper
  clearBlobCache(imageCache.value)
})

// formatSize is imported from usePhotos composable

function formatExifDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(getUserLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

// getOrientationLabel is now provided by useTranslations composable

function formatCoordinate(value: number, type: 'lat' | 'lon'): string {
  const absolute = Math.abs(value)
  const degrees = Math.floor(absolute)
  const minutesDecimal = (absolute - degrees) * 60
  const minutes = Math.floor(minutesDecimal)
  const seconds = ((minutesDecimal - minutes) * 60).toFixed(1)

  let direction: string
  if (type === 'lat') {
    direction = value >= 0 ? 'N' : 'S'
  } else {
    direction = value >= 0 ? 'E' : 'W'
  }

  return `${degrees}°${minutes}'${seconds}"${direction}`
}

function getMapUrl(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`
}
</script>

<style scoped>
.lightbox-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  overflow: hidden;
  touch-action: pan-y pinch-zoom;
  overscroll-behavior-x: none;
}

/* Context Menu inside lightbox */
.lightbox-context-menu {
  position: fixed;
  display: flex;
  flex-direction: column;
  background: var(--oc-color-background-default, #fff);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  min-width: 160px;
  padding: 6px 0;
  z-index: 10001;
  overflow: hidden;
}

.lbmenu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.6rem 1rem;
  cursor: pointer;
  font-size: var(--oc-font-size-default, 0.875rem);
  color: var(--oc-color-text-default, #333);
  text-align: left;
  transition: background 0.15s;
}

.lbmenu-item:hover {
  background: var(--oc-color-background-muted, #f5f5f5);
}

.lbmenu-item-danger {
  color: var(--oc-color-swatch-danger-default, #dc3545);
}

.lbmenu-item-danger:hover {
  background: rgba(200, 0, 0, 0.1);
}

.lbmenu-divider {
  height: 1px;
  background: var(--oc-color-border, #eee);
  margin: 0.5rem 0;
}

.lightbox-container {
  display: flex;
  flex-direction: column;
  background: var(--oc-color-background-default, #fff);
  border-radius: 8px;
  overflow-x: hidden;
  overflow-y: auto;
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
}

.lightbox-top-buttons {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.5rem;
  z-index: 10;
}

.lightbox-menu-btn {
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.lightbox-menu-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.lightbox-menu-btn:hover {
  background: rgba(0, 0, 0, 0.7);
}

.lightbox-close {
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.lightbox-close svg {
  width: 1.25rem;
  height: 1.25rem;
}

.lightbox-close:hover {
  background: rgba(0, 0, 0, 0.7);
}

.lightbox-nav {
  position: absolute;
  top: 0;
  bottom: 0;
  margin: auto 0;
  width: 3rem;
  height: 3rem;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 50%;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.2s;
}

.lightbox-nav svg {
  width: 1.5rem;
  height: 1.5rem;
}

.lightbox-nav:hover {
  background: rgba(255, 255, 255, 0.4);
  transform: scale(1.1);
}

.lightbox-nav-prev { left: 0.5rem; }
.lightbox-nav-next { right: 0.5rem; }

.lightbox-counter {
  position: absolute;
  top: 0.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 0.3rem 0.75rem;
  border-radius: 15px;
  font-size: 0.85rem;
  font-weight: 500;
  z-index: 10;
}

.lightbox-image-container {
  position: relative;
  background: #000;
  overflow: hidden;
  flex: 1 1 auto;
  min-height: 200px;  /* Minimum image height before scrolling panel */
}

.lightbox-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 1.2rem;
  z-index: 1;
}

.lightbox-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--oc-color-text-muted, #999);
}

.lightbox-error-icon {
  display: block;
  width: 64px;
  height: 64px;
  color: var(--oc-color-swatch-danger-default, #c41e3a);
}

.lightbox-error-icon svg {
  width: 100%;
  height: 100%;
}

.lightbox-error-text {
  margin-top: 1rem;
  font-size: 1rem;
  color: var(--oc-color-text-muted, #999);
  text-align: center;
  word-break: break-word;
  max-width: 80%;
}

.loading-spinner {
  display: block;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-spinner.large {
  width: 48px;
  height: 48px;
  border-width: 3px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}


.lightbox-panel {
  background: var(--oc-color-background-default, #fff);
  padding: 1rem;
  border-top: 1px solid var(--oc-color-border, #e0e0e0);
  flex-shrink: 0;
}

.lightbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.lightbox-title-group {
  flex: 1;
  min-width: 0;
  margin-right: 1rem;
}

.lightbox-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--oc-color-text-default, #333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lightbox-path {
  display: block;
  font-size: 0.8rem;
  color: var(--oc-color-text-muted, #666);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 0.25rem;
}

.lightbox-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: flex-end;
  max-width: 60%;
  max-height: 4.5rem;
  overflow-y: auto;
}

.lightbox-tags .oc-tag {
  font-size: 0.75rem;
  line-height: 1.4;
}

.lightbox-metadata {
  background: var(--oc-color-background-muted, #f5f5f5);
  border-radius: 4px;
  padding: 0.75rem;
  max-height: 150px;
  overflow-y: auto;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.metadata-label {
  font-size: 0.7rem;
  color: var(--oc-color-text-muted, #666);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metadata-value {
  font-size: 0.85rem;
  color: var(--oc-color-text-default, #333);
}

.metadata-value.date-with-source {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.badge-exif {
  background: var(--oc-color-swatch-success-muted, #e6f4e6);
  color: var(--oc-color-swatch-success-default, #2a7b2a);
}

.badge-upload {
  background: var(--oc-color-background-highlight, #f0f0f0);
  color: var(--oc-color-text-muted, #666);
}

.metadata-location {
  grid-column: span 2;
}

.map-link {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.15rem 0.4rem;
  background: var(--oc-color-swatch-primary-default, #0070f3);
  color: white;
  text-decoration: none;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 500;
  transition: background 0.2s;
}

.map-link:hover {
  background: var(--oc-color-swatch-primary-hover, #0060d0);
}

/* Lightbox image - simple centered display with letterboxing */
.lightbox-image {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
  margin: auto;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
