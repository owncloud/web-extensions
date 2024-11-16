import { test, Page, expect } from '@playwright/test'
import { AppSwitcher } from '../../../../support/pages/appSwitcher'
import { DrawIoPage } from '../../../../support/pages/drawIoPage'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'

let adminPage: Page

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page
})

test.afterEach(async () => {
  await logout(adminPage)
})

test('create drawio file', async () => {
  const appSwitcher = new AppSwitcher(adminPage)
  await appSwitcher.clickAppSwitcher()
  await appSwitcher.createDrawIoFile()
  await expect(adminPage).toHaveURL(/.*draw-io/)

  const darwIo = new DrawIoPage(adminPage)
  await darwIo.addContent()
  await darwIo.save()
  await darwIo.close()
})
