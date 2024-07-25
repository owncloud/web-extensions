import { expect } from '@playwright/test'
import util from 'util'
import { BasePage } from './basePage'

const elements = {
  progressBarSelector: '.account-page-extensions .extension-preference .vs__search',
  progressBarOption: '//div[@class="extension-preference"]//li//span[text()="%s"]',
  progressBarCurrent: '.account-page-extensions .extension-preference .vs__selected span'
}

export class AccountPage extends BasePage {
  async selectProgressBarExtension(name: string) {
    // FIXME: await profile picture element focus
    await new Promise((resolve) => setTimeout(resolve, 500))

    await this.page.locator(elements.progressBarSelector).waitFor()
    await this.page.locator(elements.progressBarSelector).click()
    await this.page.locator(util.format(elements.progressBarOption, name)).click()

    const progressBarCurrent = await this.page.locator(elements.progressBarCurrent).textContent()
    expect(progressBarCurrent).toEqual(name)
  }
}
