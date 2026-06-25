import { expect, Page, test } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { FilesAppBar } from '../../../../support/pages/filesAppBarActions'
import { FileCommentsPage } from '../../../../support/pages/fileCommentsPage'
import { FilesPage } from '../../../../support/pages/filesPage'
import { SpacesPage } from '../../../../support/pages/spacesPage'

let adminPage: Page
let projectSpaceId: string | undefined

interface MatrixResource {
  name: string
  comment: string
  type: 'file' | 'folder'
}

const personalResources: MatrixResource[] = [
  { name: 'test-document.txt', comment: 'Personal file one', type: 'file' },
  { name: 'jsonFile.json', comment: 'Personal file two', type: 'file' },
  { name: 'Personal folder one', comment: 'Personal folder one', type: 'folder' },
  { name: 'Personal folder two', comment: 'Personal folder two', type: 'folder' }
]

const projectResources: MatrixResource[] = [
  { name: 'test-document.txt', comment: 'Project file one', type: 'file' },
  { name: 'jsonFile.json', comment: 'Project file two', type: 'file' },
  { name: 'Project folder one', comment: 'Project folder one', type: 'folder' },
  { name: 'Project folder two', comment: 'Project folder two', type: 'folder' }
]

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page
  projectSpaceId = undefined
})

test.afterEach(async () => {
  const spaces = new SpacesPage(adminPage)
  const files = new FilesPage(adminPage)
  if (projectSpaceId) {
    await spaces.delete(projectSpaceId)
  }
  await files.deleteAllFromPersonal()
  await logout(adminPage)
})

test('comments coexist on eight files and folders across personal and project spaces', async () => {
  test.setTimeout(300_000)
  const appBar = new FilesAppBar(adminPage)
  const files = new FilesPage(adminPage)
  const comments = new FileCommentsPage(adminPage)
  const spaces = new SpacesPage(adminPage)

  const createResources = async (resources: MatrixResource[]) => {
    for (const resource of resources) {
      if (resource.type === 'file') {
        await appBar.uploadFile(resource.name)
      } else {
        await files.createFolder(resource.name)
      }
    }
  }

  const addComments = async (resources: MatrixResource[]) => {
    for (const resource of resources) {
      await comments.open(resource.name)
      await comments.add(`**${resource.comment}** is ready for review.`)
      await expect(comments.panel.getByText(resource.comment, { exact: true })).toHaveCSS(
        'font-weight',
        /^(600|700|bold)$/
      )
      await files.closeSidebar()
    }
  }

  const verifyComments = async (resources: MatrixResource[]) => {
    for (const resource of resources) {
      await comments.open(resource.name)
      await expect(comments.panel.getByText(resource.comment, { exact: true })).toBeVisible()
      await files.closeSidebar()
    }
  }

  await files.navigateToPersonal()
  await createResources(personalResources)
  await addComments(personalResources)
  const personalListing = await files.listResourceNames()
  expect(personalListing).toEqual(personalResources.map(({ name }) => name).sort())

  await spaces.navigate()
  projectSpaceId = await spaces.create('File Comments E2E')
  await spaces.open(projectSpaceId)
  await createResources(projectResources)
  await addComments(projectResources)
  const projectListing = await files.listResourceNames()
  expect(projectListing).toEqual(projectResources.map(({ name }) => name).sort())

  await adminPage.reload()
  await verifyComments(projectResources)
  await files.navigateToPersonal()
  await verifyComments(personalResources)

  const finalListing = [
    ...personalListing.map((name) => `personal/${name}`),
    ...projectListing.map((name) => `project/${name}`)
  ]
  expect(finalListing).toHaveLength(8)
  expect(new Set(finalListing).size).toBe(8)
})
