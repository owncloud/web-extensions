import { Locator, Page, expect } from '@playwright/test'
import { fileURLToPath } from 'url'

export class ProjectBoardPage {
  readonly page: Page
  readonly board: Locator
  readonly viewModeButton: Locator
  readonly rerunButton: Locator

  constructor(page: Page) {
    this.page = page
    this.board = this.page.getByTestId('project-board-view')
    this.viewModeButton = this.page.getByRole('button', { name: 'Status Board' })
    this.rerunButton = this.board.getByTestId('project-board-rerun')
  }

  /** Uploads a fixture file bundled with this extension's e2e tests, by its real filename. */
  async uploadFixture(fileName: string): Promise<void> {
    const fixturePath = fileURLToPath(new URL(`../fixtures/${fileName}`, import.meta.url))
    const uploadBtn = this.page.locator('#upload-menu-btn')
    const uploadInput = this.page.locator('#files-file-upload-input')
    const closeBtn = this.page.locator('#close-upload-bar-btn')
    await uploadBtn.click()
    await Promise.all([
      this.page.waitForResponse(
        (resp) =>
          [201, 204].includes(resp.status()) &&
          ['POST', 'PUT', 'PATCH'].includes(resp.request().method())
      ),
      uploadInput.setInputFiles(fixturePath)
    ])
    if (await closeBtn.isVisible()) {
      await closeBtn.click()
    }
  }

  /** Switches the current project space's file list to the "Status Board" view mode. */
  async switchToBoardView(): Promise<void> {
    await this.viewModeButton.click()
    await expect(this.board).toBeVisible()
    await expect(this.board.getByTestId('project-board-loading')).not.toBeVisible()
  }

  lane(lane: 'draft' | 'in-review' | 'final'): Locator {
    return this.board.getByTestId(`board-lane-${lane}`)
  }

  laneCard(lane: 'draft' | 'in-review' | 'final', fileName: string): Locator {
    return this.lane(lane).getByTestId('board-card').filter({ hasText: fileName })
  }

  async rerunClassification(): Promise<void> {
    await this.rerunButton.click()
    await expect(this.board.getByTestId('project-board-loading')).not.toBeVisible()
  }

  /**
   * Mocks the ai-llm-proxy chat-completions call with a fake but realistic classifier:
   * it reads the batched file listing out of the outgoing prompt and returns one
   * "<name>: <lane>" line per file it recognizes, exercising the extension's
   * non-JSON fallback line-parser rather than requiring real oCIS-issued file IDs.
   */
  async mockClassification(laneByFileName: Record<string, string>): Promise<void> {
    await this.page.route('**/ai-llm-proxy/**', async (route) => {
      const body = route.request().postDataJSON() as { messages?: { content?: string }[] }
      const prompt = body.messages?.[0]?.content ?? ''
      const lines = Object.entries(laneByFileName)
        .filter(([fileName]) => prompt.includes(fileName))
        .map(([fileName, lane]) => `${fileName}: ${lane}`)
        .join('\n')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: lines } }] })
      })
    })
  }
}
