import { Page } from '@playwright/test'
import { Store } from '../store'

const elements = {
  accountMenuButton: '.oc-topbar-avatar',
  accountManageButton: '#oc-topbar-account-manage'
}

export class BasePage {
  store: Store

  constructor(store: Store) {
    this.store = store
  }

  get page(): Page {
    return this.store.page
  }

  async goToAccountPage() {
    await this.page.locator(elements.accountMenuButton).click()
    await this.page.locator(elements.accountManageButton).click()
  }
}
