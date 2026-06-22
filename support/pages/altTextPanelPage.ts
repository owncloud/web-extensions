import { Locator, Page } from '@playwright/test'
import { FilesPage } from './filesPage'

export class AltTextPanelPage {
  readonly page: Page
  readonly sidebar: Locator
  readonly panel: Locator

  constructor(page: Page) {
    this.page = page
    this.sidebar = this.page.getByTestId('app-sidebar')
    this.panel = this.page.getByTestId('ai-alt-text-panel')
  }

  generateButton(): Locator {
    return this.panel.getByRole('button', { name: 'Generate' })
  }

  regenerateButton(): Locator {
    return this.panel.getByRole('button', { name: 'Regenerate' })
  }

  saveButton(): Locator {
    return this.panel.getByRole('button', { name: 'Save' })
  }

  textarea(): Locator {
    return this.panel.locator('textarea')
  }

  placeholder(): Locator {
    return this.panel.locator('.ai-alt-text-placeholder')
  }

  errorBanner(): Locator {
    return this.panel.locator('.ai-alt-text-error')
  }

  altTextTab(): Locator {
    return this.sidebar.getByRole('button', { name: 'Alt Text' })
  }

  async clickGenerateAltTextAction(resource: string): Promise<void> {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(resource)
    await this.page.getByTestId('action-label').filter({ hasText: 'Generate Alt Text' }).click()
  }

  async isGenerateAltTextActionVisible(resource: string): Promise<boolean> {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(resource)
    const visible = await this.page
      .getByTestId('action-label')
      .filter({ hasText: 'Generate Alt Text' })
      .isVisible()
    await this.page.keyboard.press('Escape')
    return visible
  }

  async closeSidebar(): Promise<void> {
    const closeBtn = this.sidebar.getByLabel('Close file sidebar')
    if (await closeBtn.isVisible()) {
      await closeBtn.click()
    }
  }
}
