import { Locator, Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import { FilesPage } from '../../../../../support/pages/filesPage'

export class AiReadmeGeneratorPage {
  readonly page: Page
  readonly overwriteDialog: Locator
  readonly overwriteConfirmBtn: Locator
  readonly overwriteCancelBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.overwriteDialog = this.page.locator('.oc-folder-readme-overwrite-dialog')
    this.overwriteConfirmBtn = this.page.locator('.oc-folder-readme-overwrite-dialog-confirm')
    this.overwriteCancelBtn = this.page.locator('.oc-folder-readme-overwrite-dialog-cancel')
  }

  // Scoped to the currently open dropdown (same "[id^=context-menu-drop]:visible"
  // pattern as support/pages/fileCommentsPage.ts) so the lookup can't match a stray,
  // not-yet-unmounted menu left over from a previous context-menu interaction.
  private openMenuAction(): Locator {
    return this.page
      .locator('[id^="context-menu-drop"]:visible')
      .getByTestId('action-label')
      .filter({ hasText: 'Generate README' })
  }

  /** Opens the context menu for a resource and returns whether "Generate README" is listed. */
  async isGenerateActionVisible(resource: string): Promise<boolean> {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(resource)
    // locator.isVisible() does not wait for the action list to finish rendering, so
    // wait (bounded) before concluding a genuinely hidden action is simply absent.
    const visible = await this.openMenuAction()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false)
    await this.page.keyboard.press('Escape')
    return visible
  }

  /** Opens the context menu for a resource and clicks the "Generate README" action. */
  async clickGenerate(resource: string): Promise<void> {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(resource)
    await this.openMenuAction().click()
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
