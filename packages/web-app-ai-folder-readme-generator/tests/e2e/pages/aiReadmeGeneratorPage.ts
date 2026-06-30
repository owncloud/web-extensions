import { Locator, Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import { FilesPage } from '../../../../../support/pages/filesPage'

export class AiReadmeGeneratorPage {
  readonly page: Page
  readonly generateAction: Locator
  readonly overwriteDialog: Locator
  readonly overwriteConfirmBtn: Locator
  readonly overwriteCancelBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.generateAction = this.page.getByTestId('action-label').filter({ hasText: 'Generate README' })
    this.overwriteDialog = this.page.locator('.oc-folder-readme-overwrite-dialog')
    this.overwriteConfirmBtn = this.page.locator('.oc-folder-readme-overwrite-dialog-confirm')
    this.overwriteCancelBtn = this.page.locator('.oc-folder-readme-overwrite-dialog-cancel')
  }

  /** Opens the context menu for a resource and returns whether "Generate README" is listed. */
  async isGenerateActionVisible(resource: string): Promise<boolean> {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(resource)
    const visible = await this.generateAction.isVisible()
    await this.page.keyboard.press('Escape')
    return visible
  }

  /** Opens the context menu for a resource and clicks the "Generate README" action. */
  async clickGenerate(resource: string): Promise<void> {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(resource)
    await this.generateAction.click()
  }

  /** Locator for the README.md entry in the currently open folder listing. */
  readmeEntry(): Locator {
    return new FilesPage(this.page).getResourceNameSelector('README.md')
  }

  /** Uploads the bundled README.md fixture into the currently open folder. */
  async uploadExistingReadme(): Promise<void> {
    const fixturePath = fileURLToPath(new URL('../fixtures/README.md', import.meta.url))
    const uploadBtn = this.page.locator('#upload-menu-btn')
    const uploadInput = this.page.locator('#files-file-upload-input')
    const closeBtn = this.page.locator('#close-upload-bar-btn')

    await uploadBtn.click()
    await Promise.all([
      this.page.waitForResponse(
        (resp) =>
          [201, 204].includes(resp.status()) &&
          ['POST', 'PUT', 'PATCH'].includes(resp.request().method())
      ),
      uploadInput.setInputFiles(fixturePath)
    ])
    if (await closeBtn.isVisible()) {
      await closeBtn.click()
    }
  }
}
