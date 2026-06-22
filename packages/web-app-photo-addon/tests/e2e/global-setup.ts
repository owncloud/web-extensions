/**
 * Global setup for E2E tests - handles authentication
 *
 * This runs once before all tests to authenticate with oCIS and save
 * the session state for reuse across test files.
 *
 * Authentication is retried a few times: under CI load the login flow can
 * hit transient failures (the browser process being killed, the IdP/proxy
 * still warming up, a dropped TLS handshake), which previously failed the
 * whole suite on a single bad attempt. Each attempt uses a fresh browser.
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
const MAX_ATTEMPTS = parseInt(process.env.AUTH_MAX_ATTEMPTS || '3', 10)

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

/**
 * Perform a single authentication attempt with a fresh browser and persist the
 * session state on success. Throws if any step fails.
 */
async function authenticateOnce(
  baseUrl: string,
  username: string,
  password: string
): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await context.newPage()

    // Navigate to oCIS
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })

    // Use the shared LoginPage for authentication
    const loginPage = new LoginPage(page)

    // Wait for login form
    await loginPage.usernameField.waitFor({ state: 'visible', timeout: 30000 })

    // Perform login
    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().endsWith('logon') &&
          resp.status() === 200 &&
          resp.request().method() === 'POST',
        { timeout: 30000 }
      ),
      loginPage.login(username, password)
    ])

    // Wait for successful login (user menu should appear)
    const userMenu = page.locator('#_userMenuButton, [data-testid="user-menu"]')
    await userMenu.waitFor({ state: 'visible', timeout: 30000 })

    // Save the authenticated state
    await context.storageState({ path: authFile })
  } finally {
    await browser.close()
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function globalSetup(_config?: FullConfig): Promise<void> {
  // Skip authentication if we have a valid cached session
  if (isAuthCacheValid()) {
    console.log('[Global Setup] Using cached authentication (< 10 minutes old)')
    return
  }

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

  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[Global Setup] Authenticating with oCIS... (attempt ${attempt}/${MAX_ATTEMPTS})`)
    try {
      await authenticateOnce(baseUrl, username, password)
      console.log(`[Global Setup] Authentication successful, session saved to ${authFile}`)
      return
    } catch (error) {
      lastError = error
      console.warn(
        `[Global Setup] Attempt ${attempt}/${MAX_ATTEMPTS} failed:`,
        error instanceof Error ? error.message : error
      )
      if (attempt < MAX_ATTEMPTS) {
        // linear backoff: 5s, 10s, ... to let oCIS settle between attempts
        await new Promise((resolve) => setTimeout(resolve, attempt * 5000))
      }
    }
  }

  console.error(`[Global Setup] Authentication failed after ${MAX_ATTEMPTS} attempts`)
  throw lastError
}

export default globalSetup
