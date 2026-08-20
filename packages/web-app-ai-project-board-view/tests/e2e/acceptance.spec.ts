import { expect, Page, test } from '@playwright/test'
import { loginAsUser, logout } from '../../../../support/helpers/authHelper'
import { SpacesPage } from '../../../../support/pages/spacesPage'
import { ProjectBoardPage } from './pages/projectBoardPage'

// Acceptance spec for AI Project Space Status Board.
// Covers the sketch's core walkthrough: a project space's files, classified by the
// (mocked) LLM into Draft / In Review / Final lanes and rendered as a status board.

let adminPage: Page
let projectSpaceId: string | undefined

test.beforeEach(async ({ browser }) => {
  const admin = await loginAsUser(browser, 'admin', 'admin')
  adminPage = admin.page
  projectSpaceId = undefined
})

test.afterEach(async () => {
  const spaces = new SpacesPage(adminPage)
  if (projectSpaceId) {
    await spaces.delete(projectSpaceId)
  }
  await logout(adminPage)
})

test('switching a project space to the Status Board view groups its files into Draft, In Review, and Final lanes', async () => {
  test.setTimeout(300_000)
  const spaces = new SpacesPage(adminPage)
  const board = new ProjectBoardPage(adminPage)

  await board.mockClassification({
    'draft-outline.txt': 'draft',
    'review-brief.txt': 'in review',
    'final-report.txt': 'final',
    'approved-summary.txt': 'final'
  })

  await spaces.navigate()
  projectSpaceId = await spaces.create('Status Board E2E')
  await spaces.open(projectSpaceId)

  await board.uploadFixture('draft-outline.txt')
  await board.uploadFixture('review-brief.txt')
  await board.uploadFixture('final-report.txt')

  await board.switchToBoardView()

  await expect(board.laneCard('draft', 'draft-outline.txt')).toBeVisible()
  await expect(board.laneCard('in-review', 'review-brief.txt')).toBeVisible()
  await expect(board.laneCard('final', 'final-report.txt')).toBeVisible()

  await expect(board.lane('draft').getByTestId('board-card')).toHaveCount(1)
  await expect(board.lane('in-review').getByTestId('board-card')).toHaveCount(1)
  await expect(board.lane('final').getByTestId('board-card')).toHaveCount(1)

  // Re-run classification after a new file lands — demonstrates the board updates
  // in place rather than requiring a full page reload.
  await board.uploadFixture('approved-summary.txt')
  await board.rerunClassification()

  await expect(board.laneCard('final', 'approved-summary.txt')).toBeVisible()
  await expect(board.lane('final').getByTestId('board-card')).toHaveCount(2)
  await expect(board.lane('draft').getByTestId('board-card')).toHaveCount(1)
  await expect(board.lane('in-review').getByTestId('board-card')).toHaveCount(1)
})
