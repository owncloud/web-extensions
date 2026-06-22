import { test, type Page, type APIRequestContext, expect } from '@playwright/test'
import { createContext, closeContext } from '../../../../support/helpers/actorHelper'
import { LoginPage } from '../../../../support/pages/loginPage'
import { GroupManagementPage } from '../../../../support/pages/groupManagementPage'

const TEST_GROUP = 'e2e group management'

let adminPage: Page

/** Remove the test group via the Graph API so runs stay idempotent. */
async function deleteTestGroup(request: APIRequestContext): Promise<void> {
  const auth = Buffer.from('admin:admin').toString('base64')
  const res = await request.get('/graph/v1.0/groups', {
    headers: { Authorization: `Basic ${auth}` }
  })
  if (!res.ok()) {
    return
  }
  const body = (await res.json()) as { value?: Array<{ id: string; displayName: string }> }
  for (const group of body.value ?? []) {
    if (group.displayName === TEST_GROUP) {
      await request.delete(`/graph/v1.0/groups/${group.id}`, {
        headers: { Authorization: `Basic ${auth}` }
      })
    }
  }
}

test.describe('Group Management', () => {
  test.beforeEach(async ({ browser, request }) => {
    const { page } = await createContext(browser)
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
    await deleteTestGroup(request)
  })

  test.afterEach(async ({ request }) => {
    await deleteTestGroup(request)
    const context = adminPage.context()
    const loginPage = new LoginPage(adminPage)
    await loginPage.logout()
    await closeContext(context)
  })

  test('renders the group management app', async () => {
    const groups = new GroupManagementPage(adminPage)
    await groups.open()
    await expect(groups.view).toBeVisible()
    await expect(groups.createButton).toBeVisible()
  })

  test('creates a group, shows it in the list, then deletes it', async () => {
    const groups = new GroupManagementPage(adminPage)
    await groups.open()

    await groups.createGroup(TEST_GROUP)
    await expect(groups.groupRow(TEST_GROUP)).toBeVisible()

    await groups.selectGroup(TEST_GROUP)
    await expect(groups.detailHeading(TEST_GROUP)).toBeVisible()

    await groups.deleteSelectedGroup()
    await expect(groups.groupRow(TEST_GROUP)).toHaveCount(0)
  })
})
