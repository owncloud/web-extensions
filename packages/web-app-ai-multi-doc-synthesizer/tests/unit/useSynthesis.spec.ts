import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Mock external composables before importing the module under test.
vi.mock('@ownclouders/web-pkg', () => ({
  useClientService: vi.fn(),
  useSpacesStore: vi.fn()
}))

vi.mock('vue3-gettext', () => ({
  useGettext: vi.fn(() => ({ $gettext: (s: string) => s }))
}))

vi.mock('../../src/composables/useLLM', () => ({
  useLLM: vi.fn()
}))

import { useSynthesis } from '../../src/composables/useSynthesis'
import type { SynthesisResource } from '../../src/composables/useSynthesis'
import { useLLM } from '../../src/composables/useLLM'
import { useClientService, useSpacesStore } from '@ownclouders/web-pkg'

const BASE_CONFIG = { endpoint: 'http://llm.local/v1', model: 'test-model' }
const MOCK_SPACE = { id: 'space-1' }

const SYNTHESIS_RESPONSE = {
  themes: ['Theme A', 'Theme B'],
  differences: ['Diff A'],
  actionItems: ['Action A']
}

function makeResources(count = 2): SynthesisResource[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `file-${i}`,
    name: `doc${i}.txt`,
    extension: 'txt',
    storageId: 'space-1',
    path: `/doc${i}.txt`
  }))
}

function setupMocks({
  fileContent = 'File content.',
  llmResponse = JSON.stringify(SYNTHESIS_RESPONSE),
  caps = null as { structuredOutput: boolean; toolUse: boolean; contextTokens: number; streaming: boolean } | null,
  putFileOk = true
} = {}) {
  const getFileContentsMock = vi.fn().mockResolvedValue({
    response: { data: fileContent }
  })
  const putFileContentsMock = putFileOk
    ? vi.fn().mockResolvedValue(undefined)
    : vi.fn().mockRejectedValue(new Error('Put failed'))

  vi.mocked(useClientService).mockReturnValue({
    webdav: {
      getFileContents: getFileContentsMock,
      putFileContents: putFileContentsMock
    }
  } as ReturnType<typeof useClientService>)

  vi.mocked(useSpacesStore).mockReturnValue({
    getSpace: vi.fn().mockReturnValue(MOCK_SPACE)
  } as ReturnType<typeof useSpacesStore>)

  const completeMock = vi.fn().mockResolvedValue(llmResponse)
  const completeJSONMock = vi.fn().mockResolvedValue(SYNTHESIS_RESPONSE)

  vi.mocked(useLLM).mockReturnValue({
    capabilities: ref(caps),
    complete: completeMock,
    completeJSON: completeJSONMock,
    stream: vi.fn()
  })

  return { getFileContentsMock, putFileContentsMock, completeMock, completeJSONMock }
}

describe('useSynthesis', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('when unconfigured (llmConfig is null)', () => {
    it('triggerSynthesis returns immediately without calling useLLM', async () => {
      setupMocks()
      const resources = ref<SynthesisResource[]>(makeResources())
      const { triggerSynthesis, synthesisResult } = useSynthesis(null, resources)

      await triggerSynthesis()

      expect(vi.mocked(useLLM)).not.toHaveBeenCalled()
      expect(synthesisResult.value).toBeNull()
    })

    it('synthesisResult stays null and no error is set', async () => {
      setupMocks()
      const resources = ref<SynthesisResource[]>(makeResources())
      const { triggerSynthesis, synthesisResult, panelError } = useSynthesis(null, resources)

      await triggerSynthesis()

      expect(synthesisResult.value).toBeNull()
      expect(panelError.value).toBeNull()
    })
  })

  describe('when configured', () => {
    it('creates a useLLM instance with the provided config', () => {
      setupMocks()
      const resources = ref<SynthesisResource[]>(makeResources())
      useSynthesis(BASE_CONFIG, resources)
      expect(vi.mocked(useLLM)).toHaveBeenCalledWith(BASE_CONFIG)
    })

    it('fetches content for every resource', async () => {
      const { getFileContentsMock } = setupMocks()
      const resources = ref<SynthesisResource[]>(makeResources(3))
      const { triggerSynthesis } = useSynthesis(BASE_CONFIG, resources)

      await triggerSynthesis()

      expect(getFileContentsMock).toHaveBeenCalledTimes(3)
    })

    it('sets isSynthesizing to true during synthesis and false after', async () => {
      let observedDuring = false
      const getFileContentsMock = vi.fn().mockImplementation(() => {
        observedDuring = true
        return Promise.resolve({ response: { data: 'content' } })
      })
      vi.mocked(useClientService).mockReturnValue({
        webdav: { getFileContents: getFileContentsMock, putFileContents: vi.fn() }
      } as ReturnType<typeof useClientService>)
      vi.mocked(useSpacesStore).mockReturnValue({
        getSpace: vi.fn().mockReturnValue(MOCK_SPACE)
      } as ReturnType<typeof useSpacesStore>)
      vi.mocked(useLLM).mockReturnValue({
        capabilities: ref(null),
        complete: vi.fn().mockResolvedValue('ok'),
        completeJSON: vi.fn().mockResolvedValue(SYNTHESIS_RESPONSE),
        stream: vi.fn()
      })

      const resources = ref<SynthesisResource[]>(makeResources())
      const { triggerSynthesis, isSynthesizing } = useSynthesis(BASE_CONFIG, resources)

      const promise = triggerSynthesis()
      expect(isSynthesizing.value).toBe(true)
      await promise
      expect(isSynthesizing.value).toBe(false)
      expect(observedDuring).toBe(true)
    })
  })

  describe('tier selection', () => {
    it('uses two-pass when capabilities are null (unknown context)', async () => {
      const { completeJSONMock, completeMock } = setupMocks({ caps: null })
      const resources = ref<SynthesisResource[]>(makeResources(2))
      const { triggerSynthesis } = useSynthesis(BASE_CONFIG, resources)

      await triggerSynthesis()

      // Two-pass: complete() for summaries, completeJSON() for final merge
      expect(completeMock).toHaveBeenCalled()
      expect(completeJSONMock).toHaveBeenCalled()
    })

    it('uses single-pass when context is large enough for all content', async () => {
      const largeCaps = {
        structuredOutput: true,
        toolUse: false,
        contextTokens: 128_000,
        streaming: false
      }
      const { completeJSONMock, completeMock } = setupMocks({
        caps: largeCaps,
        fileContent: 'Short.'
      })
      const resources = ref<SynthesisResource[]>(makeResources(2))
      const { triggerSynthesis } = useSynthesis(BASE_CONFIG, resources)

      await triggerSynthesis()

      // Single-pass: only completeJSON, no intermediate complete() for summaries
      expect(completeJSONMock).toHaveBeenCalledTimes(1)
      expect(completeMock).not.toHaveBeenCalled()
    })

    it('uses two-pass when context is too small for all content', async () => {
      const smallCaps = {
        structuredOutput: false,
        toolUse: false,
        contextTokens: 100, // tiny; guaranteed too small
        streaming: false
      }
      const { completeJSONMock, completeMock } = setupMocks({ caps: smallCaps })
      const resources = ref<SynthesisResource[]>(makeResources(2))
      const { triggerSynthesis } = useSynthesis(BASE_CONFIG, resources)

      await triggerSynthesis()

      // Two-pass: complete() per file + completeJSON() for merge
      expect(completeMock).toHaveBeenCalled()
      expect(completeJSONMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('result parsing', () => {
    it('populates synthesisResult with themes, differences, and actionItems', async () => {
      setupMocks()
      const resources = ref<SynthesisResource[]>(makeResources())
      const { triggerSynthesis, synthesisResult } = useSynthesis(BASE_CONFIG, resources)

      await triggerSynthesis()

      expect(synthesisResult.value).toEqual(SYNTHESIS_RESPONSE)
    })

    it('clears panelError on a successful synthesis after an error', async () => {
      const completeJSONMock = vi
        .fn()
        .mockRejectedValueOnce(new Error('AI error'))
        .mockResolvedValueOnce(SYNTHESIS_RESPONSE)
      vi.mocked(useClientService).mockReturnValue({
        webdav: {
          getFileContents: vi.fn().mockResolvedValue({ response: { data: 'text' } }),
          putFileContents: vi.fn()
        }
      } as ReturnType<typeof useClientService>)
      vi.mocked(useSpacesStore).mockReturnValue({
        getSpace: vi.fn().mockReturnValue(MOCK_SPACE)
      } as ReturnType<typeof useSpacesStore>)
      vi.mocked(useLLM).mockReturnValue({
        capabilities: ref({ structuredOutput: true, toolUse: false, contextTokens: 128_000, streaming: false }),
        complete: vi.fn(),
        completeJSON: completeJSONMock,
        stream: vi.fn()
      })

      const resources = ref<SynthesisResource[]>(makeResources())
      const { triggerSynthesis, panelError } = useSynthesis(BASE_CONFIG, resources)

      await triggerSynthesis()
      expect(panelError.value).not.toBeNull()

      await triggerSynthesis()
      expect(panelError.value).toBeNull()
    })
  })

  describe('error handling', () => {
    it('sets panelError when a resource has no storageId', async () => {
      setupMocks()
      const badResources = ref<SynthesisResource[]>([
        { id: 'f1', name: 'a.txt', extension: 'txt' },
        { id: 'f2', name: 'b.txt', extension: 'txt' }
      ])
      const { triggerSynthesis, panelError } = useSynthesis(BASE_CONFIG, badResources)

      await triggerSynthesis()

      expect(panelError.value).toContain('available')
    })

    it('sets panelError on TypeError (network failure)', async () => {
      vi.mocked(useClientService).mockReturnValue({
        webdav: {
          getFileContents: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
          putFileContents: vi.fn()
        }
      } as ReturnType<typeof useClientService>)
      vi.mocked(useSpacesStore).mockReturnValue({
        getSpace: vi.fn().mockReturnValue(MOCK_SPACE)
      } as ReturnType<typeof useSpacesStore>)
      vi.mocked(useLLM).mockReturnValue({
        capabilities: ref(null),
        complete: vi.fn(),
        completeJSON: vi.fn(),
        stream: vi.fn()
      })

      const resources = ref<SynthesisResource[]>(makeResources())
      const { triggerSynthesis, panelError } = useSynthesis(BASE_CONFIG, resources)

      await triggerSynthesis()

      expect(panelError.value).toMatch(/network|connection/i)
    })
  })

  describe('saveAsMarkdown', () => {
    it('writes a markdown file at the correct path', async () => {
      const { putFileContentsMock } = setupMocks()
      const resources = ref<SynthesisResource[]>(makeResources())
      const { triggerSynthesis, saveAsMarkdown } = useSynthesis(BASE_CONFIG, resources)

      await triggerSynthesis()
      const savedPath = await saveAsMarkdown()

      expect(putFileContentsMock).toHaveBeenCalledOnce()
      expect(savedPath).toMatch(/synthesis-\d{4}-\d{2}-\d{2}\.md$/)
    })

    it('saved markdown content includes all result sections', async () => {
      const { putFileContentsMock } = setupMocks()
      const resources = ref<SynthesisResource[]>(makeResources())
      const { triggerSynthesis, saveAsMarkdown } = useSynthesis(BASE_CONFIG, resources)

      await triggerSynthesis()
      await saveAsMarkdown()

      const [, saveOpts] = putFileContentsMock.mock.calls[0] as [
        unknown,
        { path: string; content: string }
      ]
      expect(saveOpts.content).toContain('## Shared Themes')
      expect(saveOpts.content).toContain('## Key Differences')
      expect(saveOpts.content).toContain('## Action Items')
      expect(saveOpts.content).toContain('Theme A')
    })

    it('throws when there is no synthesis result yet', async () => {
      setupMocks()
      const resources = ref<SynthesisResource[]>(makeResources())
      const { saveAsMarkdown } = useSynthesis(BASE_CONFIG, resources)

      await expect(saveAsMarkdown()).rejects.toThrow()
    })
  })
})
