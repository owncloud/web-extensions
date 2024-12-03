import { Locator, Page } from '@playwright/test'

export class FilesPage {
  readonly page: Page
  readonly uploadBtn: Locator
  readonly extractHereBtnBtn: Locator
  readonly selectAllCheckbox: Locator


  constructor(page: Page) {
    this.page = page
    this.extractHereBtnBtn = this.page.locator('.context-menu .oc-files-actions-unzip-archive')
    this.selectAllCheckbox = this.page.getByLabel('Select all')
  }

  getResourceNameSelector(resource: string): Locator {
    return this.page.locator(`#files-space-table [data-test-resource-name="${resource}"]`);
  }

  async extractZip(file: string) {
    const fileLocator = this.getResourceNameSelector(file)
    await fileLocator.click({ button: 'right' })

    await Promise.all([
      this.page.waitForResponse(
        (resp) =>
          resp.status() === 201 &&
          resp.request().method() === 'MKCOL'
      ),
      this.extractHereBtnBtn.click()
    ])
  }

  async deleteAllFromPersonal() {
    await this.page.getByRole('link', { name: 'Navigate to personal files' }).click();
    await this.selectAllCheckbox.check();
    await this.page.getByRole('button', { name: 'Delete' }).click()
  }

  async openFolder(folder: string) {
    const folderLocator = this.getResourceNameSelector(folder)
    await folderLocator.click()
  }
}