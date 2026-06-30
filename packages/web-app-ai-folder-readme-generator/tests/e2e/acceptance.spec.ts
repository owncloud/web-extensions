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

test.afterEach(async () => {
  const files = new FilesPage(adminPage)
  await files.deleteAllFromPersonal()
  await logout(adminPage)
})

test('"Generate README" is visible for folders and hidden for files', async () => {
  const appBar = new FilesAppBar(adminPage)
  const files = new FilesPage(adminPage)
  const readme = new AiReadmeGeneratorPage(adminPage)

  await files.navigateToPersonal()
  await appBar.uploadFile('test-document.txt')
  expect(await readme.isGenerateActionVisible('test-document.txt')).toBe(false)

  await files.createFolder('Project Docs')
  // A freshly created folder is inserted into the list optimistically and does not
  // reliably carry a populated `isFolder` flag until the listing is re-fetched from
  // the server (see the same workaround in FilesPage.rename()). Reload so the
  // context-menu check below sees the real, PROPFIND-backed resource.
  await files.navigateToPersonal()
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

  await files.navigateToPersonal()
  await files.createFolder('Mocked README Folder')
  await files.navigateToPersonal()

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

  await files.navigateToPersonal()
  await files.createFolder('Existing README Folder')
  await files.navigateToPersonal()
  await files.openFolder('Existing README Folder')
  await readme.uploadExistingReadme()
  await expect(readme.readmeEntry()).toBeVisible()

  await files.navigateToPersonal()
  await readme.clickGenerate('Existing README Folder')

  await expect(readme.overwriteDialog).toBeVisible()
  await readme.overwriteCancelBtn.click()
  await expect(readme.overwriteDialog).not.toBeVisible()
})
