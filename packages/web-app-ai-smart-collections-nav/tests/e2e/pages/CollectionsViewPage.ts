import { Locator, Page } from '@playwright/test'
import { FilesPage } from '../../../../../support/pages/filesPage'

export class CollectionsViewPage {
  readonly page: Page
  readonly view: Locator
  readonly menuItem: Locator
  readonly consentDialog: Locator
  readonly errorBanner: Locator
  readonly retryButton: Locator

  constructor(page: Page) {
    this.page = page
    this.view = this.page.getByTestId('collections-view')
    // The app.files.navItems/sidebarNav extension point (the spec's originally requested
    // location) isn't rendered by the installed web-pkg version — confirmed against a live
    // gate run. The app menu item is the actual, working entry point (same mechanism
    // draw-io/group-management use), following the app.<id>.menuItem data-test-id convention.
    this.menuItem = this.page.locator(`[data-test-id="app.ai-smart-collections-nav.menuItem"]`)
    this.consentDialog = this.page.getByTestId('ai-collections-consent')
    this.errorBanner = this.view.locator('.collections-view-error')
    this.retryButton = this.view.getByRole('button', { name: 'Retry' })
  }

  /** Opens Collections via the Application Switcher menu entry. */
  async openViaAppSwitcher(): Promise<void> {
    const files = new FilesPage(this.page)
    await files.navigateToPersonal()
    await files.appSwitcherButton.click()
    await this.menuItem.click()
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
