import { test, type Page, type APIRequestContext, expect } from '@playwright/test'
import { createContext, closeContext } from '../../../../support/helpers/actorHelper'
import { LoginPage } from '../../../../support/pages/loginPage'
import { FilesPage } from '../../../../support/pages/filesPage'
import { FolderBriefPanelPage } from './pages/FolderBriefPanelPage'

const TEST_FOLDER = 'folder-brief-e2e-test'

const MOCK_BRIEF = {
  summary: 'This is a test project folder with sample files.',
  filesByType: 'Mostly text documents.',
  recentChanges: 'No recent changes detected.'
}

const MOCK_LLM_RESPONSE = {
  choices: [{ message: { content: JSON.stringify(MOCK_BRIEF) } }]
}

let adminPage: Page

async function createTestFolder(request: APIRequestContext): Promise<void> {
  const auth = Buffer.from('admin:admin').toString('base64')
  await request.fetch(`/remote.php/dav/files/admin/${TEST_FOLDER}`, {
    method: 'MKCOL',
    headers: { Authorization: `Basic ${auth}` }
  })
  // Add a child file so the composable's empty-folder guard does not short-circuit
  // the LLM call — without children the panel shows "This folder is empty." and never
  // calls the LLM endpoint.
  await request.fetch(`/remote.php/dav/files/admin/${TEST_FOLDER}/sample.txt`, {
    method: 'PUT',
    data: 'Sample file for E2E test',
    headers: { 'Content-Type': 'text/plain', Authorization: `Basic ${auth}` }
  })
}

test.describe('AI Folder Brief sidebar panel', () => {
  test.beforeEach(async ({ browser, request }) => {
    const { page } = await createContext(browser)

    // Inject an LLM config into the oCIS web config so the panel makes LLM calls.
    // Requests to the mock endpoint are intercepted per-test via page.route().
    await page.route('**/config.json', async (route) => {
      try {
        const response = await route.fetch()
        const body = (await response.json()) as Record<string, unknown>
        const options = (body.options as Record<string, unknown>) ?? {}
        await route.fulfill({
          status: response.status(),
          headers: response.headers(),
          body: JSON.stringify({
            ...body,
            options: {
              ...options,
              llm: { endpoint: 'https://llm.mock.invalid/v1', model: 'test-model' }
            }
          })
        })
      } catch {
        await route.continue()
      }
    })

    const loginPage = new LoginPage(page)
    await page.goto('/')
    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().endsWith('logon') &&
          resp.status() === 200 &&
          resp.request().method() === 'POST'
      ),
      loginPage.login('admin', 'admin')
    ])

    adminPage = page
    await createTestFolder(request)
  })

  test.afterEach(async () => {
    const filesPage = new FilesPage(adminPage)
    await filesPage.deleteAllFromPersonal()
    const context = adminPage.context()
    const loginPage = new LoginPage(adminPage)
    await loginPage.logout()
    await closeContext(context)
  })

  test('"Folder Brief" tab appears in the sidebar when a folder is selected', async () => {
    const brief = new FolderBriefPanelPage(adminPage)
    const files = new FilesPage(adminPage)

    await files.openFileContextMenu(TEST_FOLDER)
    await adminPage.getByTestId('action-label').filter({ hasText: 'Details' }).click()
    await brief.sidebar.waitFor({ state: 'visible' })

    await expect(brief.folderBriefTab()).toBeVisible()
  })

  test('panel renders the LLM-generated brief when the LLM endpoint is mocked', async () => {
    await adminPage.route('**/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(MOCK_LLM_RESPONSE)
      })
    })

    const brief = new FolderBriefPanelPage(adminPage)
    await brief.openFor(TEST_FOLDER)

    await expect(brief.placeholder()).not.toBeVisible({ timeout: 15_000 })
    await expect(brief.panel).toContainText('test project folder')
  })

  test('panel shows an error message when the LLM returns a server error', async () => {
    await adminPage.route('**/chat/completions', async (route) => {
      await route.fulfill({ status: 500 })
    })

    const brief = new FolderBriefPanelPage(adminPage)
    await brief.openFor(TEST_FOLDER)

    await expect(brief.errorBanner()).toBeVisible({ timeout: 15_000 })
    await expect(brief.errorBanner()).toContainText('temporarily unavailable')
  })

  test('Regenerate button triggers a new LLM call after the initial brief is shown', async () => {
    let callCount = 0
    await adminPage.route('**/chat/completions', async (route) => {
      callCount += 1
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(MOCK_LLM_RESPONSE)
      })
    })

    const brief = new FolderBriefPanelPage(adminPage)
    await brief.openFor(TEST_FOLDER)

    await expect(brief.placeholder()).not.toBeVisible({ timeout: 15_000 })

    await brief.regenerateButton().click()

    await expect(brief.placeholder()).not.toBeVisible({ timeout: 15_000 })
    expect(callCount).toBeGreaterThanOrEqual(2)
  })
})
