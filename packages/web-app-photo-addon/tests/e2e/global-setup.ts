/**
 * Global setup for E2E tests - handles authentication
 *
 * This runs once before all tests to authenticate with oCIS and save
 * the session state for reuse across test files.
 *
 * Uses the shared LoginPage from support infrastructure.
 */
import { chromium, FullConfig } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// Import the shared LoginPage
import { LoginPage } from '../../../../support/pages/loginPage'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const authFile = path.join(__dirname, '.auth', 'user.json')
const AUTH_CACHE_MINUTES = parseInt(process.env.AUTH_CACHE_MINUTES || '10', 10)

/**
 * Check if cached auth file is still valid
 */
function isAuthCacheValid(): boolean {
  try {
    const stats = fs.statSync(authFile)
    const ageMinutes = (Date.now() - stats.mtimeMs) / 1000 / 60
    return ageMinutes < AUTH_CACHE_MINUTES
  } catch {
    return false
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function globalSetup(_config?: FullConfig): Promise<void> {
  // Skip authentication if we have a valid cached session
  if (isAuthCacheValid()) {
    console.log('[Global Setup] Using cached authentication (< 10 minutes old)')
    return
  }

  console.log('[Global Setup] Authenticating with oCIS...')

  const baseUrl = process.env.BASE_URL_OCIS || process.env.OCIS_URL || 'https://cloud.faure.ca'
  const username = process.env.OCIS_USER || 'admin'
  const password = process.env.OCIS_PASSWORD || 'admin'

  if (!process.env.OCIS_PASSWORD) {
    console.log('[Global Setup] OCIS_PASSWORD not set, using default "admin"')
  }

  // Ensure auth directory exists
  const authDir = path.dirname(authFile)
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  // Launch browser for authentication
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  })
  const page = await context.newPage()

  try {
    // Navigate to oCIS
    await page.goto(baseUrl)
    await page.waitForLoadState('domcontentloaded')

    // Use the shared LoginPage for authentication
    const loginPage = new LoginPage(page)

    // Wait for login form
    await loginPage.usernameField.waitFor({ state: 'visible', timeout: 30000 })

    // Perform login
    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().endsWith('logon') && resp.status() === 200 && resp.request().method() === 'POST'
      ),
      loginPage.login(username, password)
    ])

    // Wait for successful login (user menu should appear)
    const userMenu = page.locator('#_userMenuButton, [data-testid="user-menu"]')
    await userMenu.waitFor({ state: 'visible', timeout: 30000 })

    console.log('[Global Setup] Authentication successful')

    // Save the authenticated state
    await context.storageState({ path: authFile })
    console.log(`[Global Setup] Session saved to ${authFile}`)
  } catch (error) {
    console.error('[Global Setup] Authentication failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup
