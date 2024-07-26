import { Before, BeforeAll, After, AfterAll, setDefaultTimeout } from '@cucumber/cucumber'
import { chromium } from '@playwright/test'
import config from './config'
import { store } from './store'

setDefaultTimeout(config.timeout * 1000)

BeforeAll(async function () {
  store.browser = await chromium.launch({
    slowMo: config.slowMo,
    headless: config.headless,
    channel: 'chrome'
  })
})

Before(async function () {
  store.context = await store.browser.newContext({ ignoreHTTPSErrors: true })
  store.page = await store.context.newPage()
})

AfterAll(async function () {
  await store.browser.close()
})

After(async function () {
  await store.page.close()
})
