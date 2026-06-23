import { test, expect } from '@playwright/test'

// Acceptance spec for {{EXT_TITLE}}
// Each test corresponds to one acceptance bullet from the candidate spec.
// The gate requires expect() call count >= acceptance bullet count.
// TODO(generated): implement one test per acceptance bullet from CANDIDATE spec.

test.describe('{{EXT_TITLE}}', () => {
  test('placeholder — replace with first acceptance bullet', async ({ page }) => {
    // TODO(generated): implement acceptance test
    await expect(page.locator('body')).toBeVisible()
  })
})
