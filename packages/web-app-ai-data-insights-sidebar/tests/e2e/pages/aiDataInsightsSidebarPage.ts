import { Locator, Page, expect } from '@playwright/test'
import { FilesPage } from '../../../../../support/pages/filesPage'
import { fileURLToPath } from 'url'

export class AiDataInsightsSidebarPage {
  readonly page: Page
  readonly sidebar: Locator
  readonly panel: Locator

  constructor(page: Page) {
    this.page = page
    this.sidebar = this.page.getByTestId('app-sidebar')
    this.panel = this.page.getByTestId('ai-data-insights-panel')
  }

  insightsTab(): Locator {
    return this.sidebar.getByRole('button', { name: 'Insights' })
  }

  analyzeButton(): Locator {
    return this.panel.getByRole('button', { name: 'Analyze' })
  }

  async isInsightsActionVisible(resource: string): Promise<boolean> {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(resource)
    const visible = await this.page
      .getByTestId('action-label')
      .filter({ hasText: 'Insights' })
      .isVisible()
    await this.page.keyboard.press('Escape')
    return visible
  }

  async clickInsights(resource: string): Promise<void> {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(resource)
    await this.page.getByTestId('action-label').filter({ hasText: 'Insights' }).click()
  }

  /** Uploads the bundled sample.csv fixture and returns its filename. */
  async uploadCsvFile(): Promise<string> {
    const fixturePath = fileURLToPath(new URL('../fixtures/sample.csv', import.meta.url))
    const uploadBtn = this.page.locator('#upload-menu-btn')
    const uploadInput = this.page.locator('#files-file-upload-input')
    const closeBtn = this.page.locator('#close-upload-bar-btn')
    const uploadMenuDrop = this.page.locator('#upload-menu-drop')
    const newFileMenuDrop = this.page.locator('#new-file-menu-drop')

    await uploadBtn.click()
    await Promise.all([
      this.page.waitForResponse(
        (resp) =>
          [201, 204].includes(resp.status()) &&
          ['POST', 'PUT', 'PATCH'].includes(resp.request().method())
      ),
      uploadInput.setInputFiles(fixturePath)
    ])
    await closeBtn.click()
    await expect(newFileMenuDrop).not.toBeVisible()
    await expect(uploadMenuDrop).not.toBeVisible()
    return 'sample.csv'
  }
}
