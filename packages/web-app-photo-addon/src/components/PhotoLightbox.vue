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
    <div v-if="menuVisible" :style="menuStyle" role="menu" tabindex="-1" :aria-label="t('lightbox.photoOptions')" @click.stop @keydown.escape.stop="closeMenuAndFocusButton">
      <button ref="firstMenuItemRef" role="menuitem" :style="menuItemStyle" @click="handleMenuAction('download')" @mouseenter="$event.target.style.background='#f5f5f5'" @mouseleave="$event.target.style.background='none'" @focusin="$event.target.style.background='#f5f5f5'" @focusout="$event.target.style.background='none'">
        <span aria-hidden="true" style="width: 18px; opacity: 0.7;">↓</span>
        <span>{{ t('menu.download') }}</span>
      </button>
      <button role="menuitem" :style="menuItemStyle" @click="handleMenuAction('openInFiles')" @mouseenter="$event.target.style.background='#f5f5f5'" @mouseleave="$event.target.style.background='none'" @focusin="$event.target.style.background='#f5f5f5'" @focusout="$event.target.style.background='none'">
        <span aria-hidden="true" style="width: 18px; opacity: 0.7;">→</span>
        <span>{{ t('menu.openInFiles') }}</span>
      </button>
      <button role="menuitem" :style="menuItemStyle" @click="handleMenuAction('copyLink')" @mouseenter="$event.target.style.background='#f5f5f5'" @mouseleave="$event.target.style.background='none'" @focusin="$event.target.style.background='#f5f5f5'" @focusout="$event.target.style.background='none'">
        <span aria-hidden="true" style="width: 18px; opacity: 0.7;">⎘</span>
        <span>{{ t('menu.copyLink') }}</span>
      </button>
      <div role="separator" style="height: 1px; background: #eee; margin: 6px 0;"></div>
      <button role="menuitem" :style="menuItemDangerStyle" @click="handleMenuAction('delete')" @mouseenter="$event.target.style.background='#fff0f0'" @mouseleave="$event.target.style.background='none'" @focusin="$event.target.style.background='#fff0f0'" @focusout="$event.target.style.background='none'">
        <span aria-hidden="true" style="width: 18px; opacity: 0.7;">✕</span>
        <span>{{ t('menu.delete') }}</span>
      </button>
    </div>

    <div class="lightbox-container">
      <!-- Top right buttons -->
      <div class="lightbox-top-buttons">
        <button
          ref="menuButtonRef"
          class="lightbox-menu-btn"
          aria-haspopup="menu"
          :aria-expanded="menuVisible"
          :aria-label="t('lightbox.photoOptions')"
          @click.stop="toggleMenu($event)"
        >
          <span aria-hidden="true">⋮</span>
        </button>
        <button ref="closeButtonRef" class="lightbox-close" :aria-label="t('lightbox.close')" @click="close">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>

      <!-- Photo counter -->
      <div
        v-if="groupPhotos.length > 1"
        class="lightbox-counter"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        :aria-label="t('lightbox.photoCounter', { current: currentIndex + 1, total: groupPhotos.length })"
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
          class="lightbox-nav lightbox-nav-prev"
          :aria-label="t('lightbox.previous')"
          @click.stop="navigate('prev')"
        >
          <span class="nav-arrow" aria-hidden="true">&#8249;</span>
        </button>

        <!-- Loading spinner while waiting for full-size image -->
        <div v-if="!fullSizeUrl" class="lightbox-loading">
          <span class="loading-spinner large"></span>
        </div>

        <!-- Full-size image -->
        <img
          v-if="fullSizeUrl"
          :src="fullSizeUrl"
          :alt="photo.name || 'Photo'"
          class="lightbox-image"
        />

        <!-- Navigation: Next (inside image container) -->
        <button
          v-if="canNavigateNext"
          class="lightbox-nav lightbox-nav-next"
          :aria-label="t('lightbox.next')"
          @click.stop="navigate('next')"
        >
          <span class="nav-arrow" aria-hidden="true">&#8250;</span>
        </button>
      </div>

      <!-- Bottom panel with metadata -->
      <div class="lightbox-panel">
        <div class="lightbox-header">
          <div class="lightbox-title-group">
            <h3 id="lightbox-title" class="lightbox-title">{{ photo.name || t('fallback.untitled') }}</h3>
            <span v-if="folderPath" class="lightbox-path">{{ folderPath }}</span>
          </div>
        </div>

        <!-- EXIF Metadata section -->
        <div class="lightbox-metadata" role="region" :aria-label="t('metadata.sectionLabel')">
          <div class="metadata-grid" role="list">
            <!-- Date Taken (with source indicator) -->
            <div v-if="displayDate" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ t('metadata.dateTaken') }}</span>
              <span class="metadata-value date-with-source">
                {{ displayDate }}
                <span :class="['date-source-badge', isExifDate ? 'badge-exif' : 'badge-upload']">
                  {{ isExifDate ? t('date.exifBadge') : t('date.modTimeBadge') }}
                </span>
              </span>
            </div>

            <!-- EXIF: Camera -->
            <div v-if="exifData.cameraMake || exifData.cameraModel" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ t('metadata.camera') }}</span>
              <span class="metadata-value">{{ [exifData.cameraMake, exifData.cameraModel].filter(Boolean).join(' ') }}</span>
            </div>

            <!-- EXIF: Aperture -->
            <div v-if="exifData.fNumber" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ t('metadata.aperture') }}</span>
              <span class="metadata-value">f/{{ exifData.fNumber }}</span>
            </div>

            <!-- EXIF: Focal Length -->
            <div v-if="exifData.focalLength" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ t('metadata.focalLength') }}</span>
              <span class="metadata-value">{{ exifData.focalLength }}mm</span>
            </div>

            <!-- EXIF: ISO -->
            <div v-if="exifData.iso" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ t('metadata.iso') }}</span>
              <span class="metadata-value">{{ exifData.iso }}</span>
            </div>

            <!-- EXIF: Exposure -->
            <div v-if="exifData.exposureNumerator && exifData.exposureDenominator" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ t('metadata.exposure') }}</span>
              <span class="metadata-value">{{ exifData.exposureNumerator }}/{{ exifData.exposureDenominator }}s</span>
            </div>

            <!-- EXIF: Orientation -->
            <div v-if="exifData.orientation" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ t('metadata.orientation') }}</span>
              <span class="metadata-value">{{ getOrientationLabel(exifData.orientation) }}</span>
            </div>

            <!-- EXIF: Location (Lat/Long) -->
            <div v-if="exifData.location?.latitude != null && exifData.location?.longitude != null" class="metadata-item metadata-location" role="listitem" tabindex="0">
              <span class="metadata-label">{{ t('metadata.location') }}</span>
              <span class="metadata-value">
                {{ formatCoordinate(exifData.location.latitude, 'lat') }}, {{ formatCoordinate(exifData.location.longitude, 'lon') }}
                <a
                  :href="getMapUrl(exifData.location.latitude, exifData.location.longitude)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="map-link"
                  @click.stop
                >
                  {{ t('menu.viewOnMap') }}
                </a>
              </span>
            </div>

            <!-- EXIF: Altitude -->
            <div v-if="exifData.location?.altitude != null" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ t('metadata.altitude') }}</span>
              <span class="metadata-value">{{ exifData.location.altitude.toFixed(1) }}m</span>
            </div>

            <!-- File info -->
            <div v-if="photo.size" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ t('metadata.fileSize') }}</span>
              <span class="metadata-value">{{ formatSize(Number(photo.size)) }}</span>
            </div>

            <div v-if="photo.mimeType" class="metadata-item" role="listitem" tabindex="0">
              <span class="metadata-label">{{ t('metadata.type') }}</span>
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
import { useI18n } from '../composables/useI18n'
import type { GraphPhoto, PhotoWithDate } from '../types'

// Initialize composable for shared utility functions
const { formatSize } = usePhotos()

// Initialize i18n
const { t, getOrientationLabel } = useI18n()

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

// Computed style for menu positioning
const menuStyle = computed(() => ({
  position: 'fixed' as const,
  display: 'flex',
  flexDirection: 'column' as const,
  top: menuTop.value,
  left: menuLeft.value,
  zIndex: 10001,
  background: '#fff',
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
  minWidth: '160px',
  padding: '6px 0',
  overflow: 'hidden'
}))

// Computed style for menu items
const menuItemStyle = computed(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  width: '100%',
  padding: '10px 16px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  color: '#333',
  textAlign: 'left' as const,
  fontFamily: 'inherit',
  WebkitAppearance: 'none' as const,
  MozAppearance: 'none' as const,
  appearance: 'none' as const,
  outline: 'none',
  boxSizing: 'border-box' as const
}))

// Computed style for danger menu item
const menuItemDangerStyle = computed(() => ({
  ...menuItemStyle.value,
  color: '#dc3545'
}))

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

// Extract EXIF data from graphPhoto
const exifData = computed<GraphPhoto>(() => {
  return photoWithDate.value?.graphPhoto || {}
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
    return d.toLocaleDateString(undefined, {
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

// getOrientationLabel is now provided by useI18n composable

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
  background: #fff;
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
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  text-align: left;
  transition: background 0.15s;
  font-family: inherit;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  outline: none;
  box-sizing: border-box;
}

.lbmenu-item:hover {
  background: #f5f5f5;
}

.lbmenu-item-danger {
  color: #dc3545;
}

.lbmenu-item-danger:hover {
  background: #fff0f0;
}

.lbmenu-icon {
  width: 18px;
  font-size: 14px;
  opacity: 0.7;
}

.lbmenu-divider {
  height: 1px;
  background: #eee;
  margin: 6px 0;
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
  font-size: 1.25rem;
  font-weight: bold;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
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
  font-size: 1.5rem;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
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
  font-size: 1.5rem;
  border-radius: 50%;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.2s;
}

.lightbox-nav:hover {
  background: rgba(255, 255, 255, 0.4);
  transform: scale(1.1);
}

.lightbox-nav-prev { left: 0.5rem; }
.lightbox-nav-next { right: 0.5rem; }

.nav-arrow {
  font-weight: bold;
  line-height: 1;
}

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

.lightbox-loading-overlay {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: rgba(0, 0, 0, 0.6);
  padding: 0.5rem;
  border-radius: 4px;
  z-index: 5;
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

.lightbox-download {
  padding: 0.5rem 1rem;
  background: var(--oc-color-swatch-primary-default, #0070f3);
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.2s;
  white-space: nowrap;
}

.lightbox-download:hover {
  background: var(--oc-color-swatch-primary-hover, #0060d0);
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

.date-source-badge {
  display: inline-block;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
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
