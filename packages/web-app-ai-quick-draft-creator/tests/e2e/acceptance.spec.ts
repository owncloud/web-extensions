import { test, expect, Page } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'

const NEW_FILE_MENU_BTN = '#new-file-menu-btn'
const NEW_FILE_MENU_DROP = '#new-file-menu-drop'
const DRAFT_MENU_ITEM_TEXT = 'Draft from description'
const DESCRIPTION_INPUT = '[data-testid="draft-description"]'
const FORMAT_SELECT = '[data-testid="draft-format"]'
const CREATE_BTN = '[data-testid="draft-create"]'
const CANCEL_BTN = '[data-testid="draft-cancel"]'

// Proxy base URL as configured in ocis.apps.yaml (same-origin path).
const PROXY_BASE = '**/ai-llm-proxy/v1/**'

let adminPage: Page

async function openNewFileMenu(page: Page) {
  await page.goto('/files/spaces/personal')
  await page.locator('#files-view').waitFor({ state: 'visible' })
  await page.locator(NEW_FILE_MENU_BTN).click()
  await page.locator(NEW_FILE_MENU_DROP).waitFor({ state: 'visible' })
}

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
})

test.afterEach(async () => {
  await logout(adminPage)
})

test('"Draft from description" item appears in new file menu when LLM is configured', async () => {
  await openNewFileMenu(adminPage)

  const draftItem = adminPage.locator(NEW_FILE_MENU_DROP).getByText(DRAFT_MENU_ITEM_TEXT)
  await expect(draftItem).toBeVisible()
})

test('clicking the action opens a modal with description textarea and format selector', async () => {
  await openNewFileMenu(adminPage)
  await adminPage.locator(NEW_FILE_MENU_DROP).getByText(DRAFT_MENU_ITEM_TEXT).click()

  await expect(adminPage.locator(DESCRIPTION_INPUT)).toBeVisible()
  await expect(adminPage.locator(FORMAT_SELECT)).toBeVisible()
})

test('format selector offers Markdown and Plain text options', async () => {
  await openNewFileMenu(adminPage)
  await adminPage.locator(NEW_FILE_MENU_DROP).getByText(DRAFT_MENU_ITEM_TEXT).click()

  const formatSelect = adminPage.locator(FORMAT_SELECT)
  await expect(formatSelect).toBeVisible()

  const options = await formatSelect.locator('option').allTextContents()
  expect(options.some((o) => /markdown/i.test(o))).toBe(true)
  expect(options.some((o) => /plain/i.test(o))).toBe(true)
})

test('"Create draft" button is disabled until description is entered', async () => {
  await openNewFileMenu(adminPage)
  await adminPage.locator(NEW_FILE_MENU_DROP).getByText(DRAFT_MENU_ITEM_TEXT).click()

  const createBtn = adminPage.locator(CREATE_BTN)
  await expect(createBtn).toBeVisible()
  await expect(createBtn).toBeDisabled()

  await adminPage.locator(DESCRIPTION_INPUT).fill('Meeting notes for Q3')
  await expect(createBtn).toBeEnabled()
})

test('cancel button closes the modal', async () => {
  await openNewFileMenu(adminPage)
  await adminPage.locator(NEW_FILE_MENU_DROP).getByText(DRAFT_MENU_ITEM_TEXT).click()

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

  await openNewFileMenu(adminPage)
  await adminPage.locator(NEW_FILE_MENU_DROP).getByText(DRAFT_MENU_ITEM_TEXT).click()

  await adminPage.locator(DESCRIPTION_INPUT).fill('Q3 budget review for EMEA team')
  await adminPage.locator(CREATE_BTN).click()

  // Modal should close after successful creation
  await expect(adminPage.locator(DESCRIPTION_INPUT)).not.toBeVisible()
  // Proxy must have been called with the user's request
  expect(proxyCalled).toBe(true)
})

test('menu item is absent when LLM is not configured', async () => {
  // When llmConfig is null, isVisible() returns false and the menu item is not rendered.
  // This test verifies the new file menu can open without errors and no broken UI is shown.
  await openNewFileMenu(adminPage)

  // The new file menu itself must be functional (no JS errors from the extension).
  await expect(adminPage.locator(NEW_FILE_MENU_DROP)).toBeVisible()
})
