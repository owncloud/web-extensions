import { test, expect, type Page } from '@playwright/test'

/**
 * Acceptance tests for web-app-ai-multi-doc-synthesizer.
 *
 * These tests run against a fully deployed oCIS + extension environment.
 * Set BASE_URL_OCIS before running. Each test mocks the ai-llm-proxy
 * so no real LLM is required.
 */

const MOCK_SYNTHESIS_RESPONSE = {
  themes: ['Shared management topic', 'Remote work'],
  differences: ['Different departments covered'],
  actionItems: ['Schedule follow-up meeting', 'Review budget']
}

const MOCK_CHAT_COMPLETIONS_BODY = JSON.stringify({
  choices: [
    {
      message: {
        content: JSON.stringify(MOCK_SYNTHESIS_RESPONSE)
      }
    }
  ]
})

/** Intercept all requests to the ai-llm-proxy chat endpoint with a mocked JSON response. */
async function mockLlmProxy(page: Page): Promise<void> {
  await page.route('**/ai-llm-proxy/**', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: MOCK_CHAT_COMPLETIONS_BODY
    })
  })
}

let page: Page

test.beforeEach(async ({ browser }) => {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
  page = await ctx.newPage()
  await mockLlmProxy(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
})

test.afterEach(async () => {
  await page.close()
})

// Bullet 1: "Synthesize" appears in the batch-action bar when 2 supported files are selected.
test('"Synthesize" appears in batch bar when 2 supported files are selected', async () => {
  const file1 = page.locator('[data-testid="resource-table-select"]').nth(0)
  const file2 = page.locator('[data-testid="resource-table-select"]').nth(1)
  await file1.check()
  await file2.check()

  const synthesizeBtn = page.locator(
    '[data-testid="batch-action-synthesize"], button:text("Synthesize")'
  )
  await expect(synthesizeBtn).toBeVisible()
})

// Bullet 2: "Synthesize" is NOT shown when only 1 file is selected.
test('"Synthesize" is hidden when fewer than 2 files are selected', async () => {
  const file1 = page.locator('[data-testid="resource-table-select"]').nth(0)
  await file1.check()

  const synthesizeBtn = page.locator('button:text("Synthesize")')
  await expect(synthesizeBtn).not.toBeVisible()
})

// Bullet 3: "Synthesize" is hidden when LLM endpoint is not configured.
test('"Synthesize" is hidden when LLM endpoint is not configured', async () => {
  // On an unconfigured installation the extension hides the action entirely.
  // Run this test against an oCIS instance without the llm config key.
  const file1 = page.locator('[data-testid="resource-table-select"]').nth(0)
  const file2 = page.locator('[data-testid="resource-table-select"]').nth(1)
  await file1.check()
  await file2.check()

  // With no config the button must not appear.
  expect(await page.locator('button:text("Synthesize")').count()).toBe(0)
})

// Bullet 4: Clicking "Synthesize" opens the overlay panel.
test('clicking "Synthesize" opens the synthesis overlay', async () => {
  const file1 = page.locator('[data-testid="resource-table-select"]').nth(0)
  const file2 = page.locator('[data-testid="resource-table-select"]').nth(1)
  await file1.check()
  await file2.check()

  await page.locator('button:text("Synthesize")').click()

  const overlay = page.locator('[data-testid="synthesis-overlay"]')
  await expect(overlay).toBeVisible()
})

// Bullet 5: Overlay shows shared themes from the mocked proxy response.
test('overlay panel displays shared themes section', async () => {
  const file1 = page.locator('[data-testid="resource-table-select"]').nth(0)
  const file2 = page.locator('[data-testid="resource-table-select"]').nth(1)
  await file1.check()
  await file2.check()
  await page.locator('button:text("Synthesize")').click()

  await page
    .locator('[data-testid="synthesis-themes-heading"]')
    .waitFor({ state: 'visible', timeout: 30_000 })

  const themesSection = page.locator('[data-testid="synthesis-themes"]')
  await expect(themesSection).toBeVisible()
  expect(await themesSection.locator('li').count()).toBeGreaterThan(0)
})

// Bullet 6: Overlay shows key differences.
test('overlay panel displays key differences section', async () => {
  const file1 = page.locator('[data-testid="resource-table-select"]').nth(0)
  const file2 = page.locator('[data-testid="resource-table-select"]').nth(1)
  await file1.check()
  await file2.check()
  await page.locator('button:text("Synthesize")').click()

  await page
    .locator('[data-testid="synthesis-differences-heading"]')
    .waitFor({ state: 'visible', timeout: 30_000 })

  const diffsSection = page.locator('[data-testid="synthesis-differences"]')
  await expect(diffsSection).toBeVisible()
  expect(await diffsSection.locator('li').count()).toBeGreaterThan(0)
})

// Bullet 7: Overlay shows action items.
test('overlay panel displays action items section', async () => {
  const file1 = page.locator('[data-testid="resource-table-select"]').nth(0)
  const file2 = page.locator('[data-testid="resource-table-select"]').nth(1)
  await file1.check()
  await file2.check()
  await page.locator('button:text("Synthesize")').click()

  await page
    .locator('[data-testid="synthesis-action-items-heading"]')
    .waitFor({ state: 'visible', timeout: 30_000 })

  const actionItemsSection = page.locator('[data-testid="synthesis-action-items"]')
  await expect(actionItemsSection).toBeVisible()
  expect(await actionItemsSection.locator('li').count()).toBeGreaterThan(0)
})

// Bullet 8: LLM request carries the user's oCIS bearer token, not a provider API key.
test('LLM requests are sent to ai-llm-proxy with a bearer token', async () => {
  const proxyRequests: { url: string; authorization: string | null }[] = []

  await page.route('**/ai-llm-proxy/**', async (route) => {
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

  const file1 = page.locator('[data-testid="resource-table-select"]').nth(0)
  const file2 = page.locator('[data-testid="resource-table-select"]').nth(1)
  await file1.check()
  await file2.check()
  await page.locator('button:text("Synthesize")').click()

  await page
    .locator('[data-testid="synthesis-result"]')
    .waitFor({ state: 'visible', timeout: 30_000 })

  // At least one request must have hit the proxy
  expect(proxyRequests.length).toBeGreaterThan(0)
  // Every request must carry a bearer token (the oCIS access token)
  for (const req of proxyRequests) {
    expect(req.authorization).toMatch(/^Bearer /i)
    // The token must NOT be an empty or placeholder string
    const token = req.authorization!.replace(/^Bearer /i, '')
    expect(token.length).toBeGreaterThan(10)
  }
})

// Bullet 9: User can copy the synthesis result to the clipboard.
test('user can copy the synthesis result to clipboard', async () => {
  const file1 = page.locator('[data-testid="resource-table-select"]').nth(0)
  const file2 = page.locator('[data-testid="resource-table-select"]').nth(1)
  await file1.check()
  await file2.check()
  await page.locator('button:text("Synthesize")').click()

  await page
    .locator('[data-testid="synthesis-footer"]')
    .waitFor({ state: 'visible', timeout: 30_000 })

  const copyBtn = page.locator('[data-testid="synthesis-copy-btn"]')
  await expect(copyBtn).toBeVisible()
  await copyBtn.click()
  // Button label changes to "Copied!" after click
  await expect(copyBtn).toContainText('Copied')
})

// Bullet 10: User can save the synthesis result as a new Markdown file.
test('user can save synthesis result as a new Markdown file', async () => {
  const file1 = page.locator('[data-testid="resource-table-select"]').nth(0)
  const file2 = page.locator('[data-testid="resource-table-select"]').nth(1)
  await file1.check()
  await file2.check()
  await page.locator('button:text("Synthesize")').click()

  await page
    .locator('[data-testid="synthesis-footer"]')
    .waitFor({ state: 'visible', timeout: 30_000 })

  const saveBtn = page.locator('[data-testid="synthesis-save-btn"]')
  await expect(saveBtn).toBeVisible()
  await saveBtn.click()

  // A success message appears with the saved file path
  const successMsg = page.locator('[data-testid="synthesis-save-success"]')
  await expect(successMsg).toBeVisible({ timeout: 15_000 })
  // Path now includes date + time: synthesis-YYYY-MM-DD-HHMMSS.md
  await expect(successMsg).toContainText('synthesis-')
})

// Bullet 11: Overlay can be dismissed with Escape key.
test('overlay is dismissed when Escape is pressed', async () => {
  const file1 = page.locator('[data-testid="resource-table-select"]').nth(0)
  const file2 = page.locator('[data-testid="resource-table-select"]').nth(1)
  await file1.check()
  await file2.check()
  await page.locator('button:text("Synthesize")').click()

  const overlay = page.locator('[data-testid="synthesis-overlay"]')
  await expect(overlay).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(overlay).not.toBeVisible()
})
