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

  // FilesPage.navigateToPersonal() does a hard page.goto(), which re-bootstraps the
  // whole SPA (and with it every extension's setup()). The app config — including
  // this extension's `llm` block — is fetched asynchronously after that bootstrap, so
  // a context-menu check performed right after such a reload can race ahead of the
  // config and see this action as permanently unconfigured for the rest of that page
  // load. Navigating back to Personal via the in-app sidebar link avoids a reload
  // entirely, keeping the already-initialized extension (and its already-resolved
  // config) alive.
  //
  // Deliberately not the Breadcrumbs "Personal" button: while the route transitions
  // out of the folder view, the outgoing (folder) breadcrumb and the incoming
  // (Personal) breadcrumb can both be present for a moment, so that locator briefly
  // resolves to two elements and the click races the outgoing one being torn down.
  // The sidebar's "Personal" link doesn't re-render on route change, so it's never
  // ambiguous.
  async goToPersonalRoot(): Promise<void> {
    await this.page
      .getByRole('navigation', { name: 'Sidebar navigation menu' })
      .getByRole('link', { name: 'Personal', exact: true })
      .click()
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
