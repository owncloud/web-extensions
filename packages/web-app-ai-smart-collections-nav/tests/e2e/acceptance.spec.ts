import { test, type Page, type APIRequestContext, expect } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { FilesPage } from '../../../../support/pages/filesPage'
import { CollectionsViewPage } from './pages/CollectionsViewPage'

// Acceptance spec for AI Smart Collections Nav Item
// One test per acceptance bullet:
//   1. A "Collections" entry is added to the Files app's left nav and opens the collections view.
//   2. Opening it clusters recent files into AI-inferred thematic collections via the LLM's
//      structured {fileId, collection} output.
//   3. Clicking a collection card filters the view down to that collection's files.
//   4. Degrade ladder: when the LLM doesn't return valid structured JSON, the plain-text
//      "one collection label per line" fallback is still parsed and rendered.

interface SeedFile {
  name: string
  content: string
}

const SEED_FILES: SeedFile[] = [
  {
    name: 'invoice-march.txt',
    content: 'Invoice #1042 for March consulting services. Amount due: $450.00.'
  },
  {
    name: 'contract-acme.txt',
    content: 'Service agreement between Acme Corp and the customer, effective Jan 1.'
  },
  {
    name: 'standup-notes.txt',
    content: 'Sprint planning notes: reviewed backlog, assigned action items to the team.'
  }
]

function collectionForName(name: string): string {
  if (name.includes('invoice')) return 'Invoices'
  if (name.includes('contract')) return 'Contracts'
  return 'Meeting notes'
}

async function createSeedFiles(request: APIRequestContext): Promise<void> {
  const auth = Buffer.from('admin:admin').toString('base64')
  for (const file of SEED_FILES) {
    await request.fetch(`/remote.php/dav/files/admin/${file.name}`, {
      method: 'PUT',
      data: file.content,
      headers: { 'Content-Type': 'text/plain', Authorization: `Basic ${auth}` }
    })
  }
}

/** Reads the `fileId: <id>, name: "<name>"` pairs useCollections embeds in its prompt. */
function extractFilesFromPrompt(prompt: string): { fileId: string; name: string }[] {
  const files: { fileId: string; name: string }[] = []
  const pattern = /fileId:\s*([^\s,]+),\s*name:\s*"([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(prompt))) {
    files.push({ fileId: match[1], name: match[2] })
  }
  return files
}

/**
 * Mocks the LLM proxy's chat/completions endpoint, deriving the clustering response from the
 * fileIds actually sent in the request (real oCIS fileIds can't be predicted ahead of time)
 * instead of hardcoding them.
 */
async function mockClusteringResponse(page: Page, format: 'json' | 'lenient'): Promise<void> {
  await page.route('**/chat/completions', async (route) => {
    const body = route.request().postDataJSON() as { messages: { content: string }[] }
    const prompt = body.messages[0]?.content ?? ''
    const files = extractFilesFromPrompt(prompt)
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
    const files = new FilesPage(adminPage)
    await files.navigateToPersonal()
    const anyResource = files.page.locator('.has-item-context-menu [data-test-resource-name]').first()
    if (await anyResource.isVisible().catch(() => false)) {
      await files.deleteAllFromPersonal()
    }
    await logout(adminPage)
  })

  test('"Collections" entry appears in the Files app left nav and opens the collections view', async () => {
    const files = new FilesPage(adminPage)
    const collections = new CollectionsViewPage(adminPage)

    await files.navigateToPersonal()
    await expect(collections.navLink).toBeVisible()

    await collections.navLink.click()

    await expect(collections.view).toBeVisible()
    await expect(
      adminPage.getByText('No recent files were found to group into collections.')
    ).toBeVisible({ timeout: 15_000 })
  })

  test('opening Collections clusters recent files into AI-inferred thematic collections', async ({
    request
  }) => {
    await createSeedFiles(request)
    await mockClusteringResponse(adminPage, 'json')

    const collections = new CollectionsViewPage(adminPage)
    await collections.openViaNav()
    await collections.confirmConsent()

    for (const label of ['Invoices', 'Contracts', 'Meeting notes']) {
      await expect(collections.collectionCard(label)).toBeVisible({ timeout: 20_000 })
    }
  })

  test('clicking a collection card filters the view to that collection\'s files', async ({
    request
  }) => {
    await createSeedFiles(request)
    await mockClusteringResponse(adminPage, 'json')

    const collections = new CollectionsViewPage(adminPage)
    await collections.openViaNav()
    await collections.confirmConsent()
    await expect(collections.collectionCard('Invoices')).toBeVisible({ timeout: 20_000 })

    await collections.openCollection('Invoices')

    await expect(collections.fileListHeading('Invoices')).toBeVisible()
    await expect(collections.fileRow('invoice-march.txt')).toBeVisible()
    await expect(collections.fileRow('contract-acme.txt')).not.toBeVisible()
  })

  test('falls back to lenient line parsing when the LLM does not return valid JSON', async ({
    request
  }) => {
    await createSeedFiles(request)
    await mockClusteringResponse(adminPage, 'lenient')

    const collections = new CollectionsViewPage(adminPage)
    await collections.openViaNav()
    await collections.confirmConsent()

    for (const label of ['Invoices', 'Contracts', 'Meeting notes']) {
      await expect(collections.collectionCard(label)).toBeVisible({ timeout: 20_000 })
    }
  })
})
