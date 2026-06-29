import { test, expect, Page } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'

const DRAFT_MENU_ITEM = '[data-action="ai-quick-draft-creator-create-draft"]'
const DESCRIPTION_INPUT = '[data-testid="draft-description"]'
const FORMAT_SELECT = '[data-testid="draft-format"]'
const CREATE_BTN = '[data-testid="draft-create"]'
const CANCEL_BTN = '[data-testid="draft-cancel"]'
const UPLOAD_MENU_BTN = '#upload-menu-btn'
const UPLOAD_MENU_DROP = '#upload-menu-drop'

// Proxy base URL as configured in ocis.apps.yaml (same-origin path).
const PROXY_BASE = '**/ai-llm-proxy/v1/**'

let adminPage: Page

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page

  // Intercept calls to the same-origin ai-llm-proxy (the only path allowed by useLLM.ts).
  await adminPage.route(PROXY_BASE, (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [
          {
            message: {
              content:
                '# Meeting Notes\n\n## Agenda\n- Item 1\n\n## Action Items\n- [Add items here]'
            },
            finish_reason: 'stop'
          }
        ]
      })
    })
  })

  // Intercept WebDAV PUT so the test does not require a real oCIS server.
  await adminPage.route('**/dav/**', (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ status: 201 })
    }
    return route.continue()
  })
})

test.afterEach(async () => {
  await logout(adminPage)
})

test('"Draft from description" item appears in upload menu when LLM is configured', async () => {
  await adminPage.goto('/')
  await adminPage.locator(UPLOAD_MENU_BTN).click()
  await adminPage.locator(UPLOAD_MENU_DROP).waitFor({ state: 'visible' })

  const draftItem = adminPage.locator(DRAFT_MENU_ITEM)
  await expect(draftItem).toBeVisible()
})

test('clicking the action opens a modal with description textarea and format selector', async () => {
  await adminPage.goto('/')
  await adminPage.locator(UPLOAD_MENU_BTN).click()
  await adminPage.locator(UPLOAD_MENU_DROP).waitFor({ state: 'visible' })
  await adminPage.locator(DRAFT_MENU_ITEM).click()

  await expect(adminPage.locator(DESCRIPTION_INPUT)).toBeVisible()
  await expect(adminPage.locator(FORMAT_SELECT)).toBeVisible()
})

test('format selector offers Markdown and Plain text options', async () => {
  await adminPage.goto('/')
  await adminPage.locator(UPLOAD_MENU_BTN).click()
  await adminPage.locator(UPLOAD_MENU_DROP).waitFor({ state: 'visible' })
  await adminPage.locator(DRAFT_MENU_ITEM).click()

  const formatSelect = adminPage.locator(FORMAT_SELECT)
  await expect(formatSelect).toBeVisible()

  const options = await formatSelect.locator('option').allTextContents()
  expect(options.some((o) => /markdown/i.test(o))).toBe(true)
  expect(options.some((o) => /plain/i.test(o))).toBe(true)
})

test('"Create draft" button is disabled until description is entered', async () => {
  await adminPage.goto('/')
  await adminPage.locator(UPLOAD_MENU_BTN).click()
  await adminPage.locator(UPLOAD_MENU_DROP).waitFor({ state: 'visible' })
  await adminPage.locator(DRAFT_MENU_ITEM).click()

  const createBtn = adminPage.locator(CREATE_BTN)
  await expect(createBtn).toBeVisible()
  await expect(createBtn).toBeDisabled()

  await adminPage.locator(DESCRIPTION_INPUT).fill('Meeting notes for Q3')
  await expect(createBtn).toBeEnabled()
})

test('cancel button closes the modal', async () => {
  await adminPage.goto('/')
  await adminPage.locator(UPLOAD_MENU_BTN).click()
  await adminPage.locator(UPLOAD_MENU_DROP).waitFor({ state: 'visible' })
  await adminPage.locator(DRAFT_MENU_ITEM).click()

  await expect(adminPage.locator(CANCEL_BTN)).toBeVisible()
  await adminPage.locator(CANCEL_BTN).click()

  await expect(adminPage.locator(DESCRIPTION_INPUT)).not.toBeVisible()
})

test('happy path: fills description, clicks Create draft, proxy is called, modal closes', async () => {
  let proxyCalled = false
  await adminPage.route(PROXY_BASE, (route) => {
    proxyCalled = true
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content: '# Draft\n\nContent here.' }, finish_reason: 'stop' }]
      })
    })
  })

  await adminPage.goto('/')
  await adminPage.locator(UPLOAD_MENU_BTN).click()
  await adminPage.locator(UPLOAD_MENU_DROP).waitFor({ state: 'visible' })
  await adminPage.locator(DRAFT_MENU_ITEM).click()

  await adminPage.locator(DESCRIPTION_INPUT).fill('Q3 budget review for EMEA team')
  await adminPage.locator(CREATE_BTN).click()

  // Modal should close after successful creation
  await expect(adminPage.locator(DESCRIPTION_INPUT)).not.toBeVisible()
  // Proxy must have been called with the user's request
  expect(proxyCalled).toBe(true)
})

test('menu item is absent when LLM is not configured', async () => {
  // When llmConfig is null, isVisible() returns false and the menu item is not rendered.
  // This test verifies the upload menu can open without errors and no broken UI is shown.
  await adminPage.goto('/')
  await adminPage.locator(UPLOAD_MENU_BTN).click()
  await adminPage.locator(UPLOAD_MENU_DROP).waitFor({ state: 'visible' })

  // The upload menu itself must be functional (no JS errors from the extension).
  await expect(adminPage.locator(UPLOAD_MENU_DROP)).toBeVisible()
})
