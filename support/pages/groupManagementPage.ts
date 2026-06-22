import { Locator, Page } from '@playwright/test'

export class GroupManagementPage {
  readonly page: Page
  readonly view: Locator
  readonly createButton: Locator

  constructor(page: Page) {
    this.page = page
    this.view = this.page.getByTestId('group-management-view')
    this.createButton = this.page.getByTestId('group-management-create')
  }

  /** Navigate to the Group Management app and wait for it to render. */
  async open(): Promise<void> {
    await this.page.goto('/group-management')
    await this.createButton.waitFor({ state: 'visible' })
  }

  groupRow(name: string): Locator {
    return this.page.getByTestId('group-management-group-row').filter({ hasText: name })
  }

  detailHeading(name: string): Locator {
    return this.view.getByRole('heading', { level: 2, name })
  }

  private dialog(): Locator {
    return this.page.getByRole('dialog')
  }

  async createGroup(name: string): Promise<void> {
    await this.createButton.click()
    await this.dialog().waitFor({ state: 'visible' })
    await this.page.locator('#group-management-input-display-name').fill(name)
    await this.dialog().getByRole('button', { name: 'Create', exact: true }).click()
    await this.groupRow(name).waitFor({ state: 'visible' })
  }

  async selectGroup(name: string): Promise<void> {
    await this.groupRow(name).click()
    await this.detailHeading(name).waitFor({ state: 'visible' })
  }

  async deleteSelectedGroup(): Promise<void> {
    await this.view.getByRole('button', { name: 'Delete group' }).click()
    await this.dialog().waitFor({ state: 'visible' })
    await this.dialog().getByRole('button', { name: 'Delete', exact: true }).click()
  }
}
