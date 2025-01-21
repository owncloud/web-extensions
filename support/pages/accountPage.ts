import { Locator, Page } from '@playwright/test'

export class AccountPage {
    readonly page: Page
    readonly accountMenuBtn: Locator
    readonly accountManageBtn: Locator
    readonly progressBarSelector: Locator
    readonly progressBarCurrent: Locator
    readonly progressBarOption: Locator

    constructor(page: Page) {
        this.page = page
        this.accountMenuBtn = this.page.locator('.oc-topbar-avatar')
        this.accountManageBtn = this.page.locator('#oc-topbar-account-manage')

        this.progressBarSelector = this.page.locator('.account-page-extensions .extension-preference .vs__search')
        this.progressBarCurrent = this.page.locator('.account-page-extensions .extension-preference .vs__selected span')
        this.progressBarOption = this.page.getByText('Nyan Cat progress bar')
    }

    async goToAccountPage() {
        await this.accountMenuBtn.click()
        await this.accountManageBtn.click()
    }

    async selectProgressBarExtension(name: string){
        await this.progressBarSelector.waitFor()
        await this.progressBarSelector.click()
        await this.progressBarOption.click()
    }
}