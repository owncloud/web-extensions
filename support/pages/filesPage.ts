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
    await this.navigateToPersonal()
    const closeUploadBar = this.page.locator('#close-upload-bar-btn')
    if (await closeUploadBar.isVisible()) {
      await closeUploadBar.click()
    }
    const sidebarCloseBtn = this.page
      .locator('[data-testid="app-sidebar"]')
      .getByLabel('Close file sidebar')
    if (await sidebarCloseBtn.isVisible()) {
      await sidebarCloseBtn.click()
    }
    await this.page.locator('.has-item-context-menu tr').first().waitFor({ state: 'visible' })
    const resources = this.page.locator('.has-item-context-menu [data-test-resource-name]')
    await this.selectAllCheckbox.check()
    await this.deleteBtn.click()
    await resources.first().waitFor({ state: 'detached' })
  }

  async openFolder(folder: string) {
    const folderLocator = this.getResourceNameSelector(folder)
    await folderLocator.click()
  }

  async navigateToPersonal() {
    await this.page.goto('/files/spaces/personal')
    await this.page.locator('#files-view').waitFor({ state: 'visible' })
  }

  async listResourceNames(): Promise<string[]> {
    const names = await this.page
      .locator('.has-item-context-menu [data-test-resource-name]')
      .evaluateAll((elements) =>
        elements
          .map((element) => element.getAttribute('data-test-resource-name'))
          .filter((name): name is string => Boolean(name))
      )
    return [...new Set(names)].sort()
  }

  async closeSidebar() {
    const closeButton = this.page.getByTestId('app-sidebar').getByLabel('Close file sidebar')
    if (await closeButton.isVisible()) {
      await closeButton.click()
    }
  }

  async rename(resource: string, inputName: string): Promise<string> {
    await this.closeSidebar()
    await this.openFileContextMenu(resource)
    await this.page.locator('.oc-files-actions-rename-trigger').click()
    const modal = this.page.locator('.oc-modal')
    const input = modal.locator('.oc-text-input')
    await input.fill(inputName)
    const [moveResponse] = await Promise.all([
      this.page.waitForResponse(
        (response) => response.status() === 201 && response.request().method() === 'MOVE'
      ),
      modal.getByRole('button', { name: 'Rename', exact: true }).click()
    ])
    const destination = decodeURIComponent(moveResponse.request().headers().destination)
    const renamedResource = new URL(destination).pathname.split('/').pop()
    if (!renamedResource) {
      throw new Error(`Invalid rename destination: ${destination}`)
    }
    await this.page.reload()
    await this.getResourceNameSelector(renamedResource).waitFor({
      state: 'visible',
      timeout: 10_000
    })
    return renamedResource
  }

  async createFolder(name: string) {
    const createMenuButton = this.page.locator('#new-file-menu-btn')
    if (await createMenuButton.isVisible()) {
      await createMenuButton.click()
    }
    await this.page.locator('#new-folder-btn:visible').click()
    const modal = this.page.locator('.oc-modal')
    await modal.locator('.oc-text-input').fill(name)
    await Promise.all([
      this.page.waitForResponse(
        (response) => response.status() === 201 && response.request().method() === 'MKCOL'
      ),
      modal.getByRole('button', { name: 'Create', exact: true }).click()
    ])
  }

  async cutAndPasteInto(resource: string, folder: string) {
    await this.closeSidebar()
    await this.openFileContextMenu(resource)
    await this.page
      .locator('[id^="context-menu-drop"]:visible .oc-files-actions-move-trigger')
      .click()
    await this.openFolder(folder)
    await Promise.all([
      this.page.waitForResponse(
        (response) => response.status() === 201 && response.request().method() === 'MOVE'
      ),
      this.page.locator('.paste-files-btn').click()
    ])
  }

  async openJsonFile(jsonFIle: string) {
    await this.openFileContextMenu(jsonFIle)
    await this.jsonViewerBtn.click()
  }
}
