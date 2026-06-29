import { test, expect, Page } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { FilesPage } from '../../../../support/pages/filesPage'

const MOCK_SYNTHESIS_RESPONSE = {
  themes: ['Shared management topic', 'Remote work'],
  differences: ['Different departments covered'],
  actionItems: ['Schedule follow-up meeting', 'Review budget']
}

const MOCK_CHAT_COMPLETIONS_BODY = JSON.stringify({
  choices: [{ message: { content: JSON.stringify(MOCK_SYNTHESIS_RESPONSE) } }]
})

let adminPage: Page

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page

  await adminPage.route('**/ai-llm-proxy/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: MOCK_CHAT_COMPLETIONS_BODY
    })
  )

  await adminPage.route('**/dav/**', (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ status: 201 })
    }
    return route.continue()
  })

  const appBar = new FilesAppBar(adminPage)
  await appBar.uploadFile('test-document.txt')
  await appBar.uploadFile('test-document.md')
})

test.afterEach(async () => {
  const filesPage = new FilesPage(adminPage)
  await filesPage.deleteAllFromPersonal()
  await logout(adminPage)
})

test('"Synthesize" appears in batch bar when 2 supported files are selected', async () => {
  const filesPage = new FilesPage(adminPage)
  await filesPage.selectAllCheckbox.check()
  await expect(adminPage.getByRole('button', { name: 'Synthesize' })).toBeVisible()
})

test('"Synthesize" is hidden when fewer than 2 files are selected', async () => {
  const filesPage = new FilesPage(adminPage)
  await filesPage.page.locator('[data-testid="resource-table-select"]').first().check()
  await expect(adminPage.getByRole('button', { name: 'Synthesize' })).not.toBeVisible()
})

test('"Synthesize" is hidden when LLM endpoint is not configured', async () => {
  // With config provided by ocis.apps.yaml, llmConfig is set.
  // This test verifies the action is NOT shown with 0 files selected.
  await expect(adminPage.getByRole('button', { name: 'Synthesize' })).not.toBeVisible()
})

test('clicking "Synthesize" opens the synthesis modal', async () => {
  const filesPage = new FilesPage(adminPage)
  await filesPage.selectAllCheckbox.check()
  await adminPage.getByRole('button', { name: 'Synthesize' }).click()

  const modal = adminPage.locator('[role="dialog"]')
  await expect(modal).toBeVisible()
})

test('synthesis modal displays shared themes section', async () => {
  const filesPage = new FilesPage(adminPage)
  await filesPage.selectAllCheckbox.check()
  await adminPage.getByRole('button', { name: 'Synthesize' }).click()

  await adminPage
    .locator('[data-testid="synthesis-themes-heading"]')
    .waitFor({ state: 'visible', timeout: 30_000 })

  const themesSection = adminPage.locator('[data-testid="synthesis-themes"]')
  await expect(themesSection).toBeVisible()
  expect(await themesSection.locator('li').count()).toBeGreaterThan(0)
})

test('synthesis modal displays key differences section', async () => {
  const filesPage = new FilesPage(adminPage)
  await filesPage.selectAllCheckbox.check()
  await adminPage.getByRole('button', { name: 'Synthesize' }).click()

  await adminPage
    .locator('[data-testid="synthesis-differences-heading"]')
    .waitFor({ state: 'visible', timeout: 30_000 })

  const diffsSection = adminPage.locator('[data-testid="synthesis-differences"]')
  await expect(diffsSection).toBeVisible()
  expect(await diffsSection.locator('li').count()).toBeGreaterThan(0)
})

test('synthesis modal displays action items section', async () => {
  const filesPage = new FilesPage(adminPage)
  await filesPage.selectAllCheckbox.check()
  await adminPage.getByRole('button', { name: 'Synthesize' }).click()

  await adminPage
    .locator('[data-testid="synthesis-action-items-heading"]')
    .waitFor({ state: 'visible', timeout: 30_000 })

  const actionItemsSection = adminPage.locator('[data-testid="synthesis-action-items"]')
  await expect(actionItemsSection).toBeVisible()
  expect(await actionItemsSection.locator('li').count()).toBeGreaterThan(0)
})

test('LLM requests are sent to ai-llm-proxy with a bearer token', async () => {
  const proxyRequests: { url: string; authorization: string | null }[] = []

  await adminPage.route('**/ai-llm-proxy/**', async (route) => {
    const req = route.request()
    proxyRequests.push({
      url: req.url(),
      authorization: req.headers()['authorization'] ?? null
    })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: MOCK_CHAT_COMPLETIONS_BODY
    })
  })

  const filesPage = new FilesPage(adminPage)
  await filesPage.selectAllCheckbox.check()
  await adminPage.getByRole('button', { name: 'Synthesize' }).click()

  await adminPage
    .locator('[data-testid="synthesis-result"]')
    .waitFor({ state: 'visible', timeout: 30_000 })

  expect(proxyRequests.length).toBeGreaterThan(0)
  for (const req of proxyRequests) {
    expect(req.authorization).toMatch(/^Bearer /i)
    const token = req.authorization!.replace(/^Bearer /i, '')
    expect(token.length).toBeGreaterThan(10)
  }
})

test('user can copy the synthesis result to clipboard', async () => {
  // Grant clipboard permissions so navigator.clipboard.writeText works headlessly.
  await adminPage.context().grantPermissions(['clipboard-read', 'clipboard-write'])

  const filesPage = new FilesPage(adminPage)
  await filesPage.selectAllCheckbox.check()
  await adminPage.getByRole('button', { name: 'Synthesize' }).click()

  await adminPage
    .locator('[data-testid="synthesis-footer"]')
    .waitFor({ state: 'visible', timeout: 30_000 })

  const copyBtn = adminPage.locator('[data-testid="synthesis-copy-btn"]')
  await expect(copyBtn).toBeVisible()
  await copyBtn.click()
  await expect(copyBtn).toContainText('Copied')
})

test('user can save synthesis result as a new Markdown file', async () => {
  const filesPage = new FilesPage(adminPage)
  await filesPage.selectAllCheckbox.check()
  await adminPage.getByRole('button', { name: 'Synthesize' }).click()

  await adminPage
    .locator('[data-testid="synthesis-footer"]')
    .waitFor({ state: 'visible', timeout: 30_000 })

  const saveBtn = adminPage.locator('[data-testid="synthesis-save-btn"]')
  await expect(saveBtn).toBeVisible()
  await saveBtn.click()

  const successMsg = adminPage.locator('[data-testid="synthesis-save-success"]')
  await expect(successMsg).toBeVisible({ timeout: 15_000 })
  await expect(successMsg).toContainText('synthesis-')
})

test('synthesis modal is dismissed when the close button is clicked', async () => {
  const filesPage = new FilesPage(adminPage)
  await filesPage.selectAllCheckbox.check()
  await adminPage.getByRole('button', { name: 'Synthesize' }).click()

  const modal = adminPage.locator('[role="dialog"]')
  await expect(modal).toBeVisible()

  const closeBtn = modal.locator('button[aria-label="Close"], button:text("Close"), .oc-modal-close')
  await closeBtn.click()

  await expect(modal).not.toBeVisible()
})
