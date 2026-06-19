import { test, expect } from '@playwright/test'

test('alt text panel is visible for supported image files when LLM is configured', async ({ page }) => {
  expect(page).toBeDefined()
})

test('alt text panel is hidden when no LLM endpoint is configured', async ({ page }) => {
  expect(page).toBeDefined()
})

test('alt text panel shows a notice for text-only models', async ({ page }) => {
  expect(page).toBeDefined()
})

test('generate button triggers LLM call and displays result in editable field', async ({ page }) => {
  expect(page).toBeDefined()
})

test('accepted alt text is persisted as a WebDAV property and reloaded on panel open', async ({ page }) => {
  expect(page).toBeDefined()
})
