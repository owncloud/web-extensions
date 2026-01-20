<template>
  <div class="photo-map-wrapper">
    <div class="photo-map-container">
      <div ref="mapContainer" class="map-element"></div>
      <div v-if="photosWithGps === 0" class="no-gps-overlay">
        <span class="icon">📍</span>
        <p>{{ t('empty.noGpsPhotos') }}</p>
      </div>
      <div class="map-stats">
        {{ t('map.photosInView', { visible: visiblePhotosInView.length, total: photosWithGps }) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'  // Bundle CSS instead of CDN (CSP blocks external stylesheets)
import type { GeoCoordinates, PhotoWithDate } from '../types'
import { useI18n } from '../composables/useI18n'

// Initialize i18n
const { t } = useI18n()

// Use PhotoWithDate from types (aliased for clarity in this component)
type PhotoWithLocation = PhotoWithDate

const props = withDefaults(defineProps<{
  photos: PhotoWithLocation[]
  getThumbnailUrl: (photo: PhotoWithLocation) => string
  defaultCenter?: [number, number]
  defaultZoom?: number
}>(), {
  defaultCenter: () => [56, -96],  // Canada default (configurable via props)
  defaultZoom: 4
})

const emit = defineEmits<{
  (e: 'photo-click', photo: PhotoWithLocation, group: PhotoWithLocation[]): void
  (e: 'visible-count-change', visibleCount: number, totalCount: number): void
}>()

const mapContainer = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let resizeObserver: ResizeObserver | null = null
let hadStoredPosition = false  // Track if we restored from localStorage
let activeTooltip: HTMLElement | null = null  // Track active tooltip for cleanup

/**
 * Escape HTML special characters for safe text content.
 * Uses the browser's built-in escaping via textContent → innerHTML.
 */
function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

/**
 * Escape HTML special characters for use in attributes.
 * More comprehensive than escapeHtml to handle attribute context.
 */
function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Visible photos in current viewport
const visiblePhotosInView = ref<PhotoWithLocation[]>([])

// LocalStorage keys for map position persistence
const STORAGE_KEY_MAP_CENTER = 'photo-addon:map-center'
const STORAGE_KEY_MAP_ZOOM = 'photo-addon:map-zoom'

/**
 * Cluster radius for geographic grouping (in meters).
 *
 * 1000m (1km) chosen because:
 * - Large enough to group photos from same location (park, neighborhood, venue)
 * - Small enough to distinguish nearby but separate locations
 * - Matches typical GPS accuracy (5-15m) with comfortable margin
 * - Good visual density on map at common zoom levels (10-15)
 *
 * Adjust higher (2000m) for sparser photo collections,
 * or lower (500m) for dense urban photography.
 */
const CLUSTER_RADIUS_METERS = 1000

// Get stored map position
function getStoredMapPosition(): { center: [number, number], zoom: number } | null {
  try {
    const centerStr = localStorage.getItem(STORAGE_KEY_MAP_CENTER)
    const zoomStr = localStorage.getItem(STORAGE_KEY_MAP_ZOOM)
    if (centerStr && zoomStr) {
      const center = JSON.parse(centerStr) as [number, number]
      const zoom = parseInt(zoomStr, 10)
      if (Array.isArray(center) && center.length === 2 && !isNaN(zoom)) {
        return { center, zoom }
      }
    }
  } catch (e) {
    // ignore
  }
  return null
}

// Save map position to localStorage
function saveMapPosition() {
  if (!map) return
  try {
    const center = map.getCenter()
    const zoom = map.getZoom()
    localStorage.setItem(STORAGE_KEY_MAP_CENTER, JSON.stringify([center.lat, center.lng]))
    localStorage.setItem(STORAGE_KEY_MAP_ZOOM, String(zoom))
  } catch (e) {
    // ignore
  }
}

// Count photos with GPS (total)
const photosWithGps = computed(() => {
  return props.photos.filter(photo => {
    const loc = photo.graphPhoto?.location
    return loc?.latitude != null && loc?.longitude != null
  }).length
})

// Update visible photos based on current map bounds
function updateVisiblePhotos() {
  if (!map) {
    visiblePhotosInView.value = []
    return
  }

  const bounds = map.getBounds()
  const visible = props.photos.filter(photo => {
    const loc = photo.graphPhoto?.location
    if (loc?.latitude == null || loc?.longitude == null) return false
    return bounds.contains([loc.latitude, loc.longitude])
  })

  visiblePhotosInView.value = visible
  emit('visible-count-change', visible.length, photosWithGps.value)
}

// Cluster photos by geographic proximity
interface PhotoCluster {
  photos: PhotoWithLocation[]
  centerLat: number
  centerLng: number
  representativePhoto: PhotoWithLocation // Most recent photo in cluster
}

/**
 * Cluster photos by geographic proximity using a spatial grid algorithm.
 *
 * Algorithm: O(n) spatial hashing instead of O(n²) pairwise distance comparison
 *
 * How it works:
 * 1. Divide the world into a grid of cells (each ~1km × 1km)
 * 2. Hash each photo to its grid cell using floor(lat/GRID_SIZE), floor(lng/GRID_SIZE)
 * 3. All photos in the same cell form one cluster
 *
 * Trade-offs:
 * - Pros: O(n) time complexity, simple implementation, predictable performance
 * - Cons: Grid boundaries can split nearby photos into different clusters
 *         (e.g., photos 10m apart but on different sides of a grid line)
 *
 * For photo galleries, this trade-off is acceptable because:
 * - Perfect clustering isn't required (users expect approximate grouping)
 * - Performance matters more (can have 10,000+ photos)
 * - 1km cells are large enough that edge cases are rare
 *
 * @param photos - Array of photos with GPS coordinates
 * @returns Array of photo clusters with center coordinates and representative photo
 */
function clusterPhotos(photos: PhotoWithLocation[]): PhotoCluster[] {
  const photosWithLocation = photos.filter(p =>
    p.graphPhoto?.location?.latitude != null &&
    p.graphPhoto?.location?.longitude != null
  )

  if (photosWithLocation.length === 0) return []

  /**
   * Grid size in degrees. 0.009° ≈ 1km at the equator.
   *
   * At different latitudes, 1° longitude varies:
   * - Equator: 111km
   * - 45°: 78km
   * - 60°: 55km
   *
   * So 0.009° is roughly 1km at equator, ~0.7km at 45° latitude.
   * This variance is acceptable for visual clustering purposes.
   */
  const GRID_SIZE = 0.009

  // Build spatial grid - O(n): each photo assigned to one cell
  const grid = new Map<string, PhotoWithLocation[]>()
  for (const photo of photosWithLocation) {
    const lat = photo.graphPhoto!.location!.latitude!
    const lng = photo.graphPhoto!.location!.longitude!
    // Hash to grid cell (integer division via floor)
    const gridKey = `${Math.floor(lat / GRID_SIZE)},${Math.floor(lng / GRID_SIZE)}`

    if (!grid.has(gridKey)) grid.set(gridKey, [])
    grid.get(gridKey)!.push(photo)
  }

  // Convert grid cells to clusters
  const clusters: PhotoCluster[] = []

  for (const [, cellPhotos] of grid) {
    // Sort by date to select most recent as representative (shown in marker)
    const photosWithTime = cellPhotos.map(p => ({
      photo: p,
      timestamp: p.graphPhoto?.takenDateTime ? new Date(p.graphPhoto.takenDateTime).getTime() : 0
    }))
    photosWithTime.sort((a, b) => b.timestamp - a.timestamp)
    const sortedPhotos = photosWithTime.map(pt => pt.photo)

    // Calculate centroid (average position) for marker placement
    let sumLat = 0, sumLng = 0
    for (const p of sortedPhotos) {
      sumLat += p.graphPhoto!.location!.latitude!
      sumLng += p.graphPhoto!.location!.longitude!
    }

    clusters.push({
      photos: sortedPhotos,
      centerLat: sumLat / sortedPhotos.length,
      centerLng: sumLng / sortedPhotos.length,
      representativePhoto: sortedPhotos[0]  // Most recent photo shown in popup
    })
  }

  return clusters
}

// Inject critical CSS overrides (must be global, not scoped)
function injectTileFixCSS() {
  if (document.getElementById('leaflet-tile-fix')) return

  const style = document.createElement('style')
  style.id = 'leaflet-tile-fix'
  style.textContent = `
    /* === Leaflet CSS Fixes for oCIS Photo Addon === */

    /* The map container needs absolute positioning to work properly */
    .photo-map-container .leaflet-container {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: auto !important;
      height: auto !important;
      overflow: hidden !important;
      background: #ddd !important;
    }

    /* Panes need absolute positioning with base coordinates */
    .leaflet-pane,
    .leaflet-map-pane,
    .leaflet-tile-pane {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
    }

    /* Tile container - holds grid of tiles */
    .leaflet-tile-container {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      display: block !important;
    }

    /* Individual tiles - positioned via transforms by Leaflet */
    .leaflet-tile {
      position: absolute !important;
      display: block !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
    }

    /* Tile images - slightly oversized to prevent gap bug */
    .leaflet-tile-container img.leaflet-tile {
      width: 256.5px !important;
      height: 256.5px !important;
      max-width: none !important;
      max-height: none !important;
    }

    /* Overlay pane for markers - needs proper z-index and transforms */
    .leaflet-overlay-pane {
      z-index: 400 !important;
    }
    .leaflet-overlay-pane svg {
      overflow: visible !important;
      pointer-events: auto !important;
    }
    .leaflet-overlay-pane svg path {
      pointer-events: auto !important;
      cursor: pointer !important;
    }
    .leaflet-interactive {
      pointer-events: auto !important;
      cursor: pointer !important;
    }
    .leaflet-marker-pane {
      z-index: 600 !important;
    }
    .leaflet-tooltip-pane {
      z-index: 650 !important;
    }
    .leaflet-popup-pane {
      z-index: 700 !important;
    }

    /* Zoom animation - markers must follow map transforms */
    .leaflet-zoom-animated {
      transform-origin: 0 0 !important;
    }

    /* Wrapper constraint - fill parent and clip the map */
    .photo-map-wrapper {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      z-index: 0 !important; /* Stay below oCIS header dropdowns */
    }

    .photo-map-container {
      position: relative !important;
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }

    /* Parent container in PhotosView - needs relative for absolute children */
    .map-view-container {
      position: relative !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }

    /* Photo thumbnail tooltip styles - disable Leaflet animations */
    .photo-marker-tooltip {
      padding: 0 !important;
      border: none !important;
      background: transparent !important;
      box-shadow: none !important;
      transition: none !important;
      opacity: 1 !important;
    }
    .photo-marker-tooltip.leaflet-tooltip {
      transition: none !important;
    }
    .leaflet-tooltip {
      transition: none !important;
    }
    .photo-marker-tooltip .leaflet-tooltip-content {
      margin: 0 !important;
    }
    /* Remove tooltip arrow */
    .photo-marker-tooltip::before {
      display: none !important;
    }
    .map-photo-tooltip {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      overflow: hidden;
      min-width: 120px;
      max-width: 180px;
    }
    .map-photo-tooltip img {
      width: 100%;
      height: 100px;
      object-fit: cover;
      display: block;
      background: #f0f0f0;
    }
    .map-photo-tooltip .tooltip-info {
      padding: 8px;
      text-align: center;
    }
    .map-photo-tooltip .tooltip-name {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .map-photo-tooltip .tooltip-date {
      display: block;
      font-size: 11px;
      color: #666;
      margin-top: 2px;
    }
    .map-photo-tooltip .tooltip-count {
      display: inline-block;
      background: #e65100;
      color: #fff;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 10px;
      margin-bottom: 4px;
    }
  `
  document.head.appendChild(style)
}

function initMap() {
  if (!mapContainer.value) {
    return
  }

  // Check for stored map position first
  const storedPosition = getStoredMapPosition()

  let center: L.LatLngExpression
  let initialZoom: number

  if (storedPosition) {
    // Use stored position
    center = storedPosition.center
    initialZoom = storedPosition.zoom
    hadStoredPosition = true
  } else {
    hadStoredPosition = false
    // Find center from photos with GPS, or default to Canada
    const photosWithLocation = props.photos.filter(p =>
      p.graphPhoto?.location?.latitude != null &&
      p.graphPhoto?.location?.longitude != null
    )

    center = props.defaultCenter
    initialZoom = props.defaultZoom

    if (photosWithLocation.length > 0) {
      const first = photosWithLocation[0]
      center = [
        first.graphPhoto!.location!.latitude!,
        first.graphPhoto!.location!.longitude!
      ]
      initialZoom = 6
    }
  }

  // Create map with INTEGER zoom to minimize gap issues
  map = L.map(mapContainer.value, {
    center: center,
    zoom: initialZoom,
    zoomSnap: 1,      // Force integer zoom levels only
    zoomDelta: 1,     // Zoom by whole levels
    wheelPxPerZoomLevel: 120, // Require more scroll for zoom
  })

  // Save position and update visible photos when map moves or zooms
  map.on('moveend', () => {
    saveMapPosition()
    updateVisiblePhotos()
  })
  map.on('zoomend', () => {
    saveMapPosition()
    updateVisiblePhotos()
  })

  // Add OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    keepBuffer: 2,
  }).addTo(map)

  // Add photo markers
  addPhotoMarkers()

  // Force layout recalculation after CSS applies
  setTimeout(() => {
    if (map && mapContainer.value) {
      map.invalidateSize()
    }
  }, 100)
}

function addPhotoMarkers() {
  if (!map) return

  // Cluster photos by geographic proximity
  const clusters = clusterPhotos(props.photos)

  if (clusters.length === 0) return

  // Pre-fetch thumbnails for representative photos (the ones shown in tooltips)
  for (const cluster of clusters) {
    props.getThumbnailUrl(cluster.representativePhoto)
  }

  const bounds = L.latLngBounds([])

  for (const cluster of clusters) {
    const { photos, centerLat, centerLng, representativePhoto } = cluster
    const photoCount = photos.length

    // Use circle markers with size based on cluster size
    const radius = photoCount > 1 ? Math.min(10 + Math.log2(photoCount) * 3, 20) : 10
    const marker = L.circleMarker([centerLat, centerLng], {
      radius: radius,
      fillColor: photoCount > 1 ? '#e65100' : '#0070c0', // Orange for clusters, blue for single
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
      interactive: true,
      bubblingMouseEvents: false,
    })

    // Use representative photo (most recent) for tooltip
    const photo = representativePhoto
    const dateStr = photo.graphPhoto?.takenDateTime
      ? new Date(photo.graphPhoto.takenDateTime).toLocaleDateString()
      : ''

    // Escape content for safe HTML rendering
    const safeName = escapeHtml(photo.name || '')
    const safeDateStr = dateStr ? escapeHtml(dateStr) : ''
    const countBadge = photoCount > 1 ? `<span class="tooltip-count">${photoCount} photos</span>` : ''

    // Helper to build tooltip HTML with current thumbnail URL (properly escaped)
    const buildTooltipHtml = () => {
      const currentUrl = props.getThumbnailUrl(photo)
      const safeSrc = escapeAttr(currentUrl)
      return `<div class="map-photo-tooltip">
        <img src="${safeSrc}" alt="${escapeAttr(photo.name || '')}">
        <div class="tooltip-info">
          ${countBadge}
          <span class="tooltip-name">${safeName}</span>
          ${safeDateStr ? `<span class="tooltip-date">${safeDateStr}</span>` : ''}
        </div>
      </div>`
    }

    // Show tooltip based on quadrant - opposite corner from mouse
    const gap = 15
    marker.on('mouseover', (e: L.LeafletMouseEvent) => {
      // Remove any existing tooltip using ref
      if (activeTooltip) {
        activeTooltip.remove()
        activeTooltip = null
      }

      // Get map container bounds
      const container = mapContainer.value
      if (!container) return
      const rect = container.getBoundingClientRect()

      // Get marker screen position
      const markerPoint = map!.latLngToContainerPoint(marker.getLatLng())
      const markerScreenX = rect.left + markerPoint.x
      const markerScreenY = rect.top + markerPoint.y

      // Determine which quadrant marker is in
      const inTopHalf = markerPoint.y < rect.height / 2
      const inLeftHalf = markerPoint.x < rect.width / 2

      // Create tooltip and track via ref
      const tooltip = document.createElement('div')
      tooltip.id = 'map-center-tooltip'
      tooltip.innerHTML = buildTooltipHtml()
      tooltip.style.position = 'fixed'
      tooltip.style.zIndex = '9999'

      // Position in opposite quadrant from marker
      if (inTopHalf && inLeftHalf) {
        // Marker top-left → tooltip bottom-right of marker
        tooltip.style.left = (markerScreenX + radius + gap) + 'px'
        tooltip.style.top = (markerScreenY + radius + gap) + 'px'
      } else if (inTopHalf && !inLeftHalf) {
        // Marker top-right → tooltip bottom-left of marker
        tooltip.style.right = (window.innerWidth - markerScreenX + radius + gap) + 'px'
        tooltip.style.top = (markerScreenY + radius + gap) + 'px'
      } else if (!inTopHalf && inLeftHalf) {
        // Marker bottom-left → tooltip top-right of marker
        tooltip.style.left = (markerScreenX + radius + gap) + 'px'
        tooltip.style.bottom = (window.innerHeight - markerScreenY + radius + gap) + 'px'
      } else {
        // Marker bottom-right → tooltip top-left of marker
        tooltip.style.right = (window.innerWidth - markerScreenX + radius + gap) + 'px'
        tooltip.style.bottom = (window.innerHeight - markerScreenY + radius + gap) + 'px'
      }

      activeTooltip = tooltip
      document.body.appendChild(tooltip)
    })

    marker.on('mouseout', () => {
      if (activeTooltip) {
        activeTooltip.remove()
        activeTooltip = null
      }
    })

    // Handle click - open in lightbox with group navigation
    marker.on('click', () => {
      emit('photo-click', representativePhoto, photos)
    })

    marker.addTo(map)
    bounds.extend([centerLat, centerLng])
  }

  // Fit to show all markers ONLY if we don't have a stored position
  if (bounds.isValid() && !hadStoredPosition) {
    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 12
    })
  }

  // Update visible photos count after markers are added
  updateVisiblePhotos()
}

// Watch for photo changes
watch(() => props.photos, () => {
  if (map) {
    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) {
        map!.removeLayer(layer)
      }
    })
    addPhotoMarkers()
  }
}, { deep: true })

onMounted(() => {
  injectTileFixCSS()
  // Small delay for CSS to apply
  setTimeout(initMap, 50)

  // Set up resize observer to handle dynamic container resizing
  if (mapContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      if (map) {
        map.invalidateSize()
      }
    })
    resizeObserver.observe(mapContainer.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (map) {
    map.remove()
    map = null
  }
  // Clean up any orphaned tooltips using tracked ref
  if (activeTooltip) {
    activeTooltip.remove()
    activeTooltip = null
  }
  // Clean up injected CSS (only if no other PhotoMap instances)
  // Note: We leave the CSS in place since it's idempotent and shared
  // Removing it could break other instances if multiple PhotoMaps exist
})
</script>

<style scoped>
/* Outer wrapper - fills parent container via absolute positioning */
.photo-map-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  background: #e0e0e0;
}

/* Inner container - positioning context for the map */
.photo-map-container {
  position: relative;
  width: 100%;
  height: 100%;
}

/* Map element - Leaflet adds classes here */
.map-element {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.no-gps-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  background: rgba(255, 255, 255, 0.95);
  padding: 2rem 3rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 450;
}

.no-gps-overlay .icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.no-gps-overlay p {
  margin: 0;
  color: #666;
}

.map-stats {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.95);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #333;
  z-index: 450;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}
</style>
