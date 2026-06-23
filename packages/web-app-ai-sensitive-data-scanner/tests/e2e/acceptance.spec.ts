import { test, Page, expect } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { FilesPage } from '../../../../support/pages/filesPage'
import { ScannerPage } from './pages/ScannerPage'

let adminPage: Page

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page

  await adminPage.route('**/ai-llm-proxy/**', (route) =>
    route.fulfill({
      body: JSON.stringify({ choices: [{ message: { content: '{"findings":[]}' } }] })
    })
  )
})

test.afterEach(async () => {
  // Dismiss any open modal or overlay that might block navigation during cleanup
  await adminPage.keyboard.press('Escape')
  const filesPage = new FilesPage(adminPage)
  await filesPage.deleteAllFromPersonal()
  await logout(adminPage)
})

test('"Scan for sensitive data" appears in the batch actions bar when a txt file is selected', async () => {
  const appBar = new FilesAppBar(adminPage)
  const filesPage = new FilesPage(adminPage)
  const scanner = new ScannerPage(adminPage)

  await appBar.uploadFile('test-document.txt')
  await filesPage.selectAllCheckbox.check()

  await expect(scanner.scanAction).toBeVisible()
})

test('"Scan for sensitive data" does not appear when only unsupported files are selected', async () => {
  const appBar = new FilesAppBar(adminPage)
  const filesPage = new FilesPage(adminPage)
  const scanner = new ScannerPage(adminPage)

  await appBar.uploadFile('logo.jpeg')
  await filesPage.selectAllCheckbox.check()

  await expect(scanner.scanAction).not.toBeVisible()
})

test('clicking "Scan for sensitive data" opens the results modal', async () => {
  const appBar = new FilesAppBar(adminPage)
  const filesPage = new FilesPage(adminPage)
  const scanner = new ScannerPage(adminPage)

  await appBar.uploadFile('test-document.txt')
  await filesPage.selectAllCheckbox.check()
  await scanner.scanAction.click()

  await expect(scanner.resultsModal).toBeVisible()

  // Close the modal so the afterEach hook can navigate and clean up without the
  // oc-modal-background intercepting pointer events on the app switcher button
  await adminPage.keyboard.press('Escape')
  await expect(scanner.resultsModal).not.toBeVisible()
})
