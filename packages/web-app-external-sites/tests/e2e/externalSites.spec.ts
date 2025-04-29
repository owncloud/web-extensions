import { test, Page, expect } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { AppSwitcher } from '../../../../support/pages/appSwitcher'

let adminPage: Page

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page
})

test.afterEach(async () => {
  await logout(adminPage)
})

test('open external sites named "ownCloud" in new tab', async () => {
  const appSwitcher = new AppSwitcher(adminPage)
  await appSwitcher.openExternalSites('ownCloud')
  const pagePromise = adminPage.waitForEvent('popup')
  const newTab = await pagePromise
  await newTab.waitForLoadState()
  await expect(newTab).toHaveURL('https://owncloud.com/')
})
