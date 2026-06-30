import { test, Page, expect } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { FilesPage } from '../../../../support/pages/filesPage'
import { TagSuggestionPage } from './pages/TagSuggestionPage'

let adminPage: Page

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page

  await adminPage.route('**/ai-llm-proxy/**', (route) =>
    route.fulfill({
      body: JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                tags: [
                  { name: 'invoice', confidence: 0.92 },
                  { name: 'finance', confidence: 0.81 },
                  { name: 'q1-report', confidence: 0.76 }
                ]
              })
            }
          }
        ]
      })
    })
  )
})

test.afterEach(async () => {
  const filesPage = new FilesPage(adminPage)
  await filesPage.deleteAllFromPersonal()
  await logout(adminPage)
})

test('suggests tags for an uploaded text file and applies the confirmed selection', async () => {
  const appBar = new FilesAppBar(adminPage)
  const tagger = new TagSuggestionPage(adminPage)

  await appBar.uploadFile('test-document.txt')
  await tagger.open('test-document.txt')

  await expect(tagger.modal).toBeVisible()

  const chipCount = await tagger.chips.count()
  expect(chipCount).toBeGreaterThanOrEqual(1)

  const firstChip = tagger.chips.first()
  await expect(firstChip).toHaveClass(/tag-suggestion-chip-selected/)
  await firstChip.click()
  await expect(firstChip).not.toHaveClass(/tag-suggestion-chip-selected/)

  await tagger.confirmBtn.click()

  await expect(tagger.modal).not.toBeVisible()
})
