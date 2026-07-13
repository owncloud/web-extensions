import { test, type Page, expect } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { FilesPage } from '../../../../support/pages/filesPage'
import { CollectionsViewPage } from './pages/CollectionsViewPage'

// Acceptance spec for AI Smart Collections Nav Item
// One test per acceptance bullet:
//   1. A "Collections" entry is added to the Application Switcher and opens the collections view.
//      (The spec's originally requested location — the Files app's own left nav via the
//      app.files.navItems/sidebarNav extension point — is registered too, but a live gate run
//      confirmed the installed web-pkg version never renders it; see src/index.ts.)
//   2. Opening it clusters recent files into AI-inferred thematic collections via the LLM's
//      structured {fileId, collection} output.
//   3. Clicking a collection card filters the view down to that collection's files.
//   4. Degrade ladder: when the LLM doesn't return valid structured JSON, the plain-text
//      "one collection label per line" fallback is still parsed and rendered.
//
// The recent-files WebDAV REPORT search (useRecentFiles.ts) and the LLM proxy are both mocked
// at the network boundary — repeated live-gate runs showed the real REPORT search against a
// freshly started stack is slow/unreliable enough to invalidate the session mid-test (the same
// class of problem the LLM mock already exists to avoid). Mocking it doesn't change what's under
// test: parsing, clustering, consent-gating, and rendering are all real application code — only
// the two external network dependencies (search backend, LLM) are stubbed.

interface SeedFile {
  fileId: string
  name: string
}

const SEED_FILES: SeedFile[] = [
  { fileId: 'seed-invoice-1', name: 'invoice-march.pdf' },
  { fileId: 'seed-contract-1', name: 'contract-acme.pdf' },
  { fileId: 'seed-notes-1', name: 'standup-notes.pdf' }
]

function collectionForName(name: string): string {
  if (name.includes('invoice')) return 'Invoices'
  if (name.includes('contract')) return 'Contracts'
  return 'Meeting notes'
}

/**
 * Mocks the recent-files WebDAV REPORT search (useRecentFiles.ts's searchSpace), returning
 * `files` for the first space queried and an empty result for any other space, so a user with
 * multiple spaces doesn't see the seed files duplicated once per space.
 */
async function mockRecentFilesResponse(page: Page, files: SeedFile[]): Promise<void> {
  let served = false
  await page.route('**/dav/spaces/*', async (route) => {
    if (route.request().method() !== 'REPORT') {
      await route.continue()
      return
    }
    const spaceMatch = /\/dav\/spaces\/([^/?]+)/.exec(route.request().url())
    const spaceId = spaceMatch ? decodeURIComponent(spaceMatch[1]) : 'personal'
    const filesToServe = served ? [] : files
    served = true

    const responses = filesToServe
      .map(
        (f) => `
    <d:response>
      <d:href>/dav/spaces/${spaceId}/${f.name}</d:href>
      <d:propstat>
        <d:prop>
          <d:displayname>${f.name}</d:displayname>
          <d:getcontenttype>application/pdf</d:getcontenttype>
          <d:getcontentlength>12345</d:getcontentlength>
          <d:getlastmodified>Mon, 01 Jan 2024 00:00:00 GMT</d:getlastmodified>
          <oc:fileid>${f.fileId}</oc:fileid>
        </d:prop>
        <d:status>HTTP/1.1 200 OK</d:status>
      </d:propstat>
    </d:response>`
      )
      .join('')

    await route.fulfill({
      status: 207,
      headers: { 'Content-Type': 'application/xml' },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">${responses}
</d:multistatus>`
    })
  })
}

/**
 * Mocks the LLM proxy's chat/completions endpoint, deriving the clustering response from the
 * fileIds actually sent in the request instead of hardcoding them, so it stays consistent with
 * whatever mockRecentFilesResponse served.
 */
async function mockClusteringResponse(page: Page, format: 'json' | 'lenient'): Promise<void> {
  await page.route('**/chat/completions', async (route) => {
    const body = route.request().postDataJSON() as { messages: { content: string }[] }
    const prompt = body.messages[0]?.content ?? ''
    const pattern = /fileId:\s*([^\s,]+),\s*name:\s*"([^"]+)"/g
    const files: { fileId: string; name: string }[] = []
    let match: RegExpExecArray | null
    while ((match = pattern.exec(prompt))) {
      files.push({ fileId: match[1], name: match[2] })
    }
    const content =
      format === 'json'
        ? JSON.stringify({
            assignments: files.map((f) => ({
              fileId: f.fileId,
              collection: collectionForName(f.name)
            }))
          })
        : files.map((f) => `${f.fileId}: ${collectionForName(f.name)}`).join('\n')

    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choices: [{ message: { content } }] })
    })
  })
}

let adminPage: Page

test.describe('AI Smart Collections Nav Item', () => {
  test.beforeEach(async ({ browser }) => {
    const admin = await loginAsUser(browser, 'admin', 'admin')
    adminPage = admin.page
  })

  test.afterEach(async () => {
    await logout(adminPage).catch(() => undefined)
  })

  test('"Collections" entry appears in the Application Switcher and opens the collections view', async () => {
    await mockRecentFilesResponse(adminPage, [])

    const files = new FilesPage(adminPage)
    const collections = new CollectionsViewPage(adminPage)

    await files.navigateToPersonal()
    await files.appSwitcherButton.click()
    // Generous timeout: this is the first Application Switcher open against a freshly
    // started stack, and every mounted community app's bundle/manifest needs to be
    // fetched before the full menu is populated.
    await expect(collections.menuItem).toBeVisible({ timeout: 15_000 })

    await collections.menuItem.click()

    await expect(collections.view).toBeVisible()
    await expect(
      adminPage.getByText('No recent files were found to group into collections.')
    ).toBeVisible({ timeout: 15_000 })
  })

  test('opening Collections clusters recent files into AI-inferred thematic collections', async () => {
    await mockRecentFilesResponse(adminPage, SEED_FILES)
    await mockClusteringResponse(adminPage, 'json')

    const collections = new CollectionsViewPage(adminPage)
    await collections.openViaAppSwitcher()
    await collections.confirmConsent()

    for (const label of ['Invoices', 'Contracts', 'Meeting notes']) {
      await expect(collections.collectionCard(label)).toBeVisible({ timeout: 15_000 })
    }
  })

  test('clicking a collection card filters the view to that collection\'s files', async () => {
    await mockRecentFilesResponse(adminPage, SEED_FILES)
    await mockClusteringResponse(adminPage, 'json')

    const collections = new CollectionsViewPage(adminPage)
    await collections.openViaAppSwitcher()
    await collections.confirmConsent()
    await expect(collections.collectionCard('Invoices')).toBeVisible({ timeout: 15_000 })

    await collections.openCollection('Invoices')

    await expect(collections.fileListHeading('Invoices')).toBeVisible()
    await expect(collections.fileRow('invoice-march.pdf')).toBeVisible()
    await expect(collections.fileRow('contract-acme.pdf')).not.toBeVisible()
  })

  test('falls back to lenient line parsing when the LLM does not return valid JSON', async () => {
    await mockRecentFilesResponse(adminPage, SEED_FILES)
    await mockClusteringResponse(adminPage, 'lenient')

    const collections = new CollectionsViewPage(adminPage)
    await collections.openViaAppSwitcher()
    await collections.confirmConsent()

    for (const label of ['Invoices', 'Contracts', 'Meeting notes']) {
      await expect(collections.collectionCard(label)).toBeVisible({ timeout: 15_000 })
    }
  })

  test('does not call the LLM before consent, not at all on denial, and only after confirming', async () => {
    await mockRecentFilesResponse(adminPage, SEED_FILES)
    let completionsCalls = 0
    await adminPage.route('**/chat/completions', async (route) => {
      completionsCalls++
      const body = route.request().postDataJSON() as { messages: { content: string }[] }
      const prompt = body.messages[0]?.content ?? ''
      const pattern = /fileId:\s*([^\s,]+),\s*name:\s*"([^"]+)"/g
      const assignments: { fileId: string; collection: string }[] = []
      let match: RegExpExecArray | null
      while ((match = pattern.exec(prompt))) {
        assignments.push({ fileId: match[1], collection: collectionForName(match[2]) })
      }
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ assignments }) } }] })
      })
    })

    const collections = new CollectionsViewPage(adminPage)
    await collections.openViaAppSwitcher()
    await expect(collections.consentDialog).toBeVisible()
    expect(completionsCalls).toBe(0)

    await collections.denyConsent()
    await expect(
      adminPage.getByText('Grouping was cancelled. No file data was sent to the AI service.')
    ).toBeVisible()
    expect(completionsCalls).toBe(0)

    await collections.retryGroupingAfterDenial()
    await collections.confirmConsent()
    await expect(collections.collectionCard('Invoices')).toBeVisible({ timeout: 15_000 })
    expect(completionsCalls).toBeGreaterThan(0)
  })
})
