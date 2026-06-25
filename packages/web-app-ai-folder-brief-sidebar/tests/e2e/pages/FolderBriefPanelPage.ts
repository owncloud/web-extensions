import { Locator, Page } from '@playwright/test'
import { FilesPage } from '../../../../../support/pages/filesPage'

export class FolderBriefPanelPage {
  readonly page: Page
  readonly sidebar: Locator
  readonly panel: Locator

  constructor(page: Page) {
    this.page = page
    this.sidebar = this.page.getByTestId('app-sidebar')
    this.panel = this.page.getByTestId('ai-folder-brief-panel')
  }

  folderBriefTab(): Locator {
    return this.sidebar.getByRole('button', { name: 'Folder Brief' })
  }

  placeholder(): Locator {
    return this.panel.locator('.ai-folder-brief-placeholder')
  }

  errorBanner(): Locator {
    return this.panel.locator('.ai-folder-brief-error')
  }

  regenerateButton(): Locator {
    return this.panel.getByRole('button', { name: 'Regenerate' })
  }

  async openFor(folderName: string): Promise<void> {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(folderName)
    await this.page.getByTestId('action-label').filter({ hasText: 'Details' }).click()
    await this.sidebar.waitFor({ state: 'visible' })
    await this.folderBriefTab().waitFor({ state: 'visible' })
    await this.folderBriefTab().click()
    await this.panel.waitFor({ state: 'visible' })
  }
}
