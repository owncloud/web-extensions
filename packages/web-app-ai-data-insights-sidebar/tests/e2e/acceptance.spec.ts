import { test, Page, expect } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { FilesPage } from '../../../../support/pages/filesPage'
import { AiDataInsightsSidebarPage } from './pages/aiDataInsightsSidebarPage'

let adminPage: Page

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page
})

test.afterEach(async () => {
  // Remove any route handlers registered during the test before the cleanup
  // navigation. A request-interception handler left active across page.goto
  // intermittently crashes webkit's network layer with "WebKit encountered an
  // internal error"; the tests only need the mock while the panel is open.
  await adminPage.unrouteAll({ behavior: 'ignoreErrors' })
  const filesPage = new FilesPage(adminPage)
  await filesPage.deleteAllFromPersonal()
  await logout(adminPage)
})

test('"Insights" action is visible for CSV files and invisible for JPEG files', async () => {
  const appBar = new FilesAppBar(adminPage)
  const insights = new AiDataInsightsSidebarPage(adminPage)

  const csvName = await insights.uploadCsvFile()
  expect(await insights.isInsightsActionVisible(csvName)).toBe(true)

  await appBar.uploadFile('logo.jpeg')
  expect(await insights.isInsightsActionVisible('logo.jpeg')).toBe(false)
})

test('clicking "Insights" opens the Insights sidebar panel', async () => {
  const insights = new AiDataInsightsSidebarPage(adminPage)

  await adminPage.route('**/ai-llm-proxy/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: 'mock result' } }] })
    })
  )

  const csvName = await insights.uploadCsvFile()
  await insights.clickInsights(csvName)

  await expect(insights.sidebar).toBeVisible()
  await expect(insights.panel).toBeVisible()
})
