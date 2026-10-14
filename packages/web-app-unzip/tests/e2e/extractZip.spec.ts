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
  // Match by resource name, not role: whether a file renders as a link or a button
  // depends on whether an editor app has registered for its type yet.
  await expect(file.getResourceNameSelector('logo-wide.png')).toBeVisible()
  await expect(file.getResourceNameSelector('lorem.txt')).toBeVisible()
})
