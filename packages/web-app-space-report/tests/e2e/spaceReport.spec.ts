import { test, type Page, type APIRequestContext, expect } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'

const PROJECT = 'e2e space report'
const auth = { Authorization: `Basic ${Buffer.from('admin:admin').toString('base64')}` }

let adminPage: Page

/** Disable + purge the test project so runs stay idempotent. */
async function deleteTestProject(request: APIRequestContext): Promise<void> {
  const res = await request.get(`/graph/v1beta1/drives?$filter=driveType eq project`, {
    headers: auth
  })
  if (!res.ok()) {
    return
  }
  const body = (await res.json()) as { value?: Array<{ id: string; name: string }> }
  for (const drive of body?.value ?? []) {
    if (drive.name === PROJECT) {
      const url = `/graph/v1.0/drives/${encodeURIComponent(drive.id)}`
      await request.delete(url, { headers: auth })
      await request.delete(url, { headers: { ...auth, Purge: 'T' } })
    }
  }
}

test.describe('Space Report', () => {
  test.beforeEach(async ({ browser, request }) => {
    await deleteTestProject(request)
    const created = await request.post('/graph/v1beta1/drives', {
      headers: auth,
      data: { name: PROJECT, quota: { total: 10 * 1024 * 1024 } }
    })
    expect(created.ok()).toBeTruthy()
    const { page } = await loginAsUser(browser, 'admin', 'admin')
    adminPage = page
  })

  test.afterEach(async ({ request }) => {
    await deleteTestProject(request)
    await logout(adminPage)
  })

  test('lists spaces and exports a markdown report', async () => {
    await adminPage.goto('/space-report')
    const view = adminPage.getByTestId('space-report-view')
    await expect(view).toBeVisible()
    await expect(adminPage.getByTestId('space-report-tile-personal')).toBeVisible()
    await expect(
      adminPage.getByTestId('space-report-row').filter({ hasText: PROJECT })
    ).toBeVisible()

    const downloadPromise = adminPage.waitForEvent('download')
    await adminPage.getByTestId('space-report-markdown').click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^space-report-.*\.md$/)
  })
})
