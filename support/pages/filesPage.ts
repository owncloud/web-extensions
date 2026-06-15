import { Locator, Page } from '@playwright/test'

export class FilesPage {
  readonly page: Page
  readonly extractHereBtn: Locator
  readonly selectAllCheckbox: Locator
  readonly deleteBtn: Locator
  readonly owncloudLogo: Locator
  readonly jsonViewerBtn: Locator
  readonly jsonViewerSelector: Locator
  readonly castFileActionBtn: Locator
  readonly appSwitcherButton: Locator
  readonly files: Locator

  constructor(page: Page) {
    this.page = page
    this.extractHereBtn = this.page.locator('.context-menu .oc-files-actions-unzip-archive')
    this.selectAllCheckbox = this.page.getByLabel('Select all')
    this.deleteBtn = this.page.locator('.oc-files-actions-delete-trigger')
    this.owncloudLogo = this.page.locator('.oc-logo-image')
    this.jsonViewerBtn = this.page.locator('.oc-files-actions-json-viewer-trigger')
    this.jsonViewerSelector = this.page.locator('#json-viewer')
    this.castFileActionBtn = this.page.locator('[data-testid="action-label"] :text-is("Cast")')
    this.appSwitcherButton = this.page.locator('#_appSwitcherButton')
    this.files = this.page.locator('[data-test-id="app.files.menuItem"]')
  }

  getResourceNameSelector(resource: string): Locator {
    return this.page.locator(`.oc-resource-link [data-test-resource-name="${resource}"]`)
  }

  async openFileContextMenu(resource: string) {
    const resourceLocator = this.getResourceNameSelector(resource)
    const rowLocator = this.page
      .locator('.has-item-context-menu tr')
      .filter({ has: resourceLocator })
    await rowLocator.locator('.resource-table-btn-action-dropdown').click()
  }

  async extractZip(file: string) {
    await this.openFileContextMenu(file)

    await Promise.all([
      this.page.waitForResponse(
        (resp) => resp.status() === 201 && resp.request().method() === 'MKCOL'
      ),
      this.extractHereBtn.click()
    ])
  }

  async deleteAllFromPersonal() {
    const closeUploadBar = this.page.locator('#close-upload-bar-btn')
    if (await closeUploadBar.isVisible()) {
      await closeUploadBar.click()
    }
    await this.appSwitcherButton.click()
    await this.files.click()
    const sidebarCloseBtn = this.page
      .locator('[data-testid="app-sidebar"]')
      .getByLabel('Close file sidebar')
    if (await sidebarCloseBtn.isVisible()) {
      await sidebarCloseBtn.click()
    }
    await this.selectAllCheckbox.check()
    await this.deleteBtn.click()
  }

  async openFolder(folder: string) {
    const folderLocator = this.getResourceNameSelector(folder)
    await folderLocator.click()
  }

  async openJsonFile(jsonFIle: string) {
    await this.openFileContextMenu(jsonFIle)
    await this.jsonViewerBtn.click()
  }
}
