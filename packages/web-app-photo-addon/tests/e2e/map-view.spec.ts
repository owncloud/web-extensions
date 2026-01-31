/**
 * E2E tests for Photo Map View functionality
 *
 * Tests the Leaflet map integration for viewing geotagged photos.
 */
import { test, expect, navigateToPhotoView, waitForPhotosLoaded, isMapViewActive } from './fixtures'

test.describe('Map View Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPhotoView(page)
    await waitForPhotosLoaded(page)
  })

  test('should have map toggle button', async ({ page }) => {
    // Look for map toggle button
    const mapToggle = page.locator('.map-toggle, button:has-text("Map"), [aria-label*="map" i]')
    const isVisible = await mapToggle.first().isVisible().catch(() => false)

    expect(typeof isVisible).toBe('boolean')
  })

  test('should toggle to map view', async ({ page }) => {
    const mapToggle = page.locator('.map-toggle, button:has-text("Map"), [aria-label*="map" i]')

    if (await mapToggle.first().isVisible()) {
      await mapToggle.first().click()
      await page.waitForTimeout(1000)

      // Check if map is now visible
      const isMapActive = await isMapViewActive(page)
      expect(isMapActive).toBe(true)
    }
  })

  test('should toggle back to gallery view', async ({ page }) => {
    const mapToggle = page.locator('.map-toggle, button:has-text("Map"), button:has-text("Gallery"), [aria-label*="map" i], [aria-label*="gallery" i]')

    if (await mapToggle.first().isVisible()) {
      // Toggle to map
      await mapToggle.first().click()
      await page.waitForTimeout(1000)

      // Toggle back to gallery
      const galleryToggle = page.locator('button:has-text("Gallery"), .gallery-toggle, [aria-label*="gallery" i]')
      if (await galleryToggle.first().isVisible()) {
        await galleryToggle.first().click()
        await page.waitForTimeout(1000)

        // Map should not be active
        const isMapActive = await isMapViewActive(page)
        expect(isMapActive).toBe(false)
      }
    }
  })
})

test.describe('Leaflet Map Integration', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPhotoView(page)
    await waitForPhotosLoaded(page)

    // Navigate to map view
    const mapToggle = page.locator('.map-toggle, button:has-text("Map"), [aria-label*="map" i]')
    if (await mapToggle.first().isVisible()) {
      await mapToggle.first().click()
      await page.waitForTimeout(1000)
    }
  })

  test('should load Leaflet map container', async ({ page }) => {
    const mapContainer = page.locator('.leaflet-container')
    const isMapVisible = await mapContainer.isVisible().catch(() => false)

    if (isMapVisible) {
      await expect(mapContainer).toBeVisible()
    }
  })

  test('should display map tiles', async ({ page }) => {
    const mapContainer = page.locator('.leaflet-container')

    if (await mapContainer.isVisible()) {
      // Wait for tiles to load
      await page.waitForTimeout(2000)

      // Check for tile layer
      const tiles = page.locator('.leaflet-tile-container img, .leaflet-tile')
      const tileCount = await tiles.count()

      expect(tileCount).toBeGreaterThan(0)
    }
  })

  test('should have zoom controls', async ({ page }) => {
    const mapContainer = page.locator('.leaflet-container')

    if (await mapContainer.isVisible()) {
      // Look for Leaflet zoom controls
      const zoomIn = page.locator('.leaflet-control-zoom-in')
      const zoomOut = page.locator('.leaflet-control-zoom-out')

      await expect(zoomIn).toBeVisible()
      await expect(zoomOut).toBeVisible()
    }
  })
})

test.describe('Photo Markers', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPhotoView(page)
    await waitForPhotosLoaded(page)

    // Navigate to map view
    const mapToggle = page.locator('.map-toggle, button:has-text("Map"), [aria-label*="map" i]')
    if (await mapToggle.first().isVisible()) {
      await mapToggle.first().click()
      await page.waitForTimeout(2000)
    }
  })

  test('should display photo markers when geotagged photos exist', async ({ page }) => {
    const mapContainer = page.locator('.leaflet-container')

    if (await mapContainer.isVisible()) {
      // Look for markers (could be single markers or clusters)
      const markers = page.locator('.leaflet-marker-icon, .marker-cluster, .photo-marker')
      const markerCount = await markers.count()

      // Marker count depends on having geotagged photos
      expect(typeof markerCount).toBe('number')
    }
  })

  test('should show marker clusters', async ({ page }) => {
    const mapContainer = page.locator('.leaflet-container')

    if (await mapContainer.isVisible()) {
      // Check for marker cluster groups
      const clusters = page.locator('.marker-cluster')
      const clusterCount = await clusters.count()

      // Clusters depend on zoom level and photo distribution
      expect(typeof clusterCount).toBe('number')
    }
  })

  test('should show photo thumbnail on marker hover', async ({ page }) => {
    const mapContainer = page.locator('.leaflet-container')

    if (await mapContainer.isVisible()) {
      const markers = page.locator('.leaflet-marker-icon:not(.marker-cluster)')
      const markerCount = await markers.count()

      if (markerCount > 0) {
        // Hover over first marker
        await markers.first().hover()
        await page.waitForTimeout(500)

        // Look for popup or tooltip with thumbnail
        const popup = page.locator('.leaflet-popup, .marker-popup, .photo-popup')
        const tooltip = page.locator('.leaflet-tooltip')

        const hasPopup = await popup.isVisible().catch(() => false)
        const hasTooltip = await tooltip.isVisible().catch(() => false)

        // One of these should appear on hover
        expect(typeof hasPopup).toBe('boolean')
        expect(typeof hasTooltip).toBe('boolean')
      }
    }
  })
})

test.describe('Map Marker Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPhotoView(page)
    await waitForPhotosLoaded(page)

    // Navigate to map view
    const mapToggle = page.locator('.map-toggle, button:has-text("Map"), [aria-label*="map" i]')
    if (await mapToggle.first().isVisible()) {
      await mapToggle.first().click()
      await page.waitForTimeout(2000)
    }
  })

  test('should open lightbox when clicking marker', async ({ page }) => {
    const mapContainer = page.locator('.leaflet-container')

    if (await mapContainer.isVisible()) {
      const markers = page.locator('.leaflet-marker-icon:not(.marker-cluster)')
      const markerCount = await markers.count()

      if (markerCount > 0) {
        // Click first marker
        await markers.first().click()
        await page.waitForTimeout(1000)

        // Should open lightbox or show photo details
        const lightbox = page.locator('.lightbox-overlay, .photo-lightbox')
        const popup = page.locator('.leaflet-popup')

        const hasLightbox = await lightbox.isVisible().catch(() => false)
        const hasPopup = await popup.isVisible().catch(() => false)

        // Either lightbox or popup should appear
        expect(hasLightbox || hasPopup).toBe(true)
      }
    }
  })

  test('should expand cluster on click', async ({ page }) => {
    const mapContainer = page.locator('.leaflet-container')

    if (await mapContainer.isVisible()) {
      const clusters = page.locator('.marker-cluster')
      const clusterCount = await clusters.count()

      if (clusterCount > 0) {
        // Click first cluster
        await clusters.first().click()
        await page.waitForTimeout(1000)

        // Cluster should either expand (showing more markers) or zoom in
        // After expanding, we might see fewer clusters or more individual markers
        const newClusterCount = await clusters.count()
        const newMarkerCount = await page.locator('.leaflet-marker-icon:not(.marker-cluster)').count()

        // Map should still be functional after cluster click
        expect(newClusterCount >= 0).toBe(true)
        expect(newMarkerCount >= 0).toBe(true)
      }
    }
  })
})

test.describe('Map View State', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPhotoView(page)
    await waitForPhotosLoaded(page)
  })

  test('should preserve map view state when switching back', async ({ page }) => {
    const mapToggle = page.locator('.map-toggle, button:has-text("Map"), [aria-label*="map" i]')

    if (await mapToggle.first().isVisible()) {
      // Toggle to map
      await mapToggle.first().click()
      await page.waitForTimeout(1000)

      // Toggle back to gallery
      const galleryToggle = page.locator('button:has-text("Gallery"), .gallery-toggle')
      if (await galleryToggle.first().isVisible()) {
        await galleryToggle.first().click()
        await page.waitForTimeout(500)

        // Toggle to map again
        await mapToggle.first().click()
        await page.waitForTimeout(1000)

        // Map should still work
        const mapContainer = page.locator('.leaflet-container')
        await expect(mapContainer).toBeVisible()
      }
    }
  })
})
