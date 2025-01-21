import { Locator, Page } from '@playwright/test'

export class AccountPage {
    readonly page: Page
    readonly accountMenuButton: Locator
    readonly accountManageButton: Locator
    readonly progressBarSelector: Locator
    readonly progressBarOption: Locator
    readonly progressBarCurrent: Locator

    constructor(page: Page) {
        this.page = page
        this.accountMenuButton = this.page.locator('.oc-topbar-avatar')
        this.accountManageButton = this.page.locator('#oc-topbar-account-manage')

        this.progressBarSelector = this.page.locator('.account-page-extensions .extension-preference .vs__search')
        this.progressBarOption = this.page.locator('//div[@class="extension-preference"]//span[text()="%s"]')
        this.progressBarCurrent = this.page.locator('.account-page-extensions .extension-preference .vs__selected span')
    }

    async goToAccountPage() {
        await this.accountMenuButton.click()
        await this.accountManageButton.click()
    }

    async selectProgressBarExtension(name: string){
        await new Promise((resolve) => setTimeout(resolve, 500))
        await this.progressBarSelector.waitFor()
        await this.progressBarSelector.click()
        await this.page.getByText(name).click();
    }
}