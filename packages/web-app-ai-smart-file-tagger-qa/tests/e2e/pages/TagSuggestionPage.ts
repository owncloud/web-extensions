import { Locator, Page } from '@playwright/test'
import { FilesPage } from '../../../../../support/pages/filesPage'

export class TagSuggestionPage {
  readonly page: Page
  readonly suggestTagsAction: Locator
  readonly modal: Locator
  readonly chips: Locator
  readonly confirmBtn: Locator
  readonly dismissBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.suggestTagsAction = this.page.getByTestId('action-label').filter({ hasText: 'Suggest tags' })
    this.modal = this.page.getByRole('dialog').filter({ hasText: 'Suggest Tags' })
    this.chips = this.modal.getByTestId('tag-suggestion-chips').locator('.tag-suggestion-chip')
    // Confirm/Cancel are rendered by the modal framework itself (declared via
    // dispatchModal's confirmText / the default Cancel), not by this component.
    this.confirmBtn = this.modal.getByRole('button', { name: 'Apply tags' })
    this.dismissBtn = this.modal.getByRole('button', { name: 'Cancel' })
  }

  /** Opens the context menu for a resource and clicks the "Suggest tags" action. */
  async open(resource: string): Promise<void> {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(resource)
    await this.suggestTagsAction.click()
  }
}
