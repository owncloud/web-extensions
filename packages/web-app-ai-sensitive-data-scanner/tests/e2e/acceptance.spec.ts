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
  // Dismiss any open OcModal (scan results or file-conflict dialog) before navigating.
  // OcModal passive does not respond to Escape; dismiss via the cancel button class.
  // isVisible() returns immediately (no retry); only act when the backdrop is actually present.
  if (await adminPage.locator('.oc-modal-background').isVisible()) {
    await adminPage.locator('.oc-modal-body-actions-cancel').click()
    await adminPage.locator('.oc-modal-background').waitFor({ state: 'hidden' })
  }
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
  // oc-modal-passive does not respond to Escape.
  await adminPage.locator('.oc-modal-body-actions-cancel').click()
  await expect(scanner.resultsModal).not.toBeVisible()
})
