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

test('open external sites named "Owncloud External" in new tab', async () => {
  const appSwitcher = new AppSwitcher(adminPage)
  await appSwitcher.openExternalSites('Owncloud External', 'external')
  const pagePromise = adminPage.waitForEvent('popup')
  const newTab = await pagePromise
  await newTab.waitForLoadState()
  await expect(newTab).toHaveURL('https://owncloud.dev')
  const response = await newTab.request.get('https://owncloud.dev')
  expect(response.status()).toBe(200)
})

test('open external sites named "Owncloud Embedded" in embedded view', async () => {
  const appSwitcher = new AppSwitcher(adminPage)
  await appSwitcher.openExternalSites('Owncloud Embedded', 'embedded')
  await expect(adminPage).toHaveURL(/.*external-sites\/owncloud%20embedded$/)
})
