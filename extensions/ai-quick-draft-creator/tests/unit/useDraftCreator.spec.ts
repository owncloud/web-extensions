import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({ $gettext: (s: string) => s })
}))

vi.mock('../../src/composables/useLLM', () => ({
  useLLM: vi.fn()
}))

vi.mock('@ownclouders/web-pkg', () => ({
  useClientService: vi.fn(),
  useResourcesStore: vi.fn(),
  useSpacesStore: vi.fn(),
  useUserStore: vi.fn()
}))

vi.mock('@ownclouders/web-client', () => ({
  urlJoin: (...parts: string[]) => parts.filter(Boolean).join('/').replace(/\/+/g, '/')
}))

import { useDraftCreator } from '../../src/composables/useDraftCreator'
import { useLLM } from '../../src/composables/useLLM'
import { useClientService, useResourcesStore, useSpacesStore, useUserStore } from '@ownclouders/web-pkg'
import type { LLMConfig, LLMCapabilities } from '../../src/composables/useLLM'

const BASE_CONFIG: LLMConfig = {
  endpoint: 'http://localhost/ai/v1',
  model: 'test-model'
}

let putFileContentsMock: ReturnType<typeof vi.fn>
let completeMock: ReturnType<typeof vi.fn>

function setupMocks({
  caps = null as LLMCapabilities | null,
  canUpload = true,
  currentFolderPath = '/Documents',
  storageId = 'space-1',
  spaceFound = true
} = {}) {
  completeMock = vi.fn().mockResolvedValue('Generated document content')
  putFileContentsMock = vi.fn().mockResolvedValue({})

  vi.mocked(useLLM).mockReturnValue({
    capabilities: ref(caps),
    complete: completeMock,
    completeJSON: vi.fn(),
    stream: vi.fn()
  })

  vi.mocked(useClientService).mockReturnValue({
    webdav: { putFileContents: putFileContentsMock }
  } as ReturnType<typeof useClientService>)

  const mockSpace = spaceFound ? { id: storageId } : null
  vi.mocked(useSpacesStore).mockReturnValue({
    getSpace: vi.fn().mockReturnValue(mockSpace)
  } as ReturnType<typeof useSpacesStore>)

  vi.mocked(useUserStore).mockReturnValue({
    user: { id: 'user-1' }
  } as ReturnType<typeof useUserStore>)

  vi.mocked(useResourcesStore).mockReturnValue({
    currentFolder: {
      path: currentFolderPath,
      storageId,
      canUpload: () => canUpload
    }
  } as ReturnType<typeof useResourcesStore>)
}

describe('useDraftCreator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('canCreate()', () => {
    it('returns false when llmConfig is null', () => {
      setupMocks()
      const { canCreate } = useDraftCreator(null)
      expect(canCreate()).toBe(false)
    })

    it('returns false when current folder cannot be uploaded to', () => {
      setupMocks({ canUpload: false })
      const { canCreate } = useDraftCreator(BASE_CONFIG)
      expect(canCreate()).toBe(false)
    })

    it('returns true when configured and folder allows upload', () => {
      setupMocks({ canUpload: true })
      const { canCreate } = useDraftCreator(BASE_CONFIG)
      expect(canCreate()).toBe(true)
    })
  })

  describe('createDraft()', () => {
    it('returns null and sets error when llmConfig is null', async () => {
      setupMocks()
      const { createDraft, error } = useDraftCreator(null)
      const result = await createDraft('test description', 'markdown')
      expect(result).toBeNull()
      expect(error.value).toBeTruthy()
    })

    it('calls LLM complete and puts file contents on success', async () => {
      setupMocks()
      const { createDraft, error, creating } = useDraftCreator(BASE_CONFIG)
      const result = await createDraft('meeting notes for Q3 review', 'markdown')

      expect(completeMock).toHaveBeenCalledOnce()
      expect(putFileContentsMock).toHaveBeenCalledOnce()
      expect(result).toBeTruthy()
      expect(result).toMatch(/\.md$/)
      expect(error.value).toBeNull()
      expect(creating.value).toBe(false)
    })

    it('saves as plain text when format is plain', async () => {
      setupMocks()
      const { createDraft } = useDraftCreator(BASE_CONFIG)
      const result = await createDraft('incident report', 'plain')

      expect(putFileContentsMock).toHaveBeenCalledOnce()
      expect(result).toMatch(/\.txt$/)
    })

    it('uses rich (tier-1) prompt when toolUse capability is true', async () => {
      setupMocks({ caps: { toolUse: true, structuredOutput: false, contextTokens: 4096, streaming: false } })
      const { createDraft } = useDraftCreator(BASE_CONFIG)
      await createDraft('project brief for new feature', 'markdown')

      const callArgs = completeMock.mock.calls[0]
      const userMessage = callArgs[0].find((m: { role: string; content: string }) => m.role === 'user')
      expect(userMessage.content).toContain('placeholder')
    })

    it('uses simple (tier-2) prompt when capabilities are null (probe not done)', async () => {
      setupMocks({ caps: null })
      const { createDraft } = useDraftCreator(BASE_CONFIG)
      await createDraft('budget overview', 'markdown')

      const callArgs = completeMock.mock.calls[0]
      const userMessage = callArgs[0].find((m: { role: string; content: string }) => m.role === 'user')
      expect(userMessage.content).not.toContain('placeholder')
    })

    it('sets error and returns null when LLM throws', async () => {
      setupMocks()
      completeMock.mockRejectedValue(new Error('LLM request failed: 503 Service Unavailable'))
      const { createDraft, error } = useDraftCreator(BASE_CONFIG)
      const result = await createDraft('test', 'markdown')

      expect(result).toBeNull()
      expect(error.value).toContain('LLM request failed')
    })

    it('sets error when folder space cannot be resolved', async () => {
      setupMocks({ spaceFound: false })
      const { createDraft, error } = useDraftCreator(BASE_CONFIG)
      const result = await createDraft('test', 'markdown')

      expect(result).toBeNull()
      expect(error.value).toBeTruthy()
      expect(completeMock).not.toHaveBeenCalled()
    })

    it('puts file into the current folder path', async () => {
      setupMocks({ currentFolderPath: '/Projects/Alpha' })
      const { createDraft } = useDraftCreator(BASE_CONFIG)
      await createDraft('alpha roadmap', 'markdown')

      const callArgs = putFileContentsMock.mock.calls[0]
      expect(callArgs[1].path).toContain('/Projects/Alpha/')
    })
  })
})
