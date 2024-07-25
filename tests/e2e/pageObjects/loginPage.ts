import { BasePage } from './basePage'

const elements = {
  userNameSelector: '#oc-login-username',
  passwordSelector: '#oc-login-password',
  loginButtonSelector: 'button[type="submit"]',
  webContentSelector: '#web-content'
}

export class LoginPage extends BasePage {
  async login({ username, password }) {
    await this.page.locator(elements.userNameSelector).fill(username)
    await this.page.locator(elements.passwordSelector).fill(password)
    await this.page.locator(elements.loginButtonSelector).click()
    await this.page.locator(elements.webContentSelector).waitFor()
  }
}
