/**
 * Playwright test fixtures for Advanced Search E2E tests
 *
 * Provides authenticated test context and helper functions specific to advanced search testing.
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
 * Wait for page to be ready (loaded and authenticated)
 */
export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded')

  // Wait for authentication to be confirmed (user menu visible)
  const userMenu = page.locator('#_userMenuButton, [data-testid="user-menu"]')
  await userMenu.waitFor({ state: 'visible', timeout: 30000 })
}

/**
 * Navigate to the Advanced Search app
 */
export async function navigateToAdvancedSearch(page: Page): Promise<void> {
  const baseUrl = process.env.BASE_URL_OCIS || process.env.OCIS_URL || 'https://cloud.faure.ca'

  // Navigate to the base URL first
  await page.goto(baseUrl)
  await page.waitForLoadState('domcontentloaded')

  // Click the app switcher button
  const appSwitcher = page.locator('#_appSwitcherButton')
  await appSwitcher.waitFor({ state: 'visible', timeout: 30000 })
  await appSwitcher.click()

  // Find and click the Advanced Search app
  const searchApp = page.locator('text=Advanced Search')
  await searchApp.waitFor({ state: 'visible', timeout: 10000 })
  await searchApp.click()

  // Wait for the search page to load
  await page.waitForLoadState('domcontentloaded')
}

/**
 * Perform a search with the given query
 */
export async function performSearch(page: Page, query: string): Promise<void> {
  // Find the search input
  const searchInput = page.locator('.search-input')
  await searchInput.waitFor({ state: 'visible', timeout: 10000 })

  // Clear and fill the search input
  await searchInput.clear()
  await searchInput.fill(query)

  // Click the search button
  const searchBtn = page.locator('.search-btn')
  await searchBtn.click()

  // Wait for search to complete
  await waitForSearchResults(page)
}

/**
 * Wait for search results to load (or empty state)
 */
export async function waitForSearchResults(page: Page): Promise<void> {
  // Wait for loading to finish
  const loadingState = page.locator('.loading-state, .loading-spinner')
  await loadingState.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {
    // Loading state might not be visible if search completes quickly
  })

  // Wait for either results or empty state
  const resultsSection = page.locator('.results-section, .search-results')
  const emptyState = page.locator('.empty-state, .no-results')

  await Promise.race([
    resultsSection.waitFor({ state: 'visible', timeout: 30000 }),
    emptyState.waitFor({ state: 'visible', timeout: 30000 })
  ]).catch(() => {
    // Continue even if neither is visible - test will fail with better error
  })
}

/**
 * Clear all active filters
 */
export async function clearAllFilters(page: Page): Promise<void> {
  const clearAllBtn = page.locator('.clear-all-btn')

  if (await clearAllBtn.isVisible()) {
    await clearAllBtn.click()
    await page.waitForTimeout(500)
  }
}

/**
 * Toggle the filters panel
 */
export async function toggleFiltersPanel(page: Page): Promise<void> {
  const toggleBtn = page.locator('.toggle-filters-btn')
  await toggleBtn.click()
  await page.waitForTimeout(300)
}

/**
 * Open the saved searches panel
 */
export async function openSavedSearches(page: Page): Promise<void> {
  const savedBtn = page.locator('button:has-text("Saved Searches")')
  await savedBtn.click()

  const savedPanel = page.locator('.saved-queries-panel')
  await savedPanel.waitFor({ state: 'visible', timeout: 5000 })
}

/**
 * Close the saved searches panel
 */
export async function closeSavedSearches(page: Page): Promise<void> {
  const closeBtn = page.locator('.saved-queries-panel .close-btn')

  if (await closeBtn.isVisible()) {
    await closeBtn.click()
    await page.waitForTimeout(300)
  }
}
