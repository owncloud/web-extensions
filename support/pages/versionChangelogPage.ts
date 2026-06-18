import { Locator, Page } from '@playwright/test'
import { FilesPage } from './filesPage'

export class VersionChangelogPage {
  readonly page: Page
  readonly sidebar: Locator
  readonly panel: Locator

  constructor(page: Page) {
    this.page = page
    this.sidebar = this.page.getByTestId('app-sidebar')
    this.panel = this.page.getByTestId('version-changelog-panel')
  }

  versionRows(): Locator {
    return this.panel.getByTestId('version-row')
  }

  generateButton(rowIndex = 0): Locator {
    return this.versionRows().nth(rowIndex).getByRole('button', { name: 'Generate' })
  }

  retryButton(rowIndex = 0): Locator {
    return this.versionRows().nth(rowIndex).getByRole('button', { name: 'Retry' })
  }

  entryError(rowIndex = 0): Locator {
    return this.versionRows().nth(rowIndex).locator('.changelog-entry-error')
  }

  changelogTab(): Locator {
    return this.sidebar.getByRole('button', { name: 'Changelog' })
  }

  /** Opens the file's context menu and clicks "Details" to open the sidebar, then switches to the Changelog tab. */
  async openFor(filename: string): Promise<void> {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(filename)
    await this.page.getByTestId('action-label').filter({ hasText: 'Details' }).click()
    await this.sidebar.waitFor({ state: 'visible' })
    await this.changelogTab().waitFor({ state: 'visible' })
    await this.changelogTab().click()
    await this.panel.waitFor({ state: 'visible' })
  }
}
