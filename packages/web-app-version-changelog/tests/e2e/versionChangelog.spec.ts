import { test, type Page, type APIRequestContext, expect } from '@playwright/test'
import { createContext, closeContext } from '../../../../support/helpers/actorHelper'
import { LoginPage } from '../../../../support/pages/loginPage'
import { FilesPage } from '../../../../support/pages/filesPage'
import { VersionChangelogPage } from '../../../../support/pages/versionChangelogPage'

const TEST_FILENAME = 'version-changelog-test.txt'

const INITIAL_CONTENT = `Introduction

This document describes the initial project scope.
Core features include data import and basic filtering.
Performance requirements are to be defined later.`

const UPDATED_CONTENT = `Introduction

This document describes the updated project scope with clearer milestones.
Core features include data import, advanced filtering, and CSV export.
Performance requirements: response time under 200ms for standard queries.

Performance Benchmarks

Initial benchmarks show 150ms average response time for small datasets.`

const MOCK_LLM_RESPONSE = {
  choices: [
    {
      message: {
        content:
          'Added a performance benchmarks section and updated the scope to include CSV export and a 200ms response time target.'
      }
    }
  ]
}

let adminPage: Page

/** Upload the test file twice via WebDAV to create one stored version in OcIS. */
async function createFileVersions(request: APIRequestContext): Promise<void> {
  const auth = Buffer.from('admin:admin').toString('base64')
  for (const content of [INITIAL_CONTENT, UPDATED_CONTENT]) {
    await request.put(`/remote.php/dav/files/admin/${TEST_FILENAME}`, {
      data: content,
      headers: { 'Content-Type': 'text/plain', Authorization: `Basic ${auth}` }
    })
  }
}

test.describe('Version Changelog panel', () => {
  test.beforeEach(async ({ browser, request }) => {
    const { page } = await createContext(browser)

    // Inject an LLM config into the OcIS web config before the app initialises so the
    // Generate button is enabled during tests.  The mock LLM endpoint is intercepted
    // separately per-test via page.route('**/chat/completions', ...).
    // If OcIS serves the web config at a path other than /config.json in your deployment,
    // update the route pattern below accordingly.
    await page.route('**/config.json', async (route) => {
      try {
        const response = await route.fetch()
        const body = (await response.json()) as Record<string, unknown>
        const options = (body.options as Record<string, unknown>) ?? {}
        await route.fulfill({
          status: response.status(),
          headers: response.headers(),
          body: JSON.stringify({
            ...body,
            options: {
              ...options,
              llm: { endpoint: 'https://llm.mock.invalid/v1', model: 'test-model' }
            }
          })
        })
      } catch {
        await route.continue()
      }
    })

    const loginPage = new LoginPage(page)
    await page.goto('/')
    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().endsWith('logon') &&
          resp.status() === 200 &&
          resp.request().method() === 'POST'
      ),
      loginPage.login('admin', 'admin')
    ])

    adminPage = page

    await createFileVersions(request)
  })

  test.afterEach(async () => {
    const filesPage = new FilesPage(adminPage)
    await filesPage.deleteAllFromPersonal()
    const context = adminPage.context()
    const loginPage = new LoginPage(adminPage)
    await loginPage.logout()
    await closeContext(context)
  })

  test('changelog panel is visible in the sidebar for a text file', async () => {
    const changelog = new VersionChangelogPage(adminPage)
    await changelog.openFor(TEST_FILENAME)
    await expect(changelog.panel).toBeVisible()
  })

  test('panel renders one version row for a file with one stored version', async () => {
    const changelog = new VersionChangelogPage(adminPage)
    await changelog.openFor(TEST_FILENAME)
    await expect(changelog.versionRows()).toHaveCount(1)
  })

  test('Generate renders the LLM summary as plain text', async () => {
    await adminPage.route('**/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(MOCK_LLM_RESPONSE)
      })
    })

    const changelog = new VersionChangelogPage(adminPage)
    await changelog.openFor(TEST_FILENAME)
    await changelog.generateButton().click()

    await expect(changelog.panel.locator('.changelog-entry-plain')).toBeVisible()
    await expect(changelog.panel).toContainText('performance benchmarks section')
  })

  test('Generate shows an error message when the LLM returns 500', async () => {
    await adminPage.route('**/chat/completions', async (route) => {
      await route.fulfill({ status: 500 })
    })

    const changelog = new VersionChangelogPage(adminPage)
    await changelog.openFor(TEST_FILENAME)
    await changelog.generateButton().click()

    await expect(changelog.entryError()).toBeVisible()
    await expect(changelog.entryError()).toContainText('temporarily unavailable')
    await expect(changelog.retryButton()).toBeVisible()
  })

  test('Retry button clears the error and re-runs generation', async () => {
    let callCount = 0
    await adminPage.route('**/chat/completions', async (route) => {
      callCount += 1
      if (callCount === 1) {
        await route.fulfill({ status: 500 })
      } else {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(MOCK_LLM_RESPONSE)
        })
      }
    })

    const changelog = new VersionChangelogPage(adminPage)
    await changelog.openFor(TEST_FILENAME)
    await changelog.generateButton().click()

    await expect(changelog.entryError()).toBeVisible()
    await changelog.retryButton().click()

    await expect(changelog.entryError()).not.toBeVisible()
    await expect(changelog.panel.locator('.changelog-entry-plain')).toBeVisible()
  })
})
