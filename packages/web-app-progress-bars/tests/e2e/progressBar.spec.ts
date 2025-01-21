import { test, Page, expect } from '@playwright/test'
import { AccountPage } from "../../../../support/pages/accountPage";
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'

let adminPage: Page

test.beforeEach(async ({ browser }) => {
    const admin = await loginAsUser(browser, 'admin', 'admin')
    adminPage = admin.page
})

test.afterEach(async () => {
    await logout(adminPage)
})

test('select the progressBarOption', async () => {
    const accountPage = new AccountPage(adminPage)
    await accountPage.goToAccountPage()
    await accountPage.selectProgressBarExtension('Nyan Cat progress bar')

    const progressBarCurrent = await accountPage.progressBarCurrent.textContent()
    expect(progressBarCurrent).toEqual('Nyan Cat progress bar')
})