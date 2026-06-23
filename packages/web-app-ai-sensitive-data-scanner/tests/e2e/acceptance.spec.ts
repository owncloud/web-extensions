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

  // Auto-dismiss any OcModal (scan results or file-conflict dialog) that would block
  // pointer events during navigation. OcModal cancel button class: .oc-modal-body-actions-cancel
  await adminPage.addLocatorHandler(adminPage.locator('.oc-modal-background'), async () => {
    await adminPage.locator('.oc-modal-body-actions-cancel').click()
  })
})

test.afterEach(async () => {
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

  // OcModal dismiss: click .oc-modal-body-actions-cancel (the cancel button class).
  // oc-modal-passive does not respond to Escape; data-testid="modal-cancel" does not exist.
  await adminPage.locator('.oc-modal-body-actions-cancel').click()
  await expect(scanner.resultsModal).not.toBeVisible()
})
