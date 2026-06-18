import { test, Page, expect } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { FilesPage } from '../../../../support/pages/filesPage'
import { ChatWithFilePage } from '../../../../support/pages/chatWithFilePage'

let adminPage: Page

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page
  await adminPage.route('**/ai-llm-proxy/v1/chat/completions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content: 'Mocked AI response.' } }]
      })
    })
  )
})

test.afterEach(async () => {
  const filesPage = new FilesPage(adminPage)
  await filesPage.deleteAllFromPersonal()
  await logout(adminPage)
})

test('"Chat with file" appears in the context menu for supported file types only', async () => {
  const appBar = new FilesAppBar(adminPage)
  const chat = new ChatWithFilePage(adminPage)

  await appBar.uploadFile('test-document.txt')
  expect(await chat.isChatActionVisible('test-document.txt')).toBe(true)

  await appBar.uploadFile('logo.jpeg')
  expect(await chat.isChatActionVisible('logo.jpeg')).toBe(false)
})

test('clicking "Chat with file" opens the Chat sidebar panel', async () => {
  const appBar = new FilesAppBar(adminPage)
  const chat = new ChatWithFilePage(adminPage)

  await appBar.uploadFile('test-document.txt')
  await chat.clickChatWithFile('test-document.txt')

  await expect(chat.sidebar).toBeVisible()
  await expect(chat.chatPanel).toBeVisible()
})

test('chat panel shows message input and mode pills for a text file', async () => {
  const appBar = new FilesAppBar(adminPage)
  const chat = new ChatWithFilePage(adminPage)

  await appBar.uploadFile('test-document.txt')
  await chat.clickChatWithFile('test-document.txt')

  await expect(chat.messageInput()).toBeVisible()
  await expect(chat.sendButton()).toBeVisible()
  await expect(chat.chatModePill()).toBeVisible()
  await expect(chat.editModePill()).toBeVisible()
  await expect(chat.editModePill()).toBeEnabled()
})

test('Edit mode pill is disabled for PDF files', async () => {
  const appBar = new FilesAppBar(adminPage)
  const chat = new ChatWithFilePage(adminPage)

  await appBar.uploadFile('test-document.pdf')
  await chat.clickChatWithFile('test-document.pdf')

  await expect(chat.chatPanel).toBeVisible()
  await expect(chat.editModePill()).toBeDisabled()
})

test('sending a chat message displays the AI reply', async () => {
  const appBar = new FilesAppBar(adminPage)
  const chat = new ChatWithFilePage(adminPage)

  await appBar.uploadFile('test-document.txt')
  await chat.clickChatWithFile('test-document.txt')

  await chat.sendMessage('What is this file about?')

  await expect(chat.assistantMessages()).toBeVisible()
  await expect(chat.assistantMessages()).toContainText('Mocked AI response.')
})

test('edit mode: sending an instruction shows a diff and Apply button', async () => {
  const appBar = new FilesAppBar(adminPage)
  const chat = new ChatWithFilePage(adminPage)

  await appBar.uploadFile('test-document.txt')
  await chat.clickChatWithFile('test-document.txt')

  await chat.editModePill().click()
  await chat.sendMessage('Fix the typo')

  await expect(chat.diffArea()).toBeVisible()
  await expect(chat.applyButton()).toBeVisible()
})
