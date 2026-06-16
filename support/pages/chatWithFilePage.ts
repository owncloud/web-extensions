import { Locator, Page } from '@playwright/test'
import { FilesPage } from './filesPage'

export class ChatWithFilePage {
  readonly page: Page
  readonly sidebar: Locator
  readonly chatPanel: Locator
  readonly chatAction: Locator

  constructor(page: Page) {
    this.page = page
    this.sidebar = this.page.getByTestId('app-sidebar')
    this.chatPanel = this.page.getByTestId('chat-with-file-panel')
    this.chatAction = this.page
      .getByTestId('action-label')
      .filter({ hasText: 'Chat with file' })
  }

  async clickChatWithFile(resource: string): Promise<void> {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(resource)
    await this.chatAction.click()
  }

  async isChatActionVisible(resource: string): Promise<boolean> {
    const files = new FilesPage(this.page)
    await files.openFileContextMenu(resource)
    const visible = await this.chatAction.isVisible()
    await this.page.keyboard.press('Escape')
    return visible
  }

  chatTab(): Locator {
    return this.sidebar.getByRole('button', { name: 'Chat' })
  }

  editModePill(): Locator {
    return this.chatPanel.getByRole('button', { name: 'Edit' })
  }

  chatModePill(): Locator {
    return this.chatPanel.getByRole('button', { name: 'Chat' })
  }

  messageInput(): Locator {
    return this.chatPanel.getByLabel('Chat message input')
  }

  sendButton(): Locator {
    return this.chatPanel.getByLabel('Send message')
  }

  async sendMessage(text: string): Promise<void> {
    await this.messageInput().fill(text)
    await this.sendButton().click()
  }

  assistantMessages(): Locator {
    return this.chatPanel.locator('.chat-message--assistant')
  }

  applyButton(): Locator {
    return this.chatPanel.getByRole('button', { name: 'Apply to file' })
  }

  diffArea(): Locator {
    return this.chatPanel.locator('.chat-diff')
  }
}
