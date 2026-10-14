import { test, Page, expect } from '@playwright/test'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { FilesPage } from '../../../../support/pages/filesPage'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'

let adminPage: Page

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page
})

test.afterEach(async () => {
  const file = new FilesPage(adminPage)
  await file.deleteAllFromPersonal()
  await logout(adminPage)
})

test('extract zip file', async () => {
  const uploadFile = new FilesAppBar(adminPage)
  await uploadFile.uploadFile('data.zip')

  const file = new FilesPage(adminPage)
  await file.extractZip('data.zip')

  await file.openFolder('data')

  // extractZip() only waits for the MKCOL creating the target folder; the extracted
  // files are uploaded afterwards, and the open (still empty) folder view is not
  // refreshed when that upload finishes. Re-enter the folder (via in-app navigation,
  // a page reload would abort the running upload) until the files have arrived.
  const logo = adminPage.getByRole('button', { name: 'logo-wide.png', exact: true })
  const lorem = adminPage.getByRole('link', { name: 'lorem.txt', exact: true })
  await expect(async () => {
    await adminPage
      .getByRole('navigation', { name: 'Breadcrumbs' })
      .getByRole('link', { name: 'Personal' })
      .click()
    await file.openFolder('data')
    await expect(logo).toBeVisible({ timeout: 2000 })
    await expect(lorem).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 30_000 })
})
