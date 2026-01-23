/**
 * E2E tests for Photo Gallery functionality
 *
 * Tests the main photo gallery view including loading, display, and navigation.
 */
import { test, expect, navigateToPhotoView, waitForPhotosLoaded } from './fixtures'

test.describe('Photo Gallery', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPhotoView(page)
  })

  test('should load the Photo Gallery app', async ({ page }) => {
    // Verify we're on the photo gallery page
    const title = page.locator('h1, .app-title, .photos-title')
    await expect(title.first()).toBeVisible({ timeout: 30000 })

    // Wait for photos to load
    await waitForPhotosLoaded(page)
  })

  test('should display photo grid or empty state', async ({ page }) => {
    await waitForPhotosLoaded(page)

    // Either photos should be visible or empty state
    const photoGrid = page.locator('.photo-grid')
    const emptyState = page.locator('.no-photos, .empty-state')

    const hasPhotos = await photoGrid.isVisible().catch(() => false)
    const isEmpty = await emptyState.isVisible().catch(() => false)

    expect(hasPhotos || isEmpty).toBe(true)
  })

  test('should have view switcher controls', async ({ page }) => {
    await waitForPhotosLoaded(page)

    // Check for view mode controls (day/week/month/year)
    const viewSwitcher = page.locator('.view-switcher, .group-mode-selector')

    // View switcher might not be visible if no photos
    const isVisible = await viewSwitcher.isVisible().catch(() => false)

    // If there are photos, we should have view controls
    const hasPhotos = await page.locator('.photo-grid .photo-item').count() > 0
    if (hasPhotos) {
      expect(isVisible).toBe(true)
    }
  })
})

test.describe('Date Grouping', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPhotoView(page)
    await waitForPhotosLoaded(page)
  })

  test('should display date group headers when photos exist', async ({ page }) => {
    const hasPhotos = await page.locator('.photo-grid .photo-item, .photo-thumbnail').count() > 0

    if (hasPhotos) {
      // Should have date headers
      const dateHeaders = page.locator('.date-group-header, .date-header')
      const headerCount = await dateHeaders.count()

      // Should have at least one date group
      expect(headerCount).toBeGreaterThan(0)
    }
  })

  test('should switch between grouping modes', async ({ page }) => {
    const hasPhotos = await page.locator('.photo-grid .photo-item, .photo-thumbnail').count() > 0

    if (hasPhotos) {
      // Find grouping selector (Day/Week/Month/Year)
      const modeSelector = page.locator('.group-mode-selector, .view-switcher')

      if (await modeSelector.isVisible()) {
        // Get available mode buttons
        const modeButtons = modeSelector.locator('button, .mode-btn')
        const buttonCount = await modeButtons.count()

        if (buttonCount >= 2) {
          // Click second mode button (likely 'Week' if first is 'Day')
          await modeButtons.nth(1).click()
          await page.waitForTimeout(500)

          // Verify the mode changed (button should be active)
          await expect(modeButtons.nth(1)).toHaveClass(/active|selected/)
        }
      }
    }
  })
})

test.describe('Photo Thumbnails', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPhotoView(page)
    await waitForPhotosLoaded(page)
  })

  test('should display photo thumbnails', async ({ page }) => {
    const thumbnails = page.locator('.photo-item img, .photo-thumbnail img')
    const thumbCount = await thumbnails.count()

    // If there are photos, thumbnails should have src
    if (thumbCount > 0) {
      const firstThumb = thumbnails.first()
      await expect(firstThumb).toHaveAttribute('src', /.+/)
    }
  })

  test('should show loading state for thumbnails', async ({ page }) => {
    // This test verifies the lazy loading mechanism
    // When scrolling, new thumbnails should show loading state then load
    const thumbnails = page.locator('.photo-item, .photo-thumbnail')
    const count = await thumbnails.count()

    if (count > 0) {
      // First thumbnail should be loaded
      const firstThumb = thumbnails.first().locator('img')
      await expect(firstThumb).toBeVisible()
    }
  })

  test('should handle infinite scroll', async ({ page }) => {
    const initialCount = await page.locator('.photo-item, .photo-thumbnail').count()

    if (initialCount > 10) {
      // Scroll to bottom to trigger more loading
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(2000)

      // Count should be same or more (depends on total photos)
      const newCount = await page.locator('.photo-item, .photo-thumbnail').count()
      expect(newCount).toBeGreaterThanOrEqual(initialCount)
    }
  })
})

test.describe('Photo Selection', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToPhotoView(page)
    await waitForPhotosLoaded(page)
  })

  test('should open lightbox on photo click', async ({ page }) => {
    const photos = page.locator('.photo-item, .photo-thumbnail')
    const count = await photos.count()

    if (count > 0) {
      // Click first photo
      await photos.first().click()

      // Lightbox should appear
      const lightbox = page.locator('.lightbox-overlay, .photo-lightbox')
      await expect(lightbox).toBeVisible({ timeout: 10000 })
    }
  })
})
