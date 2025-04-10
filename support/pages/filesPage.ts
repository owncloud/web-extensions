import { Locator, Page } from '@playwright/test'

export class FilesPage {
  readonly page: Page
  readonly extractHereBtn: Locator
  readonly selectAllCheckbox: Locator
  readonly deleteBtn: Locator
  readonly owncloudLogo: Locator
  readonly jsonViewerBtn: Locator
  readonly resourceActionDropDownBtn: Locator
  readonly jsonViewerSelector: Locator


  constructor(page: Page) {
    this.page = page
    this.extractHereBtn = this.page.locator('.context-menu .oc-files-actions-unzip-archive')
    this.selectAllCheckbox = this.page.getByLabel('Select all')
    this.deleteBtn = this.page.locator('.oc-files-actions-delete-trigger')
    this.owncloudLogo = this.page.locator('.oc-logo-image')
    this.jsonViewerBtn = this.page.locator('.oc-files-actions-json-viewer-trigger')
    this.resourceActionDropDownBtn = this.page.locator('.resource-table-btn-action-dropdown')
    this.jsonViewerSelector = this.page.locator('#json-viewer')
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
      this.extractHereBtn.click()
    ])
  }

  async deleteAllFromPersonal() {
    await this.owncloudLogo.click()
    await this.selectAllCheckbox.check()
    await this.deleteBtn.click()
  }

  async openFolder(folder: string) {
    const folderLocator = this.getResourceNameSelector(folder)
    await folderLocator.click()
  }

  async openJsonFile(){
    await this.resourceActionDropDownBtn.click()
    await this.jsonViewerBtn.click()
  }
}