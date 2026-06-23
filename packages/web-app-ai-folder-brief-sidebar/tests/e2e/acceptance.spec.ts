import { test, type Page, type APIRequestContext, expect } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { FilesPage } from '../../../../support/pages/filesPage'
import { FolderBriefPanelPage } from './pages/FolderBriefPanelPage'

const TEST_FOLDER = 'folder-brief-e2e-test'

const MOCK_BRIEF_RESPONSE = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          summary: 'A test project folder containing various documents.',
          filesByType: 'Mostly text files and spreadsheets.',
          recentChanges: 'Files were recently modified.'
        })
      }
    }
  ]
}

async function createFolder(request: APIRequestContext): Promise<void> {
  const auth = Buffer.from('admin:admin').toString('base64')
  await request.fetch(`/remote.php/dav/files/admin/${TEST_FOLDER}`, {
    method: 'MKCOL',
    headers: { Authorization: `Basic ${auth}` }
  })
}

let adminPage: Page

test.describe('AI Folder Brief sidebar panel', () => {
  test.beforeEach(async ({ browser, request }) => {
    const admin = await loginAsUser(browser, 'admin', 'admin')
    adminPage = admin.page
    await createFolder(request)
  })

  test.afterEach(async () => {
    const filesPage = new FilesPage(adminPage)
    await filesPage.deleteAllFromPersonal()
    await logout(adminPage)
  })

  test('"Folder Brief" tab is visible in the sidebar when a folder is selected', async () => {
    await adminPage.route('**/ai-llm-proxy/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BRIEF_RESPONSE)
      })
    )
    const panel = new FolderBriefPanelPage(adminPage)
    await panel.openFor(TEST_FOLDER)
    await expect(panel.folderBriefTab()).toBeVisible()
  })

  test('panel renders content after auto-generating', async () => {
    await adminPage.route('**/ai-llm-proxy/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BRIEF_RESPONSE)
      })
    )
    const panel = new FolderBriefPanelPage(adminPage)
    await panel.openFor(TEST_FOLDER)
    await expect(panel.panel).toBeVisible()
    await expect(panel.placeholder()).not.toBeVisible({ timeout: 15_000 })
    await expect(panel.panel).toContainText('A test project folder')
  })

  test('panel shows error when the LLM returns 500', async () => {
    await adminPage.route('**/ai-llm-proxy/**', (route) =>
      route.fulfill({ status: 500 })
    )
    const panel = new FolderBriefPanelPage(adminPage)
    await panel.openFor(TEST_FOLDER)
    await expect(panel.errorBanner()).toBeVisible({ timeout: 15_000 })
    await expect(panel.errorBanner()).toContainText('temporarily unavailable')
  })

  test('"Regenerate" button re-triggers the LLM call', async () => {
    let callCount = 0
    await adminPage.route('**/ai-llm-proxy/**', async (route) => {
      callCount += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BRIEF_RESPONSE)
      })
    })
    const panel = new FolderBriefPanelPage(adminPage)
    await panel.openFor(TEST_FOLDER)
    await expect(panel.placeholder()).not.toBeVisible({ timeout: 15_000 })
    await expect(panel.panel).toContainText('A test project folder')
    await panel.regenerateButton().click()
    await expect(panel.placeholder()).not.toBeVisible({ timeout: 15_000 })
    expect(callCount).toBeGreaterThanOrEqual(2)
  })
})
