import { test, type Page, type APIRequestContext, expect } from '@playwright/test'
import { createContext, closeContext } from '../../../../support/helpers/actorHelper'
import { LoginPage } from '../../../../support/pages/loginPage'
import { FilesPage } from '../../../../support/pages/filesPage'
import { FolderBriefPanelPage } from './pages/FolderBriefPanelPage'

const TEST_FOLDER = 'folder-brief-acceptance-folder'

let adminPage: Page

async function createTestFolder(request: APIRequestContext): Promise<void> {
  const auth = Buffer.from('admin:admin').toString('base64')
  await request.fetch(`/remote.php/dav/files/admin/${TEST_FOLDER}`, {
    method: 'MKCOL',
    headers: { Authorization: `Basic ${auth}` }
  })
}

test.describe('AI Folder Brief Sidebar Panel', () => {
  test.beforeEach(async ({ browser, request }) => {
    const { page } = await createContext(browser)
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

  test('"Folder Brief" tab is registered in the sidebar and visible when a folder is selected', async () => {
    const brief = new FolderBriefPanelPage(adminPage)
    const files = new FilesPage(adminPage)

    await files.openFileContextMenu(TEST_FOLDER)
    await adminPage.getByTestId('action-label').filter({ hasText: 'Details' }).click()
    await brief.sidebar.waitFor({ state: 'visible' })

    await expect(brief.folderBriefTab()).toBeVisible()
  })
})
