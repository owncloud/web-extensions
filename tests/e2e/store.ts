import { Browser, BrowserContext, Page } from '@playwright/test'

export type Store = {
  browser: Browser
  context: BrowserContext
  page: Page
}

export const store: Store = {
  browser: undefined,
  context: undefined,
  page: undefined
}
