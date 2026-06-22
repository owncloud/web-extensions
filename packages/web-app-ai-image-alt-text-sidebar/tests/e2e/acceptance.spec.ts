import { test, Page, expect } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { FilesPage } from '../../../../support/pages/filesPage'
import { AltTextPanelPage } from '../../../../support/pages/altTextPanelPage'

const MOCK_ALT_TEXT = 'A cobblestone street in Oslo at dusk.'
const MOCK_OK = { choices: [{ message: { content: MOCK_ALT_TEXT } }] }
const VISION_REJECTION = { error: { message: 'model does not support image input' } }

function mockLlmSuccess(page: Page): Promise<void> {
  return page.route('**/ai-llm-proxy/v1/chat/completions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_OK)
    })
  )
}

function mockLlmProbeOkGenerationError(page: Page): Promise<void> {
  return page.route('**/ai-llm-proxy/v1/chat/completions', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as { max_tokens?: number }
    if (body.max_tokens === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_OK)
      })
    } else {
      await route.fulfill({ status: 500 })
    }
  })
}

let adminPage: Page

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page
  const appBar = new FilesAppBar(adminPage)
  await appBar.uploadFile('logo.jpeg')
})

test.afterEach(async () => {
  const filesPage = new FilesPage(adminPage)
  await filesPage.deleteAllFromPersonal()
  await logout(adminPage)
})

test('"Generate Alt Text" action appears in the context menu for image files', async () => {
  const altText = new AltTextPanelPage(adminPage)
  expect(await altText.isGenerateAltTextActionVisible('logo.jpeg')).toBe(true)
})

test('"Generate Alt Text" action does not appear for non-image files', async () => {
  const appBar = new FilesAppBar(adminPage)
  await appBar.uploadFile('test-document.txt')
  const altText = new AltTextPanelPage(adminPage)
  expect(await altText.isGenerateAltTextActionVisible('test-document.txt')).toBe(false)
})

test('clicking "Generate Alt Text" opens the Alt Text sidebar panel', async () => {
  await mockLlmSuccess(adminPage)
  const altText = new AltTextPanelPage(adminPage)
  await altText.clickGenerateAltTextAction('logo.jpeg')
  await expect(altText.sidebar).toBeVisible()
  await expect(altText.panel).toBeVisible()
})

test('panel shows unconfigured notice when the LLM probe cannot reach the endpoint', async () => {
  await adminPage.route('**/ai-llm-proxy/v1/chat/completions', (route) =>
    route.fulfill({ status: 404 })
  )
  const altText = new AltTextPanelPage(adminPage)
  await altText.clickGenerateAltTextAction('logo.jpeg')
  await expect(altText.panel).toBeVisible()
  await expect(altText.placeholder()).toContainText('not set up')
})

test('panel shows a notice when the configured model does not support image input', async () => {
  await adminPage.route('**/ai-llm-proxy/v1/chat/completions', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify(VISION_REJECTION)
    })
  )
  const altText = new AltTextPanelPage(adminPage)
  await altText.clickGenerateAltTextAction('logo.jpeg')
  await expect(altText.panel).toBeVisible()
  await expect(altText.placeholder()).toContainText('vision-capable model')
})

test('Generate button produces alt text shown in the editable textarea', async () => {
  await mockLlmSuccess(adminPage)
  const altText = new AltTextPanelPage(adminPage)
  await altText.clickGenerateAltTextAction('logo.jpeg')
  await expect(altText.generateButton()).toBeVisible()
  await altText.generateButton().click()
  await expect(altText.textarea()).toBeVisible()
  await expect(altText.textarea()).toHaveValue(MOCK_ALT_TEXT)
})

test('error banner is shown when generation fails', async () => {
  await mockLlmProbeOkGenerationError(adminPage)
  const altText = new AltTextPanelPage(adminPage)
  await altText.clickGenerateAltTextAction('logo.jpeg')
  await expect(altText.generateButton()).toBeVisible()
  await altText.generateButton().click()
  await expect(altText.errorBanner()).toBeVisible()
  await expect(altText.errorBanner()).toContainText('temporarily unavailable')
})

test('saved alt text is reloaded in the textarea when the panel is reopened', async () => {
  await mockLlmSuccess(adminPage)
  const altText = new AltTextPanelPage(adminPage)

  await altText.clickGenerateAltTextAction('logo.jpeg')
  await expect(altText.generateButton()).toBeVisible()
  await altText.generateButton().click()
  await expect(altText.textarea()).toHaveValue(MOCK_ALT_TEXT)

  await altText.saveButton().click()
  await expect(altText.saveButton()).toBeEnabled()

  await altText.closeSidebar()
  await expect(altText.sidebar).not.toBeVisible()

  await altText.clickGenerateAltTextAction('logo.jpeg')
  await expect(altText.panel).toBeVisible()
  await expect(altText.textarea()).toHaveValue(MOCK_ALT_TEXT)
})
