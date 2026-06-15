import { Locator, Page } from '@playwright/test'
import { FilesPage } from './filesPage'

export class AiDocSummaryPage {
  readonly page: Page
  readonly sidebar: Locator
  readonly summaryPanel: Locator
  readonly summarizeAction: Locator

  constructor(page: Page) {
    this.page = page
    this.sidebar = this.page.getByTestId('app-sidebar')
    this.summaryPanel = this.page.getByTestId('ai-doc-summary-panel')
    this.summarizeAction = this.page.getByTestId('action-label').filter({ hasText: 'Summarize' })
  }

  /** Opens the context menu for a resource and clicks the Summarize action. */
  async clickSummarize(resource: string): Promise<void> {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(resource)
    await this.summarizeAction.click()
  }

  /** Opens the context menu for a resource and returns whether "Summarize" is listed. */
  async isSummarizeVisible(resource: string): Promise<boolean> {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(resource)
    const visible = await this.summarizeAction.isVisible()
    await this.page.keyboard.press('Escape')
    return visible
  }

  /** Summary sidebar tab button (used to switch to the panel when sidebar is already open). */
  summaryTab(): Locator {
    return this.sidebar.getByRole('button', { name: 'Summary' })
  }
}
