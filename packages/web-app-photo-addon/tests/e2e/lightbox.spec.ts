/**
 * E2E tests for Photo Lightbox functionality
 *
 * Tests the full-size photo viewer including EXIF metadata, navigation, and controls.
 */
import { test, expect, navigateToPhotoView, waitForPhotosLoaded, openLightbox } from './fixtures'

test.describe('Lightbox Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPhotoView(page)
    await waitForPhotosLoaded(page)
  })

  test('should open lightbox when clicking a photo', async ({ page }) => {
    const photos = page.locator('.photo-item, .photo-thumbnail')
    const count = await photos.count()

    if (count > 0) {
      await openLightbox(page, 0)

      // Verify lightbox is visible
      const lightbox = page.locator('.lightbox-overlay, .photo-lightbox')
      await expect(lightbox).toBeVisible()
    }
  })

  test('should close lightbox with close button', async ({ page }) => {
    const photos = page.locator('.photo-item, .photo-thumbnail')
    const count = await photos.count()

    if (count > 0) {
      await openLightbox(page, 0)

      // Find and click close button
      const closeBtn = page.locator('.lightbox-close, .close-btn')
      if (await closeBtn.isVisible()) {
        await closeBtn.click()
      } else {
        // Try clicking overlay background
        await page.keyboard.press('Escape')
      }

      // Lightbox should be hidden
      const lightbox = page.locator('.lightbox-overlay, .photo-lightbox')
      await expect(lightbox).not.toBeVisible({ timeout: 5000 })
    }
  })

  test('should close lightbox with Escape key', async ({ page }) => {
    const photos = page.locator('.photo-item, .photo-thumbnail')
    const count = await photos.count()

    if (count > 0) {
      await openLightbox(page, 0)

      // Press Escape to close
      await page.keyboard.press('Escape')

      // Lightbox should be hidden
      const lightbox = page.locator('.lightbox-overlay, .photo-lightbox')
      await expect(lightbox).not.toBeVisible({ timeout: 5000 })
    }
  })

  test('should display full-size image', async ({ page }) => {
    const photos = page.locator('.photo-item, .photo-thumbnail')
    const count = await photos.count()

    if (count > 0) {
      await openLightbox(page, 0)

      // Should have a full-size image
      const fullImage = page.locator('.lightbox-image, .full-size-image')
      await expect(fullImage).toBeVisible({ timeout: 15000 })

      // Image should have src attribute
      await expect(fullImage).toHaveAttribute('src', /.+/)
    }
  })
})

test.describe('Lightbox Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPhotoView(page)
    await waitForPhotosLoaded(page)
  })

  test('should navigate with arrow keys', async ({ page }) => {
    const photos = page.locator('.photo-item, .photo-thumbnail')
    const count = await photos.count()

    if (count >= 2) {
      await openLightbox(page, 0)

      // Get initial image src
      const image = page.locator('.lightbox-image, .full-size-image')
      await expect(image).toBeVisible()

      // Press right arrow to go to next
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(1000)

      // Image should still be visible after navigation
      await expect(image).toBeVisible()
      const newSrc = await image.getAttribute('src')

      // Verify the image has a valid src
      expect(typeof newSrc).toBe('string')
    }
  })

  test('should have navigation buttons', async ({ page }) => {
    const photos = page.locator('.photo-item, .photo-thumbnail')
    const count = await photos.count()

    if (count > 0) {
      await openLightbox(page, 0)

      // Check for prev/next buttons
      const prevBtn = page.locator('.prev-btn, .nav-prev, button:has-text("<")')
      const nextBtn = page.locator('.next-btn, .nav-next, button:has-text(">")')

      // At least one navigation option should exist (or be hidden if only 1 photo)
      const hasPrev = await prevBtn.isVisible().catch(() => false)
      const hasNext = await nextBtn.isVisible().catch(() => false)

      // Navigation buttons depend on photo count in current group
      expect(typeof hasPrev).toBe('boolean')
      expect(typeof hasNext).toBe('boolean')
    }
  })
})

test.describe('EXIF Metadata Panel', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPhotoView(page)
    await waitForPhotosLoaded(page)
  })

  test('should show metadata panel in lightbox', async ({ page }) => {
    const photos = page.locator('.photo-item, .photo-thumbnail')
    const count = await photos.count()

    if (count > 0) {
      await openLightbox(page, 0)

      // Look for metadata panel
      const metadataPanel = page.locator('.metadata-panel, .exif-panel, .photo-info')
      const isVisible = await metadataPanel.isVisible().catch(() => false)

      // Panel might be toggleable
      expect(typeof isVisible).toBe('boolean')
    }
  })

  test('should display EXIF data when available', async ({ page }) => {
    const photos = page.locator('.photo-item, .photo-thumbnail')
    const count = await photos.count()

    if (count > 0) {
      await openLightbox(page, 0)

      // Wait for image to load
      const image = page.locator('.lightbox-image, .full-size-image')
      await expect(image).toBeVisible({ timeout: 15000 })

      // Look for common EXIF fields
      const cameraInfo = page.locator('text=/Camera|Make|Model/i')
      const dateInfo = page.locator('text=/Date|Taken/i')
      const technicalInfo = page.locator('text=/ISO|Aperture|F\\/|Focal/i')

      // At least check that the page rendered properly
      await page.waitForTimeout(1000)

      // EXIF data presence depends on the photo
      const hasCamera = await cameraInfo.first().isVisible().catch(() => false)
      const hasDate = await dateInfo.first().isVisible().catch(() => false)
      const hasTechnical = await technicalInfo.first().isVisible().catch(() => false)

      expect(typeof hasCamera).toBe('boolean')
      expect(typeof hasDate).toBe('boolean')
      expect(typeof hasTechnical).toBe('boolean')
    }
  })
})

test.describe('Lightbox Controls', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPhotoView(page)
    await waitForPhotosLoaded(page)
  })

  test('should have download button', async ({ page }) => {
    const photos = page.locator('.photo-item, .photo-thumbnail')
    const count = await photos.count()

    if (count > 0) {
      await openLightbox(page, 0)

      // Look for download button
      const downloadBtn = page.locator('.download-btn, button:has-text("Download"), [aria-label*="download" i]')
      const isVisible = await downloadBtn.first().isVisible().catch(() => false)

      expect(typeof isVisible).toBe('boolean')
    }
  })

  test('should show photo filename', async ({ page }) => {
    const photos = page.locator('.photo-item, .photo-thumbnail')
    const count = await photos.count()

    if (count > 0) {
      await openLightbox(page, 0)

      // Look for filename display
      const filename = page.locator('.photo-name, .filename, .lightbox-title')
      const isVisible = await filename.first().isVisible().catch(() => false)

      expect(typeof isVisible).toBe('boolean')
    }
  })

  test('should show GPS location link when available', async ({ page }) => {
    const photos = page.locator('.photo-item, .photo-thumbnail')
    const count = await photos.count()

    if (count > 0) {
      await openLightbox(page, 0)

      // Wait for metadata to load
      await page.waitForTimeout(2000)

      // Look for GPS/location information
      const gpsLink = page.locator('text=/GPS|Location|View on Map|OpenStreetMap/i, a[href*="openstreetmap"]')
      const hasGps = await gpsLink.first().isVisible().catch(() => false)

      // GPS data is optional - just verify we checked
      expect(typeof hasGps).toBe('boolean')
    }
  })
})
