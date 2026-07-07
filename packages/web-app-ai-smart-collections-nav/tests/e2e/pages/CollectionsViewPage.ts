import { Locator, Page } from '@playwright/test'
import { FilesPage } from '../../../../../support/pages/filesPage'

export class CollectionsViewPage {
  readonly page: Page
  readonly view: Locator
  readonly navLink: Locator
  readonly consentDialog: Locator
  readonly errorBanner: Locator
  readonly retryButton: Locator

  constructor(page: Page) {
    this.page = page
    this.view = this.page.getByTestId('collections-view')
    // The app.files.navItems extension point is new and unverified against the Files
    // app's actual rendering — accept either a router-link or a handler-driven button
    // for the "Collections" entry rather than assuming one exact element type.
    this.navLink = this.page
      .getByRole('link', { name: 'Collections' })
      .or(this.page.getByRole('button', { name: 'Collections' }))
    this.consentDialog = this.page.getByTestId('ai-collections-consent')
    this.errorBanner = this.view.locator('.collections-view-error')
    this.retryButton = this.view.getByRole('button', { name: 'Retry' })
  }

  /** Opens Collections via the Files app's own left nav (app.files.navItems). */
  async openViaNav(): Promise<void> {
    const files = new FilesPage(this.page)
    await files.navigateToPersonal()
    await this.navLink.click()
    await this.view.waitFor({ state: 'visible' })
  }

  async confirmConsent(): Promise<void> {
    await this.consentDialog.waitFor({ state: 'visible' })
    await this.consentDialog.getByRole('button', { name: 'Group my files' }).click()
  }

  collectionCard(label: string): Locator {
    return this.view.getByRole('button', { name: `View collection "${label}"` })
  }

  async openCollection(label: string): Promise<void> {
    await this.collectionCard(label).click()
  }

  fileListHeading(label: string): Locator {
    return this.view.getByRole('heading', { level: 2, name: label })
  }

  fileRow(name: string): Locator {
    return this.view.locator('.collection-file-table tbody tr').filter({ hasText: name })
  }

  async backToGrid(): Promise<void> {
    await this.view.getByLabel('Back to collections').click()
  }
}
