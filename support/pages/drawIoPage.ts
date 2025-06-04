import { Locator, FrameLocator, Page } from '@playwright/test'

export class DrawIoPage {
  readonly page: Page
  readonly saveBtn: Locator
  readonly closeBtn: Locator
  readonly frameLocator: FrameLocator

  constructor(page: Page) {
    this.page = page
    this.frameLocator = this.page.frameLocator('iframe[title="Draw\\.io editor"]')
    this.saveBtn = this.frameLocator.getByRole('button', { name: 'Save' })
    this.closeBtn = this.page.getByLabel('Close')
  }

  async addContent() {
    // toggle sidebar
    await this.frameLocator.locator('.geToolbar > a.geButton').first().click()
    const meuItemLocator = this.frameLocator.locator('tr.mxPopupMenuItem :text-is("Shapes")')
    if (!(await meuItemLocator.locator('div').isVisible())) {
      await meuItemLocator.click()
    } else {
      // close the menu
      await this.frameLocator.locator('.geToolbar > a.geButton').first().click()
    }
    await this.frameLocator.locator('.geSidebar > a.geItem').first().click()
    await this.frameLocator.locator('.geDiagramContainer > svg').click()
  }

  async save() {
    await Promise.all([
      this.page.waitForResponse(
        (resp) =>
          resp.url().endsWith('drawio') &&
          resp.status() === 204 &&
          resp.request().method() === 'PUT'
      ),
      this.saveBtn.click()
    ])
  }

  async close() {
    await this.closeBtn.click()
  }
}
