import { test, Page, expect } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { FilesPage } from '../../../../support/pages/filesPage'
import { AiDocSummaryPage } from '../../../../support/pages/aiDocSummaryPage'

let adminPage: Page

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page
})

test.afterEach(async () => {
  const filesPage = new FilesPage(adminPage)
  await filesPage.deleteAllFromPersonal()
  await logout(adminPage)
})

test('"Summarize" appears in the context menu for supported file types only', async () => {
  const appBar = new FilesAppBar(adminPage)
  const summary = new AiDocSummaryPage(adminPage)

  await appBar.uploadFile('test-document.txt')
  expect(await summary.isSummarizeVisible('test-document.txt')).toBe(true)

  await appBar.uploadFile('logo.jpeg')
  expect(await summary.isSummarizeVisible('logo.jpeg')).toBe(false)
})

test('clicking "Summarize" opens the Summary sidebar panel', async () => {
  const appBar = new FilesAppBar(adminPage)
  const summary = new AiDocSummaryPage(adminPage)

  await appBar.uploadFile('test-document.txt')
  await summary.clickSummarize('test-document.txt')

  await expect(summary.sidebar).toBeVisible()
  await expect(summary.summaryPanel).toBeVisible()
})
