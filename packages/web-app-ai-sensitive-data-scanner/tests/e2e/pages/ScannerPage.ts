import { Locator, Page } from '@playwright/test'

export class ScannerPage {
  readonly page: Page
  readonly scanAction: Locator
  readonly resultsModal: Locator

  constructor(page: Page) {
    this.page = page
    this.scanAction = this.page.getByTestId('action-label').filter({ hasText: 'Scan for sensitive data' })
    this.resultsModal = this.page.getByRole('dialog').filter({ hasText: 'Sensitive Data Scan' })
  }
}
