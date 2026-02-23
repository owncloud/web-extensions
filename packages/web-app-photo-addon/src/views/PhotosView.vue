<template>
  <div
    ref="scrollContainer"
    class="photos-app"
    role="main"
    :aria-label="$gettext('Photos')"
    @scroll="handleScroll"
    @touchstart="handlePinchStart"
    @touchmove="handlePinchMove"
    @touchend="handlePinchEnd"
    @wheel="handleWheel"
  >
    <div class="photos-header">
      <div class="header-top">
        <h1>{{ $gettext('Photos') }} ({{ viewType === 'map' ? $gettext('%{visible} of %{total} in view').replace('%{visible}', String(mapVisibleCount)).replace('%{total}', String(mapTotalCount)) : photoCount }})</h1>
        <div class="header-controls">
          <!-- Date filter (hidden in map view) -->
          <div v-if="viewType !== 'map'" class="date-filter" role="group" :aria-label="$gettext('Jump to:')">
            <span id="date-filter-label" class="control-label">{{ $gettext('Jump to:') }}</span>
            <select
              id="filter-year"
              v-model="filterYear"
              class="date-select"
              :aria-label="$gettext('Select year')"
              @change="onDateFilterChange"
            >
              <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
            </select>
            <select
              id="filter-month"
              v-model="filterMonth"
              class="date-select"
              :aria-label="$gettext('Select month')"
              @change="onDateFilterChange"
            >
              <option v-for="(name, index) in monthNames" :key="index" :value="index">{{ name }}</option>
            </select>
            <button v-if="!isCurrentMonth" class="today-btn" :title="$gettext('Today')" @click="jumpToToday">
              {{ $gettext('Today') }}
            </button>
          </div>
          <!-- View type selector (Calendar / Map) -->
          <div class="view-selector" role="group" :aria-label="$gettext('View mode')">
            <button
              :class="['view-btn', { active: viewType === 'calendar' }]"
              :aria-pressed="viewType === 'calendar'"
              @click="viewType = 'calendar'"
            >
              {{ $gettext('Calendar') }}
            </button>
            <button
              :class="['view-btn', { active: viewType === 'map' }]"
              :aria-pressed="viewType === 'map'"
              @click="viewType = 'map'"
            >
              {{ $gettext('Map') }}
            </button>
          </div>
          <!-- EXIF only toggle (hidden in map view) -->
          <label v-if="viewType !== 'map'" class="exif-toggle" for="exif-only-toggle">
            <input id="exif-only-toggle" v-model="exifOnly" type="checkbox" />
            <span class="toggle-label">{{ $gettext('EXIF only') }}</span>
          </label>
        </div>
      </div>

      <p v-if="loading && !error" class="loading-status" role="status" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        {{ $gettext('Loading %{range}... %{count} photos').replace('%{range}', currentDateRange).replace('%{count}', String(photoCount)) }}
      </p>
      <p v-else-if="viewType !== 'map' && !error" class="photo-count" role="status" aria-live="polite">
        <span v-if="isFullyLoaded" class="complete-hint">{{ $gettext('All photos loaded') }}</span>
      </p>
    </div>

    <!-- Error State -->
    <div v-if="error" class="error-state" role="alert">
      <div class="error-icon" aria-hidden="true">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <circle cx="12" cy="16" r="0.5" fill="currentColor" />
        </svg>
      </div>
      <h2 class="error-title">{{ errorTitle }}</h2>
      <p class="error-message">{{ error }}</p>
      <div v-if="errorSuggestions.length > 0" class="error-suggestions">
        <p class="suggestions-label">{{ $gettext('Things to try:') }}</p>
        <ul>
          <li v-for="(suggestion, index) in errorSuggestions" :key="index">{{ suggestion }}</li>
        </ul>
      </div>
      <button class="retry-button" @click="retryLoad">
        <span class="retry-icon" aria-hidden="true">↻</span>
        {{ $gettext('Try Again') }}
      </button>
    </div>

    <!-- Calendar View -->
    <div v-if="!error && viewType === 'calendar'" class="photos-content">
      <div v-if="!loading && photoCount === 0" class="empty-state">
        <span class="empty-icon">📷</span>
        <p>{{ $gettext('No photos found') }}</p>
        <p class="empty-hint">{{ $gettext('Photos will appear here after EXIF tags are synced') }}</p>
      </div>

      <div v-else class="photo-groups">
        <div
          v-for="group in groupedPhotosWithStacks"
          :key="group.dateKey"
          class="date-group"
        >
          <h2 class="date-header">{{ formatDateHeader(group.dateKey) }} ({{ group.subGroups.reduce((sum, sg) => sum + sg.photos.length, 0) }})</h2>
          <div class="photo-grid">
            <template v-for="subGroup in group.subGroups" :key="subGroup.id">
              <!-- Single photo: regular item -->
              <div
                v-if="subGroup.photos.length === 1"
                :ref="(el) => observePhoto(el as HTMLElement, subGroup.photos[0].id || subGroup.photos[0].fileId || subGroup.photos[0].name)"
                class="photo-item"
                role="button"
                tabindex="0"
                :aria-label="subGroup.photos[0].name"
                @click="openPhoto(subGroup.photos[0])"
                @keydown.enter="openPhoto(subGroup.photos[0])"
                @keydown.space.prevent="openPhoto(subGroup.photos[0])"
              >
                <img
                  :src="getPhotoUrl(subGroup.photos[0])"
                  :alt="subGroup.photos[0].name"
                  loading="lazy"
                  @error="handleImageError"
                />
                <div class="photo-overlay">
                  <span class="photo-name">{{ subGroup.photos[0].name }}</span>
                </div>
              </div>
              <!-- Multiple photos: stack -->
              <PhotoStack
                v-else
                :ref="(el) => { if (el && '$el' in el) observePhoto((el as { $el: HTMLElement }).$el, subGroup.photos[0].id || subGroup.photos[0].fileId || subGroup.photos[0].name) }"
                :photos="subGroup.photos"
                :get-photo-url="getPhotoUrl"
                @click="openStack(subGroup)"
              />
            </template>
          </div>
        </div>

        <div v-if="loadingMore" class="loading-more">
          {{ $gettext('Loading more photos...') }}
        </div>
      </div>
    </div>

    <!-- Map View -->
    <div v-if="!error && viewType === 'map'" class="map-view-container">
      <PhotoMap
        :photos="mapPhotos"
        :get-thumbnail-url="getPhotoUrl"
        :prefetch-thumbnails="queueMapThumbnails"
        @photo-click="openPhotoFromMap"
        @visible-count-change="onMapVisibleCountChange"
      />
    </div>

    <!-- Photo Lightbox with navigation -->
    <PhotoLightbox
      :photo="selectedPhoto"
      :group-photos="currentGroupPhotos"
      :current-index="currentPhotoIndex"
      :thumbnail-cache="blobUrlCache"
      @close="closeLightbox"
      @navigate="navigatePhoto"
      @action="handleLightboxAction"
    />

    <!-- Context Menu -->
    <PhotoContextMenu
      :visible="contextMenuVisible"
      :photo="contextMenuPhoto"
      :position="contextMenuPosition"
      @close="closeContextMenu"
      @action="handleContextAction"
    />

    <!-- Zoom level indicator -->
    <transition name="zoom-fade">
      <div v-if="showZoomIndicator" class="zoom-indicator">
        {{ zoomIndicatorText }}
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, shallowRef, triggerRef } from 'vue'
import { useClientService, useSpacesStore, useConfigStore } from '@ownclouders/web-pkg'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import PhotoLightbox from '../components/PhotoLightbox.vue'
import PhotoStack from '../components/PhotoStack.vue'
import PhotoContextMenu from '../components/PhotoContextMenu.vue'
import PhotoMap from '../components/PhotoMap.vue'
import { usePhotos } from '../composables/usePhotos'
import { useTranslations } from '../composables/useTranslations'
import type {
  GeoCoordinates,
  GraphPhoto,
  PhotoWithDate,
  PhotoSubGroup,
  GroupMode,
  ViewType
} from '../types'

// Initialize composable for shared utility functions
const {
  getISOWeek,
  calculateDistance,
  formatDate: formatDateYMD
} = usePhotos()

// Initialize translations
const { $gettext, getMonthNames } = useTranslations()

const clientService = useClientService()
const spacesStore = useSpacesStore()
const configStore = useConfigStore()

// LocalStorage keys for persistent settings
const STORAGE_KEY_GROUP_MODE = 'photo-addon:groupMode'
const STORAGE_KEY_EXIF_ONLY = 'photo-addon:exifOnly'
const STORAGE_KEY_VIEW_TYPE = 'photo-addon:viewType'

// Load initial values from localStorage
function getStoredGroupMode(): GroupMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_GROUP_MODE)
    if (saved && ['day', 'week', 'month', 'year'].includes(saved)) {
      return saved as GroupMode
    }
  } catch { /* ignore */ }
  return 'day'
}

function getStoredExifOnly(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_EXIF_ONLY) === 'true'
  } catch { /* ignore */ }
  return false
}

function getStoredViewType(): ViewType {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_VIEW_TYPE)
    if (saved && ['calendar', 'map'].includes(saved)) {
      return saved as ViewType
    }
  } catch { /* ignore */ }
  return 'calendar'
}

const groupMode = ref<GroupMode>(getStoredGroupMode())
const viewType = ref<ViewType>(getStoredViewType())

// EXIF-only filter toggle
const exifOnly = ref(getStoredExifOnly())

// Pinch-to-zoom state
const showZoomIndicator = ref(false)
let zoomIndicatorTimeout: ReturnType<typeof setTimeout> | null = null
let initialPinchDistance = 0
let isPinching = false

// Zoom levels for pinch gesture
const zoomLevels: GroupMode[] = ['day', 'week', 'month', 'year']

// Zoom indicator text
const zoomIndicatorText = computed(() => {
  switch (groupMode.value) {
    case 'day': return $gettext('Day')
    case 'week': return $gettext('Week')
    case 'month': return $gettext('Month')
    case 'year': return $gettext('Year')
    default: return ''
  }
})

// Get distance between two touch points
function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

// Show zoom feedback indicator
function showZoomFeedback() {
  showZoomIndicator.value = true
  if (zoomIndicatorTimeout !== null) {
    clearTimeout(zoomIndicatorTimeout)
  }
  zoomIndicatorTimeout = setTimeout(() => {
    showZoomIndicator.value = false
    zoomIndicatorTimeout = null  // Clear reference after execution
  }, 800)
}

// Zoom in (more detail: year -> month -> week -> day)
function zoomIn() {
  const currentIndex = zoomLevels.indexOf(groupMode.value)
  if (currentIndex > 0) {
    groupMode.value = zoomLevels[currentIndex - 1]
    showZoomFeedback()
  }
}

// Zoom out (less detail: day -> week -> month -> year)
function zoomOut() {
  const currentIndex = zoomLevels.indexOf(groupMode.value)
  if (currentIndex < zoomLevels.length - 1) {
    groupMode.value = zoomLevels[currentIndex + 1]
    showZoomFeedback()
  }
}

// Reset zoom to default (month view)
function resetZoom() {
  if (groupMode.value !== 'month') {
    groupMode.value = 'month'
    showZoomFeedback()
  }
}

/**
 * Keyboard handler for zoom shortcuts (accessibility alternative to pinch).
 * - '+' or '=' : Zoom in (more detail)
 * - '-' : Zoom out (less detail)
 * - '0' : Reset to default (month view)
 */
function handleZoomKeydown(event: KeyboardEvent) {
  // Don't intercept if user is typing in an input field
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return
  }

  // Only handle zoom keys in calendar view (not map view)
  if (viewType.value !== 'calendar') {
    return
  }

  switch (event.key) {
    case '+':
    case '=':
      event.preventDefault()
      zoomIn()
      break
    case '-':
      event.preventDefault()
      zoomOut()
      break
    case '0':
      event.preventDefault()
      resetZoom()
      break
  }
}

/**
 * Pinch gesture handlers for zoom control (calendar view only).
 *
 * Pinch-to-zoom changes the date grouping granularity:
 * - Pinch (fingers together): Zoom OUT → less detail (day → week → month → year)
 * - Spread (fingers apart): Zoom IN → more detail (year → month → week → day)
 *
 * Threshold ratios (0.6 and 1.6):
 * - 0.6 = fingers 40% closer than start → zoom out
 * - 1.6 = fingers 60% farther than start → zoom in
 *
 * Why these specific values?
 * - Far enough from 1.0 to avoid accidental triggers from finger jitter
 * - Close enough to feel responsive (users don't need to spread fingers 2x)
 * - Symmetric around 1.0 in log scale: log(0.6) ≈ -0.51, log(1.6) ≈ 0.47
 *
 * Continuous pinch behavior:
 * - After each zoom level change, baseline resets to current distance
 * - Allows multi-step zoom without lifting fingers (day→week→month in one gesture)
 * - User can pinch, hold, pinch again to continue zooming
 */
function handlePinchStart(event: TouchEvent) {
  if (viewType.value !== 'calendar') return
  if (event.touches.length === 2) {
    isPinching = true
    initialPinchDistance = getTouchDistance(event.touches)
  }
}

function handlePinchMove(event: TouchEvent) {
  if (viewType.value !== 'calendar') return
  if (!isPinching || event.touches.length !== 2) return

  // Prevent browser pinch-zoom during gesture
  event.preventDefault()

  const currentDistance = getTouchDistance(event.touches)
  const ratio = currentDistance / initialPinchDistance

  // Trigger zoom when ratio crosses threshold
  const PINCH_THRESHOLD = 0.6   // 40% closer = zoom out
  const SPREAD_THRESHOLD = 1.6  // 60% farther = zoom in

  if (ratio < PINCH_THRESHOLD) {
    zoomOut()
    initialPinchDistance = currentDistance  // Reset for continuous pinch
  } else if (ratio > SPREAD_THRESHOLD) {
    zoomIn()
    initialPinchDistance = currentDistance  // Reset for continuous spread
  }
}

function handlePinchEnd(event: TouchEvent) {
  if (viewType.value !== 'calendar') return
  if (isPinching && event.touches.length < 2) {
    isPinching = false
    initialPinchDistance = 0
  }
}

// Desktop: Ctrl+scroll wheel to zoom (calendar view only)
function handleWheel(event: WheelEvent) {
  if (viewType.value !== 'calendar') return
  if (event.ctrlKey) {
    event.preventDefault()
    if (event.deltaY > 0) {
      zoomOut()
    } else {
      zoomIn()
    }
  }
}

// Refs
const scrollContainer = ref<HTMLElement | null>(null)
const allPhotos = ref<PhotoWithDate[]>([])
const mapPhotos = ref<PhotoWithDate[]>([])  // Separate data for map view (all photos with GPS)
const mapPhotosLoaded = ref(false)  // Track if map photos have been fetched
const mapVisibleCount = ref(0)  // Photos visible in current map viewport
const mapTotalCount = ref(0)  // Total photos with GPS
// Removed thumbnailVersion - was causing cascade re-renders of all photos
const loading = ref(true)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const currentDateRange = ref('')
const isFullyLoaded = ref(false)
const selectedPhoto = ref<PhotoWithDate | null>(null)

// Context menu state
const contextMenuVisible = ref(false)
const contextMenuPhoto = ref<PhotoWithDate | null>(null)
const contextMenuPosition = ref({ x: 0, y: 0 })

// Track loaded photo IDs to avoid duplicates
const loadedPhotoIds = ref<Set<string>>(new Set())

// How far back we've loaded
const oldestLoadedDate = ref<Date>(new Date())

// Date filter state
const now = new Date()
const filterYear = ref(now.getFullYear())
const filterMonth = ref(now.getMonth())  // 0-indexed

// Month names for dropdown (computed for i18n reactivity)
const monthNames = computed(() => getMonthNames())

// Available years (current year back to 2015)
const availableYears = computed(() => {
  const years: number[] = []
  const currentYear = new Date().getFullYear()
  for (let y = currentYear; y >= 2015; y--) {
    years.push(y)
  }
  return years
})

// Check if filter is set to current month
const isCurrentMonth = computed(() => {
  const now = new Date()
  return filterYear.value === now.getFullYear() && filterMonth.value === now.getMonth()
})

// Store personal space reference for thumbnail generation
// Not reactive - only set once during initial load and cached for subsequent operations
let personalSpace: SpaceResource | null = null

/**
 * Infinite scroll and loading configuration constants.
 *
 * SCROLL_THRESHOLD (500px):
 * - Distance from bottom that triggers next batch load
 * - 500px ≈ 2-3 rows of thumbnails on desktop, ~4-5 on mobile
 * - Large enough to start loading before user reaches bottom
 * - Small enough to not waste bandwidth loading unseen content
 *
 * MIN_PHOTOS_ON_SCREEN (20):
 * - Minimum photos shown before initial load stops
 * - Ensures the grid doesn't look empty on first render
 * - ~2-3 rows on desktop, enough to fill most mobile screens
 * - If fewer photos exist in the date range, loading continues backward
 */
const SCROLL_THRESHOLD = 500
const MIN_PHOTOS_ON_SCREEN = 20

// Filter photos based on EXIF toggle and folder selection
const displayedPhotos = computed(() => {
  let photos = allPhotos.value

  // Apply EXIF filter
  if (exifOnly.value) {
    photos = photos.filter(photo => photo.dateSource === 'photo.takenDateTime')
  }

  return photos
})

const photoCount = computed(() => displayedPhotos.value.length)

// Error state computed properties
const errorTitle = computed(() => {
  const err = error.value || ''
  if (err.includes('search service') || err.includes('503') || err.includes('Service Unavailable')) {
    return $gettext('Search Service Unavailable')
  }
  if (err.includes('network') || err.includes('Network') || err.includes('ECONNREFUSED')) {
    return $gettext('Connection Error')
  }
  if (err.includes('personal space')) {
    return $gettext('Storage Not Found')
  }
  if (err.includes('401') || err.includes('Unauthorized')) {
    return $gettext('Authentication Error')
  }
  return $gettext('Unable to Load Photos')
})

const errorSuggestions = computed(() => {
  const err = error.value || ''
  if (err.includes('search service') || err.includes('503') || err.includes('Service Unavailable')) {
    return [
      $gettext('The search service may be restarting or under maintenance'),
      $gettext('Wait a moment and try again'),
      $gettext('Contact your administrator if this persists')
    ]
  }
  if (err.includes('network') || err.includes('Network') || err.includes('ECONNREFUSED')) {
    return [
      $gettext('Check your internet connection'),
      $gettext('The server may be temporarily unavailable'),
      $gettext('Try refreshing the page')
    ]
  }
  if (err.includes('personal space')) {
    return [
      $gettext('Your personal storage space could not be found'),
      $gettext('Try logging out and back in'),
      $gettext('Contact your administrator if this persists')
    ]
  }
  if (err.includes('401') || err.includes('Unauthorized')) {
    return [
      $gettext('Your session may have expired'),
      $gettext('Try logging out and back in')
    ]
  }
  return [
    $gettext('Try refreshing the page'),
    $gettext('Wait a moment and try again')
  ]
})

// Retry loading photos
function retryLoad() {
  error.value = null
  if (viewType.value === 'map') {
    mapPhotosLoaded.value = false
    loadMapPhotos()
  } else {
    loadPhotos()
  }
}

// Group photos by date
const groupedPhotos = computed(() => {
  const mode = groupMode.value
  const groups = new Map<string, PhotoWithDate[]>()

  for (const photo of displayedPhotos.value) {
    const dateKey = getGroupKey(photo.exifDate || '', mode)
    if (!dateKey) continue

    const existing = groups.get(dateKey) || []
    existing.push(photo)
    groups.set(dateKey, existing)
  }

  // Sort groups by date key (newest first)
  const sortedEntries = Array.from(groups.entries())
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))

  return sortedEntries
})

// Get group key based on mode
function getGroupKey(dateStr: string, mode: GroupMode): string {
  if (!dateStr) return ''

  // dateStr is YYYY-MM-DD
  const [year, month, day] = dateStr.split('-')
  if (!year || !month) return ''

  switch (mode) {
    case 'year':
      return year
    case 'month':
      return `${year}-${month}`
    case 'week':
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day || '1'))
      const weekNum = getISOWeek(date)
      return `${year}-W${String(weekNum).padStart(2, '0')}`
    case 'day':
    default:
      return dateStr
  }
}

/**
 * Time thresholds for photo sub-grouping (stacking) by view mode.
 *
 * Photos taken within these time windows are grouped into "stacks"
 * displayed as a single thumbnail with a count badge.
 *
 * Threshold rationale:
 *
 * - Day (60 seconds): Groups burst shots and quick sequences
 *   Typical use: Multiple shots of same subject, trying to get the right one
 *   60s catches burst mode while separating distinct moments
 *
 * - Week (1 hour): Groups photos from same activity/location visit
 *   Typical use: Photos at a restaurant, walking tour segment, event session
 *   1 hour keeps morning/afternoon at same place together
 *
 * - Month (24 hours): Groups photos from same day
 *   Typical use: Monthly view where each day might be one outing
 *   24 hours = "same day" regardless of actual time
 *
 * - Year (24 hours): Same as month - capped to prevent giant stacks
 *   Could theoretically use weekly threshold, but 24h keeps stacks reasonable
 *   Prevents single vacation from becoming one massive 500-photo stack
 *
 * All values in milliseconds.
 */
const SUB_GROUP_THRESHOLDS: Record<GroupMode, number> = {
  day: 60 * 1000,             // 60 seconds (burst detection)
  week: 60 * 60 * 1000,       // 1 hour (activity grouping)
  month: 24 * 60 * 60 * 1000, // 24 hours (same day)
  year: 24 * 60 * 60 * 1000   // 24 hours (capped at same-day)
}

/**
 * Extract timestamp from photo for sub-grouping
 * Uses the timestamp field if available (from native EXIF), otherwise computes from available data
 */
function getPhotoTimestamp(photo: PhotoWithDate): number {
  // Use pre-computed timestamp from EXIF extraction
  if (photo.timestamp) return photo.timestamp

  // Try to combine exifDate and exifTime
  if (photo.exifDate && photo.exifTime) {
    const ts = new Date(`${photo.exifDate}T${photo.exifTime}`).getTime()
    if (!isNaN(ts)) return ts
  }

  // Fallback: use file modification time
  const mtime = (photo as any).mdate || (photo as any).mtime
  if (mtime) {
    const ts = new Date(mtime).getTime()
    if (!isNaN(ts)) return ts
  }

  // Use date only with noon time as fallback
  if (photo.exifDate) {
    const ts = new Date(photo.exifDate + 'T12:00:00').getTime()
    if (!isNaN(ts)) return ts
  }

  return 0
}

/**
 * Get GPS location from a photo if available
 */
function getPhotoLocation(photo: PhotoWithDate): { lat: number, lon: number } | null {
  const loc = photo.graphPhoto?.location
  if (loc?.latitude != null && loc?.longitude != null) {
    return { lat: loc.latitude, lon: loc.longitude }
  }
  return null
}

/**
 * Distance threshold for location-based stack separation (in meters).
 *
 * 500m chosen because:
 * - Large enough to group photos at same venue (restaurant, park, building)
 * - Small enough to separate nearby but distinct locations (different shops)
 * - Accounts for GPS accuracy variation (±5-50m depending on conditions)
 * - Smaller than map clustering (1km) for finer-grained lightbox stacks
 *
 * Example: Photos 400m apart at same event stay grouped;
 * photos at two restaurants 600m apart become separate stacks.
 *
 * Only applies when BOTH photos have GPS data (common case: phone photos).
 * Photos without GPS rely solely on time threshold.
 */
const LOCATION_DISTANCE_THRESHOLD = 500

/**
 * Create sub-groups (stacks) from photos based on time proximity and location.
 *
 * Algorithm:
 * 1. Sort photos by timestamp (newest first)
 * 2. Walk through photos, comparing each to current stack's first photo
 * 3. Start new stack if time OR distance exceeds threshold
 * 4. Location-based splitting only works when both photos have GPS
 *
 * Stack ID format: `group-{timestamp}-{count}`
 * Note: This could theoretically produce duplicates if two stacks have
 * identical timestamps and sizes, but this is extremely rare in practice.
 */
function createSubGroups(photos: PhotoWithDate[], mode: GroupMode): PhotoSubGroup[] {
  if (photos.length === 0) return []

  const threshold = SUB_GROUP_THRESHOLDS[mode]

  // Sort by timestamp (newest first)
  const sorted = [...photos].map(p => ({
    ...p,
    timestamp: getPhotoTimestamp(p)
  })).sort((a, b) => b.timestamp - a.timestamp)

  const groups: PhotoSubGroup[] = []
  let currentGroup: PhotoWithDate[] = [sorted[0]]
  let currentGroupTime = sorted[0].timestamp
  let currentGroupLocation = getPhotoLocation(sorted[0])

  for (let i = 1; i < sorted.length; i++) {
    const photo = sorted[i]
    const timeDiff = Math.abs(currentGroupTime - photo.timestamp)
    const photoLocation = getPhotoLocation(photo)

    // Check if we should start a new group
    let shouldSplit = false

    // Time-based split
    if (timeDiff > threshold) {
      shouldSplit = true
    }

    // Location-based split (only if both photos have GPS data)
    if (!shouldSplit && currentGroupLocation && photoLocation) {
      const distance = calculateDistance(
        currentGroupLocation.lat, currentGroupLocation.lon,
        photoLocation.lat, photoLocation.lon
      )
      if (distance > LOCATION_DISTANCE_THRESHOLD) {
        shouldSplit = true
      }
    }

    if (!shouldSplit) {
      // Add to current group
      currentGroup.push(photo)
      // Update group location if this photo has one and group doesn't
      if (!currentGroupLocation && photoLocation) {
        currentGroupLocation = photoLocation
      }
    } else {
      // Finish current group and start new one
      groups.push({
        id: `group-${currentGroupTime}-${currentGroup.length}`,
        photos: currentGroup,
        timestamp: currentGroupTime
      })
      currentGroup = [photo]
      currentGroupTime = photo.timestamp
      currentGroupLocation = photoLocation
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push({
      id: `group-${currentGroupTime}-${currentGroup.length}`,
      photos: currentGroup,
      timestamp: currentGroupTime
    })
  }

  return groups
}

// Computed: grouped photos with sub-groups (stacks)
const groupedPhotosWithStacks = computed(() => {
  const mode = groupMode.value
  const result: Array<{ dateKey: string, subGroups: PhotoSubGroup[] }> = []

  for (const [dateKey, photos] of groupedPhotos.value) {
    const subGroups = createSubGroups(photos, mode)
    result.push({ dateKey, subGroups })
  }

  return result
})

// Current group context for lightbox navigation
const currentGroupPhotos = ref<PhotoWithDate[]>([])
const currentPhotoIndex = ref(0)

// Format date header for display
function formatDateHeader(dateKey: string): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  // Handle different formats based on mode
  if (dateKey.includes('-W')) {
    // Week format: 2026-W02
    const [year, week] = dateKey.split('-W')
    const weekNum = parseInt(week)
    const jan1 = new Date(parseInt(year), 0, 1)
    const startDate = new Date(jan1)
    startDate.setDate(jan1.getDate() + (weekNum - 1) * 7 - jan1.getDay() + 1)
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6)
    return `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  const parts = dateKey.split('-')
  if (parts.length === 1) {
    // Year only
    return parts[0]
  }
  if (parts.length === 2) {
    // Month: 2026-01
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1)
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
  }

  // Full date: 2026-01-11
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))

  if (date.toDateString() === today.toDateString()) return $gettext('Today')
  if (date.toDateString() === yesterday.toDateString()) return $gettext('Yesterday')

  return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

// Handle date filter change - reload photos starting from selected month
function onDateFilterChange() {
  loadPhotosFromFilter()
}

// Jump to today's date
function jumpToToday() {
  const now = new Date()
  filterYear.value = now.getFullYear()
  filterMonth.value = now.getMonth()
  loadPhotosFromFilter()
}

// Load photos for the selected month - resets view and loads from selected date
async function loadPhotosFromFilter() {
  // Simply delegate to loadPhotos which respects the filter values
  await loadPhotos()
}

// Scroll handler
function handleScroll() {
  if (!scrollContainer.value || loadingMore.value || isFullyLoaded.value) return

  const { scrollHeight, clientHeight, scrollTop } = scrollContainer.value
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight

  if (distanceFromBottom < SCROLL_THRESHOLD) {
    loadMorePhotos()
  }
}

/**
 * Parse WebDAV REPORT response XML into PhotoWithDate array.
 *
 * WebDAV XML Namespaces used:
 * - "DAV:" - Standard WebDAV namespace (RFC 4918)
 *   Elements: response, href, propstat, prop, getcontenttype, getcontentlength, getlastmodified
 *
 * - "http://owncloud.org/ns" - ownCloud/oCIS custom namespace
 *   Elements: fileid, photo-taken-date-time, photo-camera-make, photo-camera-model,
 *             photo-f-number, photo-focal-length, photo-iso, photo-orientation,
 *             photo-exposure-numerator, photo-exposure-denominator,
 *             photo-location-latitude, photo-location-longitude, photo-location-altitude
 *
 * Response structure:
 * ```xml
 * <d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
 *   <d:response>
 *     <d:href>/dav/spaces/spaceid/Photos/IMG_001.jpg</d:href>
 *     <d:propstat>
 *       <d:prop>
 *         <d:getcontenttype>image/jpeg</d:getcontenttype>
 *         <oc:fileid>abc123</oc:fileid>
 *         <oc:photo-taken-date-time>2024-01-15T10:30:00Z</oc:photo-taken-date-time>
 *         ...
 *       </d:prop>
 *     </d:propstat>
 *   </d:response>
 * </d:multistatus>
 * ```
 *
 * @param xmlText - Raw XML response from WebDAV REPORT request
 * @param spaceId - Storage space ID for constructing photo paths
 * @returns Array of PhotoWithDate objects with extracted metadata
 */
function parseSearchResponse(xmlText: string, spaceId: string): PhotoWithDate[] {
  const photos: PhotoWithDate[] = []
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')

  // Check for parse errors (malformed XML)
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    console.error('[Search] XML parse error:', parseError.textContent)
    return photos
  }

  // Find all response elements using DAV namespace
  const responses = doc.getElementsByTagNameNS('DAV:', 'response')

  for (let i = 0; i < responses.length; i++) {
    const response = responses[i]
    try {
      // Get the href (file path)
      const hrefEl = response.getElementsByTagNameNS('DAV:', 'href')[0]
      if (!hrefEl?.textContent) continue

      const href = decodeURIComponent(hrefEl.textContent)

      // Extract filename from path
      const pathParts = href.split('/')
      const fileName = pathParts[pathParts.length - 1]
      if (!fileName) continue

      // Get properties from propstat
      const propstat = response.getElementsByTagNameNS('DAV:', 'propstat')[0]
      if (!propstat) continue

      const prop = propstat.getElementsByTagNameNS('DAV:', 'prop')[0]
      if (!prop) continue

      // Get content type
      const contentTypeEl = prop.getElementsByTagNameNS('DAV:', 'getcontenttype')[0]
      const mimeType = contentTypeEl?.textContent || ''

      // Only process images
      if (!mimeType.startsWith('image/')) continue
      if (mimeType.includes('svg') || mimeType.includes('icon')) continue

      // Get file ID from oc:fileid
      const fileIdEl = prop.getElementsByTagNameNS('http://owncloud.org/ns', 'fileid')[0]
      const fileId = fileIdEl?.textContent || ''

      // Get size
      const sizeEl = prop.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]
      const size = sizeEl?.textContent ? parseInt(sizeEl.textContent, 10) : 0

      // Get last modified
      const lastModEl = prop.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]
      const lastModified = lastModEl?.textContent || ''

      // Get photo metadata properties (ownCloud namespace)
      const ocNs = 'http://owncloud.org/ns'
      const takenDateTimeEl = prop.getElementsByTagNameNS(ocNs, 'photo-taken-date-time')[0]
      const cameraMakeEl = prop.getElementsByTagNameNS(ocNs, 'photo-camera-make')[0]
      const cameraModelEl = prop.getElementsByTagNameNS(ocNs, 'photo-camera-model')[0]
      const fNumberEl = prop.getElementsByTagNameNS(ocNs, 'photo-f-number')[0]
      const focalLengthEl = prop.getElementsByTagNameNS(ocNs, 'photo-focal-length')[0]
      const isoEl = prop.getElementsByTagNameNS(ocNs, 'photo-iso')[0]
      const orientationEl = prop.getElementsByTagNameNS(ocNs, 'photo-orientation')[0]
      const exposureNumEl = prop.getElementsByTagNameNS(ocNs, 'photo-exposure-numerator')[0]
      const exposureDenEl = prop.getElementsByTagNameNS(ocNs, 'photo-exposure-denominator')[0]
      const latitudeEl = prop.getElementsByTagNameNS(ocNs, 'photo-location-latitude')[0]
      const longitudeEl = prop.getElementsByTagNameNS(ocNs, 'photo-location-longitude')[0]
      const altitudeEl = prop.getElementsByTagNameNS(ocNs, 'photo-location-altitude')[0]

      // Build GraphPhoto object
      const graphPhoto: GraphPhoto & { location?: GeoCoordinates } = {}

      if (cameraMakeEl?.textContent) graphPhoto.cameraMake = cameraMakeEl.textContent
      if (cameraModelEl?.textContent) graphPhoto.cameraModel = cameraModelEl.textContent
      if (fNumberEl?.textContent) graphPhoto.fNumber = parseFloat(fNumberEl.textContent)
      if (focalLengthEl?.textContent) graphPhoto.focalLength = parseFloat(focalLengthEl.textContent)
      if (isoEl?.textContent) graphPhoto.iso = parseInt(isoEl.textContent, 10)
      if (orientationEl?.textContent) graphPhoto.orientation = parseInt(orientationEl.textContent, 10)
      if (exposureNumEl?.textContent) graphPhoto.exposureNumerator = parseInt(exposureNumEl.textContent, 10)
      if (exposureDenEl?.textContent) graphPhoto.exposureDenominator = parseInt(exposureDenEl.textContent, 10)
      // Strip trailing 'Z' from takenDateTime — oCIS stores EXIF wall-clock time
      // (which has no timezone) as a UTC-suffixed ISO string. Removing the 'Z'
      // lets new Date() treat it as local time, which matches the original EXIF intent.
      if (takenDateTimeEl?.textContent) graphPhoto.takenDateTime = takenDateTimeEl.textContent.replace(/Z$/i, '')

      // Add location if available
      if (latitudeEl?.textContent || longitudeEl?.textContent) {
        graphPhoto.location = {}
        if (latitudeEl?.textContent) graphPhoto.location.latitude = parseFloat(latitudeEl.textContent)
        if (longitudeEl?.textContent) graphPhoto.location.longitude = parseFloat(longitudeEl.textContent)
        if (altitudeEl?.textContent) graphPhoto.location.altitude = parseFloat(altitudeEl.textContent)
      }

      // Extract date - prefer EXIF, fallback to last modified
      let exifDate: string
      let exifTime: string
      let timestamp: number
      let dateSource: string

      if (takenDateTimeEl?.textContent) {
        const d = new Date(takenDateTimeEl.textContent)
        exifDate = formatDateYMD(d)
        exifTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
        timestamp = d.getTime()
        dateSource = 'photo.takenDateTime'
      } else if (lastModified) {
        const d = new Date(lastModified)
        exifDate = formatDateYMD(d)
        exifTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
        timestamp = d.getTime()
        dateSource = 'lastModifiedDateTime'
      } else {
        continue // Skip if no date available
      }

      // Extract file path from href
      // href format: /dav/spaces/{spaceId}/path/to/file.jpg
      const spacePrefix = `/dav/spaces/${spaceId}`
      let filePath = href
      if (href.startsWith(spacePrefix)) {
        filePath = href.substring(spacePrefix.length)
      }
      // Also handle URL-encoded space prefix
      const encodedSpacePrefix = `/dav/spaces/${encodeURIComponent(spaceId)}`
      if (href.startsWith(encodedSpacePrefix)) {
        filePath = href.substring(encodedSpacePrefix.length)
      }

      // Create PhotoWithDate object
      const photoResource: PhotoWithDate = {
        id: fileId || `${spaceId}!${fileName}`,
        fileId: fileId,
        name: fileName,
        filePath: filePath,
        webDavPath: href,
        mimeType: mimeType,
        size: size,
        exifDate,
        exifTime,
        timestamp,
        dateSource,
        graphPhoto
      } as PhotoWithDate

      photos.push(photoResource)
    } catch {
      // Skip malformed response elements
    }
  }

  return photos
}

/**
 * Format date as YYYY-MM-DD for KQL queries.
 * Uses local date components to avoid UTC conversion shifting the date
 * near midnight (e.g., 11 PM EST → next day in UTC).
 */
function formatDateForKQL(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Calculate date range for search (default: 3 months back from given end date)
 */
function getSearchDateRange(endDate: Date, monthsBack: number = 3): { start: string, end: string } {
  const startDate = new Date(endDate)
  startDate.setMonth(startDate.getMonth() - monthsBack)

  return {
    start: formatDateForKQL(startDate),
    end: formatDateForKQL(endDate)
  }
}

/**
 * Fetch photos using WebDAV REPORT with KQL date filter
 * Uses server-side filtering to dramatically reduce response size
 * @param exifOnly - When true, filter by photo.takenDateTime (EXIF date). When false, filter by mtime (file modification date)
 */
async function fetchPhotosViaSearch(driveId: string, dateRange: { start: string, end: string }, useExifDate: boolean = true): Promise<PhotoWithDate[]> {
  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
  const spaceId = driveId

  // KQL pattern with date filter AND image type filter
  // Uses correct field names: mediatype (not mimeType)
  // Note: > and < must be XML-escaped in the pattern
  // When useExifDate is true: filter by photo.takenDateTime (EXIF capture date)
  // When useExifDate is false: filter by mtime (file modification date)
  const dateField = useExifDate ? 'photo.takenDateTime' : 'mtime'
  const pattern = `mediatype:image* AND ${dateField}&gt;=${dateRange.start} AND ${dateField}&lt;=${dateRange.end}`

  const searchBody = `<?xml version="1.0" encoding="UTF-8"?>
<oc:search-files xmlns:oc="http://owncloud.org/ns" xmlns:d="DAV:">
  <oc:search>
    <oc:pattern>${pattern}</oc:pattern>
    <oc:limit>5000</oc:limit>
  </oc:search>
  <d:prop>
    <d:displayname/>
    <d:getcontenttype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <oc:fileid/>
    <oc:photo-taken-date-time/>
    <oc:photo-camera-make/>
    <oc:photo-camera-model/>
    <oc:photo-f-number/>
    <oc:photo-focal-length/>
    <oc:photo-iso/>
    <oc:photo-orientation/>
    <oc:photo-exposure-numerator/>
    <oc:photo-exposure-denominator/>
    <oc:photo-location-latitude/>
    <oc:photo-location-longitude/>
    <oc:photo-location-altitude/>
  </d:prop>
</oc:search-files>`

  try {
    const response = await clientService.httpAuthenticated.request({
      method: 'REPORT',
      url: `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}`,
      headers: {
        'Content-Type': 'application/xml'
      },
      data: searchBody
    })

    const xmlText = typeof response.data === 'string' ? response.data : new XMLSerializer().serializeToString(response.data)
    const photos = parseSearchResponse(xmlText, spaceId)
    return photos
  } catch (err: any) {
    const status = err.response?.status
    if (status === 503) {
      throw new Error($gettext('The search service is temporarily unavailable (503 Service Unavailable). The service may be starting up or under maintenance.'))
    }
    if (status === 502) {
      throw new Error($gettext('The search service is not responding (502 Bad Gateway). Please try again in a moment.'))
    }
    if (status === 500) {
      throw new Error($gettext('The search service encountered an error (500 Internal Server Error). Please try again.'))
    }
    if (status === 401 || status === 403) {
      throw new Error($gettext('Authentication error (401 Unauthorized). Your session may have expired.'))
    }
    if (err.code === 'ECONNREFUSED' || err.message?.includes('Network')) {
      throw new Error($gettext('Unable to connect to the server. Please check your network connection.'))
    }
    throw new Error($gettext('Failed to search photos. Please try again.'))
  }
}

/**
 * Fallback: Fetch photos without date filter (for photos without EXIF dates)
 * Only called if date-filtered search returns nothing
 */
async function fetchAllImagesViaSearch(driveId: string): Promise<PhotoWithDate[]> {
  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
  const spaceId = driveId

  // Just filter by image type, no date filter (use correct field name: mediatype)
  const pattern = `mediatype:image*`

  const searchBody = `<?xml version="1.0" encoding="UTF-8"?>
<oc:search-files xmlns:oc="http://owncloud.org/ns" xmlns:d="DAV:">
  <oc:search>
    <oc:pattern>${pattern}</oc:pattern>
    <oc:limit>10000</oc:limit>
  </oc:search>
  <d:prop>
    <d:displayname/>
    <d:getcontenttype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <oc:fileid/>
    <oc:photo-taken-date-time/>
    <oc:photo-camera-make/>
    <oc:photo-camera-model/>
    <oc:photo-f-number/>
    <oc:photo-focal-length/>
    <oc:photo-iso/>
    <oc:photo-orientation/>
    <oc:photo-exposure-numerator/>
    <oc:photo-exposure-denominator/>
    <oc:photo-location-latitude/>
    <oc:photo-location-longitude/>
    <oc:photo-location-altitude/>
  </d:prop>
</oc:search-files>`

  try {
    const response = await clientService.httpAuthenticated.request({
      method: 'REPORT',
      url: `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}`,
      headers: {
        'Content-Type': 'application/xml'
      },
      data: searchBody
    })

    const xmlText = typeof response.data === 'string' ? response.data : new XMLSerializer().serializeToString(response.data)
    const photos = parseSearchResponse(xmlText, spaceId)
    return photos
  } catch (err: any) {
    const status = err.response?.status
    if (status === 503) {
      throw new Error($gettext('The search service is temporarily unavailable (503 Service Unavailable). The service may be starting up or under maintenance.'))
    }
    if (status === 502) {
      throw new Error($gettext('The search service is not responding (502 Bad Gateway). Please try again in a moment.'))
    }
    if (status === 500) {
      throw new Error($gettext('The search service encountered an error (500 Internal Server Error). Please try again.'))
    }
    if (status === 401 || status === 403) {
      throw new Error($gettext('Authentication error (401 Unauthorized). Your session may have expired.'))
    }
    if (err.code === 'ECONNREFUSED' || err.message?.includes('Network')) {
      throw new Error($gettext('Unable to connect to the server. Please check your network connection.'))
    }
    throw new Error($gettext('Failed to search photos. Please try again.'))
  }
}

/**
 * Fetch all photos with GPS coordinates for map view
 * Fetches all images and filters client-side for those with lat/lon
 */
async function fetchPhotosWithGPS(driveId: string): Promise<PhotoWithDate[]> {
  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
  const spaceId = driveId

  // Fetch all images - we'll filter for GPS client-side
  // KQL doesn't support filtering by location existence reliably
  const pattern = `mediatype:image*`

  const searchBody = `<?xml version="1.0" encoding="UTF-8"?>
<oc:search-files xmlns:oc="http://owncloud.org/ns" xmlns:d="DAV:">
  <oc:search>
    <oc:pattern>${pattern}</oc:pattern>
    <oc:limit>10000</oc:limit>
  </oc:search>
  <d:prop>
    <d:displayname/>
    <d:getcontenttype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <oc:fileid/>
    <oc:photo-taken-date-time/>
    <oc:photo-camera-make/>
    <oc:photo-camera-model/>
    <oc:photo-f-number/>
    <oc:photo-focal-length/>
    <oc:photo-iso/>
    <oc:photo-orientation/>
    <oc:photo-exposure-numerator/>
    <oc:photo-exposure-denominator/>
    <oc:photo-location-latitude/>
    <oc:photo-location-longitude/>
    <oc:photo-location-altitude/>
  </d:prop>
</oc:search-files>`

  try {
    const response = await clientService.httpAuthenticated.request({
      method: 'REPORT',
      url: `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}`,
      headers: {
        'Content-Type': 'application/xml'
      },
      data: searchBody
    })

    const xmlText = typeof response.data === 'string' ? response.data : new XMLSerializer().serializeToString(response.data)
    const allPhotos = parseSearchResponse(xmlText, spaceId)

    // Filter to only photos with GPS coordinates
    const photosWithGPS = allPhotos.filter(photo => {
      const loc = photo.graphPhoto?.location
      return loc?.latitude != null && loc?.longitude != null
    })

    return photosWithGPS
  } catch (err: any) {
    const status = err.response?.status
    if (status === 503) {
      throw new Error($gettext('The search service is temporarily unavailable (503 Service Unavailable). The service may be starting up or under maintenance.'))
    }
    if (status === 502) {
      throw new Error($gettext('The search service is not responding (502 Bad Gateway). Please try again in a moment.'))
    }
    if (status === 500) {
      throw new Error($gettext('The search service encountered an error (500 Internal Server Error). Please try again.'))
    }
    if (status === 401 || status === 403) {
      throw new Error($gettext('Authentication error (401 Unauthorized). Your session may have expired.'))
    }
    if (err.code === 'ECONNREFUSED' || err.message?.includes('Network')) {
      throw new Error($gettext('Unable to connect to the server. Please check your network connection.'))
    }
    throw new Error($gettext('Failed to load map photos. Please try again.'))
  }
}

// Promise reference for true mutex on map photo loading
let mapPhotosLoadingPromise: Promise<void> | null = null

/**
 * Load photos for the map view (with true mutex to prevent concurrent requests)
 */
function loadMapPhotos() {
  // Already loaded successfully
  if (mapPhotosLoaded.value) return

  // Return existing promise if already loading (true mutex)
  if (mapPhotosLoadingPromise) return mapPhotosLoadingPromise

  mapPhotosLoadingPromise = (async () => {
    try {
      loading.value = true

      // Find personal space (same pattern as loadPhotos)
      if (!personalSpace) {
        const spaces = spacesStore.spaces
        personalSpace = spaces.find((s: SpaceResource) => s.driveType === 'personal') || null
      }

      if (!personalSpace) {
        error.value = 'Could not find personal space'
        return
      }

      const photos = await fetchPhotosWithGPS(personalSpace.id)
      mapPhotos.value = photos
      mapPhotosLoaded.value = true

    } catch (err: any) {
      error.value = err.message || 'Failed to load map photos'
      // Don't set mapPhotosLoaded - leave false to allow retry
    } finally {
      loading.value = false
      mapPhotosLoadingPromise = null  // Clear promise reference
    }
  })()

  return mapPhotosLoadingPromise
}

// Track loaded date ranges to avoid duplicate fetches
const loadedRanges = ref<Array<{ start: string, end: string }>>([])

// Flag to indicate if we've fallen back to non-date-filtered search
let useFallbackSearch = false

/**
 * Check if screen needs more photos (not enough to fill visible area + buffer)
 */
function needsMorePhotos(): boolean {
  if (!scrollContainer.value) return allPhotos.value.length < MIN_PHOTOS_ON_SCREEN

  const { scrollHeight, clientHeight } = scrollContainer.value
  // Need more if content doesn't fill screen + scroll threshold
  return scrollHeight < clientHeight + SCROLL_THRESHOLD && !isFullyLoaded.value
}

// Months per search request - varies by group mode for optimal loading
function getMonthsPerBatch(): number {
  switch (groupMode.value) {
    case 'day': return 1      // Day view: 1 month at a time
    case 'week': return 2     // Week view: 2 months at a time
    case 'month': return 3    // Month view: 3 months at a time
    case 'year': return 6     // Year view: 6 months at a time
    default: return 3
  }
}

// Initial load - start from today (or selected filter date) and progressively load
async function loadPhotos() {
  loading.value = true
  error.value = null
  allPhotos.value = []
  loadedPhotoIds.value.clear()
  loadedRanges.value = []
  isFullyLoaded.value = false
  useFallbackSearch = false

  try {
    // Find personal space
    if (!personalSpace) {
      const spaces = spacesStore.spaces
      personalSpace = spaces.find((s: SpaceResource) => s.driveType === 'personal') || null
    }

    if (!personalSpace) {
      throw new Error($gettext('Could not find personal space'))
    }

    // Determine starting date based on filter
    let endDate: Date
    if (filterYear.value === new Date().getFullYear() && filterMonth.value === new Date().getMonth()) {
      endDate = new Date()
    } else {
      endDate = new Date(filterYear.value, filterMonth.value + 1, 0)
      const now = new Date()
      if (endDate > now) endDate = now
    }

    // Store the end date for progressive loading
    oldestLoadedDate.value = new Date(endDate)
    oldestLoadedDate.value.setDate(oldestLoadedDate.value.getDate() + 1)

    currentDateRange.value = $gettext('Loading recent photos...')

    // Load initial batch (3 months)
    await loadMorePhotos()

    // If no photos found with date filter, try fallback search
    if (allPhotos.value.length === 0 && !useFallbackSearch) {
      currentDateRange.value = $gettext('Searching all photos...')
      useFallbackSearch = true
      const photos = await fetchAllImagesViaSearch(personalSpace.id)

      // Filter out already loaded and sort
      const newPhotos = photos.filter(p => {
        const key = p.fileId || p.id || p.name
        if (loadedPhotoIds.value.has(key)) return false
        loadedPhotoIds.value.add(key)
        return true
      })

      newPhotos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      allPhotos.value = newPhotos
      isFullyLoaded.value = true
    }

    // Keep loading more months until screen is filled
    let loopGuard = 0
    while (needsMorePhotos() && !isFullyLoaded.value && !useFallbackSearch && loopGuard < 10) {
      loopGuard++
      await loadMorePhotos()
    }

  } catch (err: any) {
    error.value = err.message || 'Failed to load photos'
  } finally {
    loading.value = false
  }
}

// Load more photos (older dates) - called on scroll or initial fill
async function loadMorePhotos() {
  if (loadingMore.value || isFullyLoaded.value || useFallbackSearch) return
  if (!personalSpace) return

  loadingMore.value = true

  try {
    // Calculate date range based on group mode
    const endDate = new Date(oldestLoadedDate.value)
    endDate.setDate(endDate.getDate() - 1)

    const dateRange = getSearchDateRange(endDate, getMonthsPerBatch())

    currentDateRange.value = `${dateRange.start} to ${dateRange.end}`

    // Check if we've gone too far back (10 years)
    const startDate = new Date(dateRange.start)
    const today = new Date()
    const yearsDiff = (today.getTime() - startDate.getTime()) / (365 * 24 * 60 * 60 * 1000)
    if (yearsDiff > 10) {
      isFullyLoaded.value = true
      return
    }

    // Fetch photos from server with date filter
    // Pass exifOnly.value to determine which date field to filter by
    const photos = await fetchPhotosViaSearch(personalSpace.id, dateRange, exifOnly.value)

    // Track this range as loaded
    loadedRanges.value.push(dateRange)

    // Update oldest loaded date for next batch
    oldestLoadedDate.value = startDate

    // Filter duplicates and add new photos
    const newPhotos = photos.filter(p => {
      const key = p.fileId || p.id || p.name
      if (loadedPhotoIds.value.has(key)) return false
      loadedPhotoIds.value.add(key)
      return true
    })

    if (newPhotos.length > 0) {
      // Sort new photos by date (newest first)
      newPhotos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      // Append to existing (older photos go at end)
      allPhotos.value = [...allPhotos.value, ...newPhotos]
    }

    // If we got very few photos, we might be near the end
    // But don't mark fully loaded yet - let user keep scrolling
    if (photos.length === 0 && loadedRanges.value.length > 5) {
      // After 5 empty batches (15 months), assume we're done
      const emptyBatches = loadedRanges.value.slice(-5)
      if (emptyBatches.length >= 5) {
        isFullyLoaded.value = true
      }
    }

  } finally {
    loadingMore.value = false
  }
}

// Cache for blob URLs to avoid refetching (with LRU eviction)
// Using shallowRef for efficient reactivity - only triggers when we call triggerRef
const blobUrlCache = shallowRef(new Map<string, string>())
const MAX_THUMBNAIL_CACHE = 500 // Keep 500 thumbnails in memory (~25MB)

// Evict oldest entries when cache exceeds max size
function evictOldestThumbnails() {
  const cache = blobUrlCache.value
  while (cache.size > MAX_THUMBNAIL_CACHE) {
    const firstKey = cache.keys().next().value
    if (firstKey) {
      const blobUrl = cache.get(firstKey)
      if (blobUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl)
      }
      cache.delete(firstKey)
    }
  }
}

// Request queue to limit concurrent fetches
const MAX_CONCURRENT_FETCHES = 4
const MAX_QUEUE_SIZE = 100  // Sized for map view which loads all visible markers at once
let activeFetches = 0
const fetchQueue: Array<{ photo: PhotoWithDate, cacheKey: string }> = []
const pendingFetches = new Set<string>()

// Track visible photo elements for viewport-based loading
const visiblePhotoIds = new Set<string>()
let thumbnailObserver: IntersectionObserver | null = null

/**
 * Clear the fetch queue - called when view changes to prevent stale fetches.
 */
function clearFetchQueue() {
  fetchQueue.length = 0
  pendingFetches.clear()
  visiblePhotoIds.clear()
}

/**
 * Initialize IntersectionObserver for viewport-based thumbnail loading.
 * Only loads thumbnails for photos that are actually visible on screen.
 */
function initThumbnailObserver() {
  if (thumbnailObserver) return

  thumbnailObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const photoId = (entry.target as HTMLElement).dataset.photoId
        if (!photoId) continue

        if (entry.isIntersecting) {
          // Photo became visible - mark it and trigger fetch
          visiblePhotoIds.add(photoId)

          // If not cached, queue the fetch
          if (!blobUrlCache.value.has(photoId) && !pendingFetches.has(photoId)) {
            // Find the photo in allPhotos to get full data
            const photo = allPhotos.value.find(p => {
              const key = p.id || p.fileId || p.name
              return key === photoId
            })
            if (photo) {
              queuePhotoFetch(photo, photoId)
            }
          }
        } else {
          // Photo left viewport - remove from visible set
          visiblePhotoIds.delete(photoId)
        }
      }
    },
    {
      // Load 2 extra rows worth of content (500px ≈ 2-3 rows of thumbnails)
      // This ensures enough content loads to enable scrollbar for infinite scroll
      rootMargin: '500px 0px',
      threshold: 0
    }
  )
}

/**
 * Observe a photo element for visibility-based loading.
 * Call this on each photo img element via ref callback.
 */
function observePhoto(el: HTMLElement | null, photoId: string) {
  if (!el || !thumbnailObserver) return

  // Set data attribute for identification in observer callback
  el.dataset.photoId = photoId
  thumbnailObserver.observe(el)
}

/**
 * Get photo URL - returns cached blob URL or placeholder.
 * Does NOT automatically queue fetches - use queuePhotoFetch for that.
 * This prevents fetching off-screen photos during Vue re-renders.
 */
function getPhotoUrl(photo: Resource): string {
  // Access shallowRef to track dependency - Vue will re-render when triggerRef is called
  const cache = blobUrlCache.value

  const p = photo as PhotoWithDate

  // Check if we already have a blob URL cached
  const cacheKey = p.id || p.fileId || p.name
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!
  }

  // Only queue fetch if this photo is marked as visible by IntersectionObserver
  if (visiblePhotoIds.has(cacheKey) && !pendingFetches.has(cacheKey)) {
    queuePhotoFetch(p, cacheKey)
  }

  // Return a placeholder while loading
  return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f0f0f0" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="10">Loading...</text></svg>'
}

/**
 * Queue thumbnails for map view photos using the shared fetch queue.
 * Map photos bypass IntersectionObserver (they're in Leaflet's DOM, not Vue's),
 * so we call queuePhotoFetch directly instead of relying on visiblePhotoIds.
 */
function queueMapThumbnails(photos: PhotoWithDate[]) {
  for (const photo of photos) {
    const cacheKey = photo.id || photo.fileId || photo.name
    if (!blobUrlCache.value.has(cacheKey) && !pendingFetches.has(cacheKey)) {
      queuePhotoFetch(photo, cacheKey)
    }
  }
}

/**
 * Queue a photo for fetching. Called by IntersectionObserver when photo becomes visible.
 */
function queuePhotoFetch(photo: PhotoWithDate, cacheKey: string) {
  if (pendingFetches.has(cacheKey)) return
  if (blobUrlCache.value.has(cacheKey)) return

  // Limit queue size - drop oldest (stale) requests if full
  while (fetchQueue.length >= MAX_QUEUE_SIZE) {
    const dropped = fetchQueue.shift()
    if (dropped) {
      pendingFetches.delete(dropped.cacheKey)
    }
  }

  pendingFetches.add(cacheKey)
  fetchQueue.push({ photo, cacheKey })
  processQueue()
}

// Process the fetch queue
function processQueue() {
  while (activeFetches < MAX_CONCURRENT_FETCHES && fetchQueue.length > 0) {
    const item = fetchQueue.shift()
    if (item) {
      activeFetches++
      doFetch(item.photo, item.cacheKey).finally(() => {
        activeFetches--
        pendingFetches.delete(item.cacheKey)
        processQueue()
      })
    }
  }
}

// Create a nice placeholder SVG for files without thumbnails
function createPlaceholderSvg(filename: string): string {
  // Extract file extension
  const ext = filename.split('.').pop()?.toUpperCase() || '?'

  // Create an SVG with a camera icon and file extension
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect fill="%23f0f0f0" width="100" height="100" rx="4"/>
    <rect x="25" y="35" width="50" height="35" rx="3" fill="%23999"/>
    <circle cx="50" cy="52" r="10" fill="%23f0f0f0"/>
    <circle cx="50" cy="52" r="7" fill="%23777"/>
    <rect x="35" y="30" width="12" height="6" rx="1" fill="%23999"/>
    <text x="50" y="85" text-anchor="middle" fill="%23666" font-size="12" font-family="system-ui, sans-serif" font-weight="600">${ext}</text>
  </svg>`

  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

// Fetch image with authentication and cache as blob URL
async function doFetch(photo: PhotoWithDate, cacheKey: string) {
  const cache = blobUrlCache.value
  if (cache.has(cacheKey)) {
    return
  }

  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
  if (!personalSpace) {
    return
  }

  const spaceId = personalSpace.id
  const photoPath = photo.filePath || photo.name || ''
  if (!photoPath) {
    return
  }

  const encodedPath = photoPath.split('/').map(segment => encodeURIComponent(segment)).join('/')
  const url = `${serverUrl}/dav/spaces/${spaceId}${encodedPath}?preview=1&x=256&y=256&a=1`

  try {
    const response = await clientService.httpAuthenticated.get(url, {
      responseType: 'blob'
    } as any)

    const blob = response.data as Blob
    const blobUrl = URL.createObjectURL(blob)
    cache.set(cacheKey, blobUrl)
    evictOldestThumbnails()

    // Trigger reactivity update for components using this cache
    triggerRef(blobUrlCache)
  } catch {
    // Cache a nice placeholder showing file type
    const filename = photo.name || photoPath.split('/').pop() || 'unknown'
    cache.set(cacheKey, createPlaceholderSvg(filename))
    evictOldestThumbnails()

    // Trigger reactivity update
    triggerRef(blobUrlCache)
  }
}

function openPhoto(photo: PhotoWithDate, groupPhotos?: PhotoWithDate[]) {
  selectedPhoto.value = photo

  // Set up group navigation context
  if (groupPhotos && groupPhotos.length > 1) {
    currentGroupPhotos.value = groupPhotos
    currentPhotoIndex.value = groupPhotos.findIndex(p =>
      (p.fileId || p.id || p.path) === (photo.fileId || photo.id || photo.path)
    )
    if (currentPhotoIndex.value < 0) currentPhotoIndex.value = 0
  } else {
    currentGroupPhotos.value = [photo]
    currentPhotoIndex.value = 0
  }
}

function openStack(subGroup: PhotoSubGroup) {
  // Open the first photo in the stack with group context
  if (subGroup.photos.length > 0) {
    openPhoto(subGroup.photos[0], subGroup.photos)
  }
}

function openPhotoFromMap(photo: PhotoWithDate, groupPhotos?: PhotoWithDate[]) {
  // Open photo from map view with optional group navigation
  openPhoto(photo, groupPhotos)
}

function onMapVisibleCountChange(visibleCount: number, totalCount: number) {
  mapVisibleCount.value = visibleCount
  mapTotalCount.value = totalCount
}

function navigatePhoto(direction: 'prev' | 'next') {
  if (currentGroupPhotos.value.length <= 1) return

  if (direction === 'prev' && currentPhotoIndex.value > 0) {
    currentPhotoIndex.value--
    selectedPhoto.value = currentGroupPhotos.value[currentPhotoIndex.value]
  } else if (direction === 'next' && currentPhotoIndex.value < currentGroupPhotos.value.length - 1) {
    currentPhotoIndex.value++
    selectedPhoto.value = currentGroupPhotos.value[currentPhotoIndex.value]
  }
}

function closeLightbox() {
  selectedPhoto.value = null
  currentGroupPhotos.value = []
  currentPhotoIndex.value = 0
}

function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement
  img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ddd" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="12">No preview</text></svg>'
}

// Context menu functions
function closeContextMenu() {
  contextMenuVisible.value = false
  contextMenuPhoto.value = null
}

function handleLightboxAction(action: string, photo: Resource) {
  handleContextAction(action, photo as PhotoWithDate)
}

async function handleContextAction(action: string, photo: PhotoWithDate) {
  switch (action) {
    case 'download':
      await downloadPhoto(photo)
      break
    case 'openInFiles':
      openInFiles(photo)
      break
    case 'copyLink':
      await copyPhotoLink(photo)
      break
    case 'delete':
      await confirmAndDelete(photo)
      break
  }
}

async function downloadPhoto(photo: PhotoWithDate) {
  const cacheKey = photo.id || (photo as any).fileId || photo.name
  let url = blobUrlCache.value.get(cacheKey)

  if (!url || url.startsWith('data:')) {
    // Fetch full image if not cached or is placeholder
    const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
    const spaceId = personalSpace?.id || ''
    const photoPath = (photo as any).filePath || photo.name || ''
    const encodedPath = photoPath.split('/').map((s: string) => encodeURIComponent(s)).join('/')
    const fetchUrl = `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}${encodedPath}`

    try {
      const response = await clientService.httpAuthenticated.get(fetchUrl, {
        responseType: 'blob'
      } as any)
      const blob = response.data as Blob
      url = URL.createObjectURL(blob)
    } catch {
      alert('Failed to download photo. Please try again.')
      return
    }
  }

  const link = document.createElement('a')
  link.href = url
  link.download = photo.name || 'photo'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function openInFiles(photo: PhotoWithDate) {
  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
  const fileId = (photo as any).fileId || photo.id || ''
  const filePath = (photo as any).filePath || photo.name || ''

  // Get the drive alias (e.g., "personal/paul")
  const driveAlias = (personalSpace as any)?.driveAlias || 'personal/home'

  // Build the full path for preview URL: driveAlias + filePath
  const fullPath = `${driveAlias}${filePath}`
  const encodedFullPath = fullPath.split('/').map((s: string) => encodeURIComponent(s)).join('/')

  // Get folder path (without filename) for contextRouteParams
  const lastSlash = filePath.lastIndexOf('/')
  const folderPath = lastSlash > 0 ? filePath.substring(0, lastSlash) : ''
  const driveAliasAndItem = `${driveAlias}${folderPath}`

  // Get parent folder's fileId from parentReference if available
  const parentId = (photo as any).parentReference?.id || ''

  // Build the preview URL with context parameters
  const params = new URLSearchParams()
  params.set('fileId', fileId)
  params.set('contextRouteName', 'files-spaces-generic')
  params.set('contextRouteParams.driveAliasAndItem', driveAliasAndItem)
  if (parentId) {
    params.set('contextRouteQuery.fileId', parentId)
  }

  const previewUrl = `${serverUrl}/preview/${encodedFullPath}?${params.toString()}`
  window.open(previewUrl, '_blank')
}

async function copyPhotoLink(photo: PhotoWithDate) {
  const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
  const fileId = (photo as any).fileId || photo.id || ''

  // Use the short /f/{fileId} format
  const shareUrl = `${serverUrl}/f/${encodeURIComponent(fileId)}`

  try {
    await navigator.clipboard.writeText(shareUrl)
    alert('Link copied to clipboard!')
  } catch {
    alert('Failed to copy link. Please try again.')
  }
}

async function confirmAndDelete(photo: PhotoWithDate) {
  const confirmed = confirm(`Are you sure you want to delete "${photo.name}"?\n\nThe file will be moved to the recycle bin.`)
  if (!confirmed) return

  try {
    const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
    const spaceId = personalSpace?.id || ''
    const filePath = (photo as any).filePath || photo.name || ''
    const encodedPath = filePath.split('/').map((s: string) => encodeURIComponent(s)).join('/')

    await clientService.httpAuthenticated.delete(
      `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}${encodedPath}`
    )

    // Remove from local state
    const photoKey = photo.id || (photo as any).fileId || photo.name
    allPhotos.value = allPhotos.value.filter(p => {
      const key = p.id || (p as any).fileId || p.name
      return key !== photoKey
    })
    loadedPhotoIds.value.delete(photoKey)

    // Clean up blob cache
    const cache = blobUrlCache.value
    if (cache.has(photoKey)) {
      const cachedUrl = cache.get(photoKey)
      if (cachedUrl && cachedUrl.startsWith('blob:')) {
        URL.revokeObjectURL(cachedUrl)
      }
      cache.delete(photoKey)
    }

    // Handle lightbox state after deletion
    if (currentGroupPhotos.value.length > 0) {
      // Remove deleted photo from current group
      const deletedIndex = currentGroupPhotos.value.findIndex(p => {
        const key = p.id || (p as any).fileId || p.name
        return key === photoKey
      })

      if (deletedIndex >= 0) {
        currentGroupPhotos.value.splice(deletedIndex, 1)

        if (currentGroupPhotos.value.length === 0) {
          // No more photos in stack, close lightbox
          closeLightbox()
        } else {
          // Adjust index and show next/prev photo
          if (currentPhotoIndex.value >= currentGroupPhotos.value.length) {
            currentPhotoIndex.value = currentGroupPhotos.value.length - 1
          }
          selectedPhoto.value = currentGroupPhotos.value[currentPhotoIndex.value]
        }
      }
    }
  } catch {
    alert('Failed to delete photo. Please try again.')
  }
}

function injectStyles() {
  // Unique scoped ID to avoid conflicts with other extensions/apps
  const styleId = 'ocis-photo-addon-v1-styles'
  if (document.getElementById(styleId)) return

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    .photos-app {
      padding: 0 1.5rem 1.5rem 1.5rem;
      flex: 1 1 auto;
      overflow-y: auto;
      overflow-x: hidden;
      max-height: calc(100vh - 60px);
      background: var(--oc-color-background-default, #fff);
      touch-action: pan-y; /* Allow vertical scroll, prevent browser pinch-zoom */
    }
    .photos-header {
      margin-bottom: 1rem;
      position: sticky;
      top: 0;
      background: var(--oc-color-background-default, #fff);
      z-index: 4; /* Lower than #oc-topbar's z-index of 5 */
      padding: 1rem 0 0.5rem 0;
      margin-left: -1.5rem;
      margin-right: -1.5rem;
      padding-left: 1.5rem;
      padding-right: 1.5rem;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .photos-header h1 {
      margin: 0;
      font-size: 1.5rem;
      color: var(--oc-color-text-default, #333);
    }
    .view-selector {
      display: flex;
      align-items: center;
      gap: 2px;
      background: var(--oc-color-background-muted, #e5e5e5);
      border-radius: 6px;
      padding: 2px;
    }
    .view-btn {
      padding: 6px 12px;
      border: none;
      background: transparent;
      color: var(--oc-color-text-default, #333);
      font-size: 0.875rem;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.15s ease;
    }
    .view-btn:hover {
      background: var(--oc-color-background-default, #fff);
    }
    .view-btn.active {
      background: var(--oc-color-background-default, #fff);
      color: var(--oc-color-swatch-primary-default, #0070c0);
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    /* Header controls container */
    .header-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    /* Control labels */
    .control-label {
      font-size: 0.875rem;
      color: var(--oc-color-text-muted, #666);
      white-space: nowrap;
    }
    /* Date filter */
    .date-filter {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .date-select {
      padding: 6px 10px;
      border: 1px solid var(--oc-color-border, #ddd);
      border-radius: 4px;
      background: var(--oc-color-background-default, #fff);
      color: var(--oc-color-text-default, #333);
      font-size: 0.875rem;
      cursor: pointer;
      min-width: 80px;
    }
    .date-select:hover {
      border-color: var(--oc-color-swatch-primary-default, #0070c0);
    }
    .date-select:focus {
      outline: none;
      border-color: var(--oc-color-swatch-primary-default, #0070c0);
      box-shadow: 0 0 0 2px rgba(0, 112, 192, 0.2);
    }
    .today-btn {
      padding: 6px 12px;
      border: 1px solid var(--oc-color-swatch-primary-default, #0070c0);
      border-radius: 4px;
      background: transparent;
      color: var(--oc-color-swatch-primary-default, #0070c0);
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .today-btn:hover {
      background: var(--oc-color-swatch-primary-default, #0070c0);
      color: white;
    }
    /* EXIF only toggle */
    .exif-toggle {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      background: var(--oc-color-background-muted, #f0f0f0);
      transition: background 0.15s ease;
    }
    .exif-toggle:hover {
      background: var(--oc-color-background-highlight, #e5e5e5);
    }
    .exif-toggle input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: var(--oc-color-swatch-primary-default, #0070c0);
    }
    .exif-toggle .toggle-label {
      font-size: 0.875rem;
      color: var(--oc-color-text-default, #333);
      white-space: nowrap;
    }
    .photo-count, .loading-status {
      color: var(--oc-color-text-muted, #666);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid var(--oc-color-border, #ddd);
      border-top-color: var(--oc-color-swatch-primary-default, #0070c0);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .load-more-hint {
      color: var(--oc-color-swatch-primary-default, #0070c0);
      font-style: italic;
    }
    .complete-hint {
      color: var(--oc-color-swatch-success-default, #2a7b2a);
    }
    .error { color: var(--oc-color-swatch-danger-default, #c00); }
    /* Error state styling */
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 2rem;
      text-align: center;
      min-height: 300px;
    }
    .error-icon {
      color: var(--oc-color-swatch-danger-default, #c00);
      margin-bottom: 1.5rem;
      opacity: 0.8;
    }
    .error-title {
      margin: 0 0 0.75rem 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--oc-color-text-default, #333);
    }
    .error-message {
      margin: 0 0 1.5rem 0;
      font-size: 1rem;
      color: var(--oc-color-text-muted, #666);
      max-width: 500px;
      line-height: 1.5;
    }
    .error-suggestions {
      background: var(--oc-color-background-muted, #f5f5f5);
      border-radius: 8px;
      padding: 1rem 1.5rem;
      margin-bottom: 1.5rem;
      text-align: left;
      max-width: 400px;
    }
    .suggestions-label {
      margin: 0 0 0.5rem 0;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--oc-color-text-default, #333);
    }
    .error-suggestions ul {
      margin: 0;
      padding-left: 1.25rem;
    }
    .error-suggestions li {
      font-size: 0.875rem;
      color: var(--oc-color-text-muted, #666);
      margin-bottom: 0.35rem;
      line-height: 1.4;
    }
    .error-suggestions li:last-child {
      margin-bottom: 0;
    }
    .retry-button {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: var(--oc-color-swatch-primary-default, #0070c0);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s, transform 0.15s;
    }
    .retry-button:hover {
      background: var(--oc-color-swatch-primary-hover, #005a9e);
      transform: translateY(-1px);
    }
    .retry-button:active {
      transform: translateY(0);
    }
    .retry-icon {
      font-size: 1.2rem;
      display: inline-block;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
      color: var(--oc-color-text-muted, #666);
    }
    .empty-icon { font-size: 4rem; margin-bottom: 1rem; }
    .empty-hint { font-size: 0.875rem; opacity: 0.7; }
    .photo-groups {
      position: relative;
    }
    .date-group {
      padding: 0 0 1rem 0;
    }
    .date-header {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0 0 0.75rem 0;
      color: var(--oc-color-text-default, #333);
      border-bottom: 1px solid var(--oc-color-border, #ddd);
      padding-bottom: 0.5rem;
      background: var(--oc-color-background-default, #fff);
    }
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 1.5rem;
    }
    .photo-item {
      position: relative;
      z-index: 0;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: 8px;
      cursor: pointer;
      background: var(--oc-color-background-muted, #f5f5f5);
      transition: transform 0.2s, box-shadow 0.2s;
      isolation: isolate;
    }
    .photo-item:hover {
      transform: scale(1.02);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .photo-item img { width: 100%; height: 100%; object-fit: contain; background: var(--oc-color-background-muted, #f0f0f0); }
    .photo-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
      padding: 0.5rem;
      color: white;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
    }
    .photo-item:hover .photo-overlay { opacity: 1; }
    /* Context menu button on photos */
    .photo-menu-btn {
      position: absolute;
      top: 0.25rem;
      right: 0.25rem;
      width: 1.75rem;
      height: 1.75rem;
      border: none;
      background: rgba(0, 0, 0, 0.5);
      color: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1.1rem;
      font-weight: bold;
      opacity: 0;
      transition: opacity 0.2s, background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5;
      line-height: 1;
    }
    .photo-item:hover .photo-menu-btn {
      opacity: 1;
    }
    .photo-menu-btn:hover {
      background: rgba(0, 0, 0, 0.7);
    }
    .photo-name {
      font-size: 0.75rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
    .loading-more {
      text-align: center;
      padding: 2rem;
      color: var(--oc-color-text-muted, #666);
      font-style: italic;
    }
    /* Lightbox styles */
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
    }
    .lightbox-container {
      display: flex;
      flex-direction: column;
      background: var(--oc-color-background-default, #fff);
      border-radius: 8px;
      overflow: hidden;
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
    .nav-arrow { font-weight: bold; line-height: 1; }
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
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      overflow: hidden;
      flex-shrink: 0;
    }
    .lightbox-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
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
    .lightbox-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--oc-color-text-default, #333);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      margin-right: 1rem;
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
    .metadata-value.exif-source {
      color: var(--oc-color-swatch-success-default, #2a7b2a);
      font-weight: 500;
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
    .lightbox-loading {
      color: white;
      font-size: 1.2rem;
    }
    /* Fade transition */
    .fade-enter-active,
    .fade-leave-active {
      transition: opacity 0.2s ease;
    }
    .fade-enter-from,
    .fade-leave-to {
      opacity: 0;
    }
    /* PhotoStack styles */
    .photo-stack {
      position: relative;
      z-index: 0;
      aspect-ratio: 1;
      cursor: pointer;
      isolation: isolate;
    }
    .stack-layer {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 8px;
      overflow: hidden;
      background: var(--oc-color-background-muted, #e5e5e5);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .stack-layer img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: var(--oc-color-background-muted, #f0f0f0);
    }
    .stack-top {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 8px;
      overflow: hidden;
      background: var(--oc-color-background-muted, #f5f5f5);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      z-index: 10;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .photo-stack:hover .stack-top {
      transform: scale(1.02);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }
    .stack-top img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: var(--oc-color-background-muted, #f0f0f0);
    }
    .stack-badge {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background: var(--oc-color-swatch-primary-default, #0070c0);
      color: white;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 10px;
      z-index: 20;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    .stack-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
      padding: 0.5rem;
      color: white;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 15;
      border-radius: 0 0 8px 8px;
    }
    .photo-stack:hover .stack-overlay {
      opacity: 1;
    }
    .stack-name {
      font-size: 0.75rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
    .stack-count {
      font-size: 0.65rem;
      opacity: 0.8;
    }

    /* Zoom level indicator */
    .zoom-indicator {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.75);
      color: white;
      padding: 2rem 4rem;
      border-radius: 16px;
      font-size: 3rem;
      font-weight: 600;
      z-index: 1000;
      pointer-events: none;
    }

    .zoom-fade-enter-active,
    .zoom-fade-leave-active {
      transition: opacity 0.3s ease;
    }

    .zoom-fade-enter-from,
    .zoom-fade-leave-to {
      opacity: 0;
    }

    /* Map view container */
    .map-view-container {
      width: 100%;
      flex: 1 1 auto;
      min-height: 400px;
      height: calc(100vh - 200px); /* Fallback: viewport minus header/controls */
      touch-action: none;
      overflow: hidden;
    }
    /* When map is shown, make photos-app a flex column to let map fill space */
    .photos-app:has(.map-view-container) {
      display: flex;
      flex-direction: column;
      overflow: hidden; /* Prevent scroll when map is shown */
    }
    .photos-app:has(.map-view-container) .photos-header {
      flex-shrink: 0;
    }
    .map-placeholder {
      text-align: center;
      padding: 3rem 2rem;
      background: var(--oc-color-background-muted, #f5f5f5);
      border-radius: 12px;
      max-width: 400px;
    }
    .map-placeholder .map-icon {
      font-size: 4rem;
      display: block;
      margin-bottom: 1rem;
    }
    .map-placeholder h2 {
      margin: 0 0 0.75rem 0;
      font-size: 1.5rem;
      color: var(--oc-color-text-default, #333);
    }
    .map-placeholder p {
      margin: 0;
      color: var(--oc-color-text-muted, #666);
      font-size: 0.95rem;
      line-height: 1.5;
    }
  `
  document.head.appendChild(style)
}

// Save settings to localStorage on change
watch(groupMode, (newVal) => {
  // Clear fetch queue when view changes to prevent stale fetches
  clearFetchQueue()

  try {
    localStorage.setItem(STORAGE_KEY_GROUP_MODE, newVal)
  } catch {
    // ignore
  }
})

watch(exifOnly, (newVal) => {
  try {
    localStorage.setItem(STORAGE_KEY_EXIF_ONLY, String(newVal))
  } catch {
    // ignore
  }
  // Reload photos with new filter when toggle changes
  loadPhotos()
})

watch(viewType, (newVal) => {
  try {
    localStorage.setItem(STORAGE_KEY_VIEW_TYPE, newVal)
  } catch {
    // ignore
  }

  // Load map photos when switching to map view
  if (newVal === 'map') {
    loadMapPhotos()
  }
}, { immediate: true })  // Run immediately to handle initial value

onMounted(() => {
  injectStyles()
  initThumbnailObserver()
  loadPhotos()
  // Add keyboard listener for zoom shortcuts (+, -, 0)
  document.addEventListener('keydown', handleZoomKeydown)
})

onUnmounted(() => {
  // Remove keyboard listener for zoom shortcuts
  document.removeEventListener('keydown', handleZoomKeydown)

  // Clean up IntersectionObserver
  if (thumbnailObserver) {
    thumbnailObserver.disconnect()
    thumbnailObserver = null
  }
  visiblePhotoIds.clear()

  // Clean up zoom indicator timeout to prevent memory leak
  if (zoomIndicatorTimeout !== null) {
    clearTimeout(zoomIndicatorTimeout)
    zoomIndicatorTimeout = null
  }

  // Clean up blob URLs from thumbnail cache
  const cache = blobUrlCache.value
  for (const [, blobUrl] of cache) {
    if (blobUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(blobUrl)
    }
  }
  cache.clear()
})
</script>

<style scoped>
/* Scoped styles as backup */
</style>
