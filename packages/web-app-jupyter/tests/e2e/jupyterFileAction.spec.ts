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

test('check jupyter file-action', async () => {
  const uploadFile = new FilesAppBar(adminPage)
  await uploadFile.uploadFile('notebook.ipynb')

  const filePage = new FilesPage(adminPage)
  await filePage.openFileContextMenu('notebook.ipynb')
  await expect(filePage.jupyterFileActionBtn).toBeVisible()
})
