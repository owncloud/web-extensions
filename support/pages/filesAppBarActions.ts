import { Locator, Page, expect } from '@playwright/test'
import { fileURLToPath } from 'url'

export class FilesAppBar {
  readonly page: Page
  readonly uploadBtn: Locator
  readonly uploadFileBtn: Locator
  readonly closeUploadDialogBtn: Locator
  readonly newResourceContextMenu: Locator
  readonly uploadResourceContextMenu: Locator

  constructor(page: Page) {
    this.page = page
    this.uploadBtn = this.page.locator('#upload-menu-btn')
    this.uploadFileBtn = this.page.locator('#files-file-upload-input')
    this.closeUploadDialogBtn = this.page.locator('#close-upload-bar-btn')
    this.newResourceContextMenu = this.page.locator('#upload-menu-drop')
    this.uploadResourceContextMenu = this.page.locator('#new-file-menu-drop')
  }

  async uploadFile(file: string) {
    await this.uploadBtn.click()
    const realPath = fileURLToPath(new URL(`../filesForUpload/${file}`, import.meta.url))
    const replaceBtn = this.page.getByRole('button', { name: 'Replace' })
    await Promise.all([
      this.page.waitForResponse(
        (resp) =>
          [201, 204].includes(resp.status()) &&
          ['POST', 'PUT', 'PATCH'].includes(resp.request().method())
      ),
      (async () => {
        await this.uploadFileBtn.setInputFiles(realPath)
        if (await replaceBtn.isVisible()) {
          await replaceBtn.click()
        }
      })()
    ])
    await this.closeUploadDialogBtn.click()
    await expect(this.newResourceContextMenu).not.toBeVisible()
    await expect(this.uploadResourceContextMenu).not.toBeVisible()
  }
}
