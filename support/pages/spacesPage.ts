import { expect, Page } from '@playwright/test'

export class SpacesPage {
  constructor(private readonly page: Page) {}

  async navigate() {
    await this.page.goto('/files/spaces/projects')
    await this.page.locator('#new-space-menu-btn').waitFor({ state: 'visible' })
  }

  async create(name: string): Promise<string> {
    await this.page.locator('#new-space-menu-btn').click()
    const modal = this.page.locator('.oc-modal')
    await modal.locator('.oc-text-input').fill(name)
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (candidate) =>
          candidate.status() === 201 &&
          candidate.request().method() === 'POST' &&
          candidate.url().endsWith('drives?template=default')
      ),
      modal.getByRole('button', { name: 'Create', exact: true }).click()
    ])
    const { id } = (await response.json()) as { id: string }
    await expect(this.page.locator(`[data-item-id="${id}"]`)).toBeVisible()
    return id
  }

  async open(id: string) {
    await this.page.locator(`[data-item-id="${id}"] .oc-resource-basename`).click()
    await this.page.locator('.space-header').waitFor({ state: 'visible' })
  }

  async delete(id: string) {
    await this.navigate()
    const tile = this.page.locator(`[data-item-id="${id}"]`)
    if (!(await tile.isVisible())) {
      return
    }

    await tile.getByLabel('Show context menu').click()
    await this.page
      .locator('[id^="context-menu-drop"]:visible .oc-files-actions-disable-trigger')
      .click()
    await this.page
      .locator('.oc-modal')
      .getByRole('button', { name: 'Disable', exact: true })
      .click()
    await expect(tile).not.toBeVisible()

    await this.page.getByRole('button', { name: 'Include disabled' }).click()
    await expect(tile).toBeVisible()
    await tile.getByLabel('Show context menu').click()
    await this.page
      .locator('[id^="context-menu-drop"]:visible .oc-files-actions-delete-trigger')
      .click()
    const modal = this.page.locator('.oc-modal')
    await Promise.all([
      this.page.waitForResponse(
        (response) =>
          response.request().method() === 'DELETE' &&
          decodeURIComponent(response.url()).includes(`/drives/${id}`)
      ),
      modal.getByRole('button', { name: 'Delete', exact: true }).click()
    ])
    await expect(tile).not.toBeVisible()
  }
}
