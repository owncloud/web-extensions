import { test, Page, expect } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { FilesPage } from '../../../../support/pages/filesPage'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { AiReadmeGeneratorPage } from './pages/aiReadmeGeneratorPage'

let adminPage: Page

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page
})

// Local stand-in for FilesPage.deleteAllFromPersonal(): a not-yet-unmounted
// per-resource context menu left over from an earlier action in this suite (e.g.
// AiReadmeGeneratorPage.clickGenerate()) can carry its own "Delete" entry with the
// same ".oc-files-actions-delete-trigger" class as the bulk-actions toolbar button,
// so the shared helper's unscoped delete locator matches two elements and throws in
// Playwright's strict mode. Scoped here, in this package, rather than in
// support/pages/filesPage.ts — the gate's hygiene stage requires every build's diff
// to stay inside packages/web-app-ai-folder-readme-generator/, and that file is
// shared by every other extension's e2e suite.
async function deleteAllFromPersonal(page: Page, files: FilesPage): Promise<void> {
  await files.navigateToPersonal()
  const closeUploadBar = page.locator('#close-upload-bar-btn')
  if (await closeUploadBar.isVisible()) {
    await closeUploadBar.click()
  }
  await files.closeSidebar()
  await page.locator('.has-item-context-menu tr').first().waitFor({ state: 'visible' })
  const resources = page.locator('.has-item-context-menu [data-test-resource-name]')
  await files.selectAllCheckbox.check()
  await page.locator('#oc-appbar-batch-actions .oc-files-actions-delete-trigger').click()
  await resources.first().waitFor({ state: 'detached' })
}

test.afterEach(async () => {
  const files = new FilesPage(adminPage)
  await deleteAllFromPersonal(adminPage, files)
  await logout(adminPage)
})

// None of these tests call FilesPage.navigateToPersonal() mid-test: it does a hard
// page.goto(), which re-bootstraps the SPA (and the extension's async-loaded app
// config) and can race the "Generate README" visibility check — see
// AiReadmeGeneratorPage.goToPersonalRoot() for the in-app alternative used below.
// loginAsUser() already lands on Personal, so no initial navigation is needed either.

test('"Generate README" is visible for folders and hidden for files', async () => {
  const appBar = new FilesAppBar(adminPage)
  const files = new FilesPage(adminPage)
  const readme = new AiReadmeGeneratorPage(adminPage)

  await appBar.uploadFile('test-document.txt')
  expect(await readme.isGenerateActionVisible('test-document.txt')).toBe(false)

  await files.createFolder('Project Docs')
  expect(await readme.isGenerateActionVisible('Project Docs')).toBe(true)
})

test('clicking "Generate README" writes README.md into the folder via the mocked LLM proxy', async () => {
  const files = new FilesPage(adminPage)
  const readme = new AiReadmeGeneratorPage(adminPage)

  await adminPage.route('**/ai-llm-proxy/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                headline: 'Project Docs',
                subheadline: 'A workspace for project documentation',
                purpose: 'Holds project documentation and reference material for the team.',
                key_files: [{ name: 'test-document.txt', description: 'Reference notes.' }],
                usage_notes: ['Keep files up to date.']
              })
            }
          }
        ]
      })
    })
  )

  await files.createFolder('Mocked README Folder')

  await Promise.all([
    adminPage.waitForResponse(
      (resp) =>
        resp.request().method() === 'PUT' &&
        resp.url().includes('README.md') &&
        resp.status() < 300
    ),
    readme.clickGenerate('Mocked README Folder')
  ])

  await files.openFolder('Mocked README Folder')
  await expect(readme.readmeEntry()).toBeVisible()
})

test('the overwrite dialog is shown and generation is skipped when README.md already exists', async () => {
  const files = new FilesPage(adminPage)
  const readme = new AiReadmeGeneratorPage(adminPage)

  await files.createFolder('Existing README Folder')
  await files.openFolder('Existing README Folder')
  await readme.uploadExistingReadme()
  await expect(readme.readmeEntry()).toBeVisible()

  await readme.goToPersonalRoot()
  await readme.clickGenerate('Existing README Folder')

  await expect(readme.overwriteDialog).toBeVisible()
  await readme.overwriteCancelBtn.click()
  await expect(readme.overwriteDialog).not.toBeVisible()
})
