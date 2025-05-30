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

test('open json file', async () => {
  const uploadFile = new FilesAppBar(adminPage)
  await uploadFile.uploadFile('jsonFile.json')

  const filePage = new FilesPage(adminPage)
  await filePage.openJsonFile('jsonFile.json')
  await expect(filePage.jsonViewerSelector).toBeVisible()
})
