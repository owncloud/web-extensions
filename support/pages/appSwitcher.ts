import { Locator, Page } from '@playwright/test'

export class AppSwitcher {
  readonly page: Page
  readonly drawIoBtn: Locator
  readonly appSwitcher: Locator

  constructor(page: Page) {
    this.page = page
    this.drawIoBtn = this.page.locator('[data-test-id="app\\.draw-io\\.menuItem"]')
    this.appSwitcher = this.page.getByLabel('Application Switcher')
  }

  async clickAppSwitcher() {
    await this.appSwitcher.click()
  }

  async createDrawIoFile() {
    await Promise.all([
      this.page.waitForResponse(
        (resp) =>
          resp.url().endsWith('drawio') &&
          resp.status() === 201 &&
          resp.request().method() === 'PUT'
      ),
      this.drawIoBtn.click()
    ])
  }

  async openExternalSites( externalSitesName: string, mode: 'embedded' | 'external' ) {
    const externalSites = this.page.locator(`[data-test-id="external-sites-${externalSitesName}"]`)
    await this.clickAppSwitcher()
    if (mode == 'embedded')
    {
      await Promise.all([
        this.page.waitForResponse(
          (resp) =>
            resp.url().endsWith('dev/') &&
            resp.status() === 200 &&
            resp.request().method() === 'GET'
        ),
        externalSites.click()
      ])
    }
    else{
      externalSites.click()
    }
  }
}