/**
 * Playwright test fixtures for Photo Addon E2E tests
 *
 * Provides authenticated test context and helper functions specific to photo gallery testing.
 * Uses cached authentication from global-setup.ts and leverages the shared support infrastructure.
 */
import { test as base, expect, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import globalSetup from './global-setup'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Storage state file path for cached authentication
const authFile = path.join(__dirname, '.auth', 'user.json')

/**
 * Extended test fixture with pre-authenticated context
 */
export const test = base.extend({
  // Run global setup before using storage state
  storageState: async ({}, use) => {
    // Run global setup if auth file doesn't exist or is stale
    if (!fs.existsSync(authFile)) {
      await globalSetup({} as any)
    }
    await use(authFile)
  }
})

// Re-export expect for convenience
export { expect }

/**
 * Navigate to the Photo View app
 */
export async function navigateToPhotoView(page: Page): Promise<void> {
  const baseUrl = process.env.BASE_URL_OCIS || process.env.OCIS_URL || 'https://cloud.faure.ca'

  // Navigate to the photos app via the app switcher
  await page.goto(baseUrl)

  // Wait for the page to be fully loaded
  await page.waitForLoadState('networkidle')

  // Click the app switcher button
  const appSwitcher = page.locator('#_appSwitcherButton')
  await appSwitcher.waitFor({ state: 'visible', timeout: 30000 })
  await appSwitcher.click()

  // Find and click the Photo Gallery app
  const photoApp = page.locator('text=Photo Gallery')
  await photoApp.waitFor({ state: 'visible', timeout: 10000 })
  await photoApp.click()

  // Wait for the photo view to load
  await page.waitForLoadState('networkidle')
}

/**
 * Wait for photos to be loaded in the gallery view
 */
export async function waitForPhotosLoaded(page: Page): Promise<void> {
  // Wait for either photos to appear or the empty state
  const photoGrid = page.locator('.photo-grid')
  const emptyState = page.locator('.no-photos, .empty-state')
  const loadingState = page.locator('.loading-spinner, .loading-state')

  // Wait for loading to finish
  await loadingState.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {
    // Loading state might not be visible if photos load quickly
  })

  // Either photos or empty state should be visible
  await Promise.race([
    photoGrid.waitFor({ state: 'visible', timeout: 30000 }),
    emptyState.waitFor({ state: 'visible', timeout: 30000 })
  ]).catch(() => {
    // Continue even if neither is visible - test will fail with better error
  })
}

/**
 * Wait for any page to be ready (loaded and authenticated)
 */
export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')

  // Wait for authentication to be confirmed (user menu visible)
  const userMenu = page.locator('#_userMenuButton, [data-testid="user-menu"]')
  await userMenu.waitFor({ state: 'visible', timeout: 30000 })
}

/**
 * Open the lightbox for a specific photo
 */
export async function openLightbox(page: Page, photoIndex: number = 0): Promise<void> {
  const photos = page.locator('.photo-grid .photo-item, .photo-thumbnail')
  await photos.nth(photoIndex).click()

  // Wait for lightbox to appear
  const lightbox = page.locator('.lightbox-overlay, .photo-lightbox')
  await lightbox.waitFor({ state: 'visible', timeout: 10000 })
}

/**
 * Close the lightbox
 */
export async function closeLightbox(page: Page): Promise<void> {
  // Try close button first, then escape key
  const closeBtn = page.locator('.lightbox-close, .close-btn')

  if (await closeBtn.isVisible()) {
    await closeBtn.click()
  } else {
    await page.keyboard.press('Escape')
  }

  // Wait for lightbox to close
  const lightbox = page.locator('.lightbox-overlay, .photo-lightbox')
  await lightbox.waitFor({ state: 'hidden', timeout: 5000 })
}

/**
 * Toggle map view
 */
export async function toggleMapView(page: Page): Promise<void> {
  const mapToggle = page.locator('.map-toggle, button:has-text("Map")')
  await mapToggle.click()

  // Wait for map to render or toggle state to change
  await page.waitForTimeout(500)
}

/**
 * Check if we're currently in map view
 */
export async function isMapViewActive(page: Page): Promise<boolean> {
  const mapContainer = page.locator('.photo-map, .leaflet-container')
  return await mapContainer.isVisible()
}
