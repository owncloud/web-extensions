import { Given, When } from '@cucumber/cucumber'
import config from '../config'
import { AccountPage } from '../pageObjects/accountPage'
import { BasePage } from '../pageObjects/basePage'
import { LoginPage } from '../pageObjects/loginPage'
import { store } from '../store'

const accountPage = new AccountPage(store)
const filesPage = new BasePage(store)
const loginPage = new LoginPage(store)

Given(
  'the user has logged in with username {string} and password {string}',
  async function (user: string, password: string) {
    await store.page.goto(config.baseUrlOcis)
    await loginPage.login({ username: user, password: password })
  }
)

Given('the user has navigated to the account menu', async function () {
  await filesPage.goToAccountPage()
})

When('the user selects the progress bar extension {string}', async function (name: string) {
  await accountPage.selectProgressBarExtension(name)
})
