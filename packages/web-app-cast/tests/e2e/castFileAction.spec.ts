import { test, Page, expect } from '@playwright/test'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { FilesPage } from '../../../../support/pages/filesPage'

let adminPage: Page

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page
})

test.afterEach(async () => {
  const filesPage = new FilesPage(adminPage)
  await filesPage.deleteAllFromPersonal()
  await logout(adminPage)
})

test.fail('check cast file-action', async () => {
  const uploadFile = new FilesAppBar(adminPage)
  await uploadFile.uploadFile('logo.jpeg')

  const filePage = new FilesPage(adminPage)
  await filePage.openFileContextMenu('logo.jpeg')
  await expect(filePage.castFileActionBtn).toBeVisible()
})
