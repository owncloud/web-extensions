import { expect, Locator, Page } from '@playwright/test'
import { FilesPage } from './filesPage'

export class FileCommentsPage {
  readonly page: Page
  readonly sidebar: Locator
  readonly panel: Locator
  readonly commentInput: Locator
  readonly submitButton: Locator

  constructor(page: Page) {
    this.page = page
    this.sidebar = page.getByTestId('app-sidebar')
    this.panel = page.getByTestId('file-comments-panel')
    this.commentInput = this.panel.getByLabel('Add a comment')
    this.submitButton = this.panel.getByTestId('file-comments-submit')
  }

  async open(resource: string) {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(resource)
    await this.page
      .locator('[id^="context-menu-drop"]:visible')
      .getByTestId('action-label')
      .filter({ hasText: 'Comments' })
      .click()
    await expect(this.panel).toBeVisible()
  }

  async add(body: string) {
    await this.commentInput.fill(body)
    await this.submitButton.click()
  }
}
