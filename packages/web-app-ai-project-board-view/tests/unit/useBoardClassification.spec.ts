import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Module-level mocks — hoisted by vitest before any import
vi.mock('../../src/composables/useLLM', () => ({ useLLM: vi.fn() }))
vi.mock('../../src/composables/useExcerpt', () => ({ useExcerpt: vi.fn() }))

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({ $gettext: (s: string) => s, current: 'en' })
}))

vi.mock('@ownclouders/web-pkg', () => ({
  useResourcesStore: vi.fn(),
  useUserStore: vi.fn()
}))

import { useBoardClassification } from '../../src/composables/useBoardClassification'
import { useLLM } from '../../src/composables/useLLM'
import { useExcerpt } from '../../src/composables/useExcerpt'
import { useResourcesStore, useUserStore } from '@ownclouders/web-pkg'
import type { LLMConfig, LLMStatus } from '../../src/composables/useLLM'
import type { Resource } from '@ownclouders/web-client'

const BASE_CONFIG: LLMConfig = {
  endpoint: 'http://localhost:3000/ai-llm-proxy',
  model: 'test-model'
}

function makeFile(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'f1',
    name: 'roadmap.md',
    isFolder: false,
    ...overrides
  } as Resource
}

let completeMock: ReturnType<typeof vi.fn>

function setupLLMMock({ status = 'ready' as LLMStatus, response = '' } = {}) {
  completeMock = vi.fn().mockResolvedValue(response)
  vi.mocked(useLLM).mockReturnValue({
    status: ref(status),
    complete: completeMock,
    stream: vi.fn()
  } as any)
}

let fetchExcerptMock: ReturnType<typeof vi.fn>

function setupExcerptMock(excerpt: string | undefined = undefined) {
  fetchExcerptMock = vi.fn().mockResolvedValue(excerpt)
  vi.mocked(useExcerpt).mockReturnValue({ fetchExcerpt: fetchExcerptMock } as any)
}

function setupResourcesStore(files: Resource[]) {
  vi.mocked(useResourcesStore).mockReturnValue({ activeResources: files } as any)
}

beforeEach(() => {
  vi.restoreAllMocks()
  setupLLMMock()
  setupExcerptMock()
  setupResourcesStore([makeFile()])
  vi.mocked(useUserStore).mockReturnValue({ user: { preferredLanguage: 'en' } } as any)
})

describe('useBoardClassification', () => {
  describe('happy-path JSON classification', () => {
    it('places files into the lane returned by the LLM', async () => {
      const files = [
        makeFile({ id: 'f1', name: 'draft-notes.md' }),
        makeFile({ id: 'f2', name: 'review-doc.md' }),
        makeFile({ id: 'f3', name: 'final-report.pdf' })
      ]
      setupResourcesStore(files)
      setupLLMMock({
        response: JSON.stringify({
          classifications: [
            { fileId: 'f1', lane: 'draft' },
            { fileId: 'f2', lane: 'in-review' },
            { fileId: 'f3', lane: 'final' }
          ]
        })
      })

      const { classify, lanes } = useBoardClassification(BASE_CONFIG)
      await classify()

      expect(lanes.value.draft.map((r) => r.id)).toEqual(['f1'])
      expect(lanes.value['in-review'].map((r) => r.id)).toEqual(['f2'])
      expect(lanes.value.final.map((r) => r.id)).toEqual(['f3'])
    })

    it('also accepts a bare JSON array response', async () => {
      setupResourcesStore([makeFile({ id: 'f1' })])
      setupLLMMock({ response: JSON.stringify([{ fileId: 'f1', lane: 'final' }]) })

      const { classify, lanes } = useBoardClassification(BASE_CONFIG)
      await classify()

      expect(lanes.value.final.map((r) => r.id)).toEqual(['f1'])
    })

    it('calls the LLM with a JSON response format request', async () => {
      setupLLMMock({ response: JSON.stringify({ classifications: [] }) })
      const { classify } = useBoardClassification(BASE_CONFIG)
      await classify()
      expect(completeMock).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ role: 'user' })]),
        expect.objectContaining({ responseFormat: { type: 'json_object' } })
      )
    })

    it('defaults an unmatched file to the draft lane', async () => {
      setupResourcesStore([makeFile({ id: 'f1' }), makeFile({ id: 'f2' })])
      setupLLMMock({ response: JSON.stringify({ classifications: [{ fileId: 'f1', lane: 'final' }] }) })

      const { classify, lanes } = useBoardClassification(BASE_CONFIG)
      await classify()

      expect(lanes.value.final.map((r) => r.id)).toEqual(['f1'])
      expect(lanes.value.draft.map((r) => r.id)).toEqual(['f2'])
    })

    it('sets isClassifying to true while in flight and false after', async () => {
      let observedDuring = false
      completeMock = vi.fn().mockImplementation(() => {
        observedDuring = true
        return Promise.resolve(JSON.stringify({ classifications: [] }))
      })
      vi.mocked(useLLM).mockReturnValue({ status: ref('ready' as LLMStatus), complete: completeMock, stream: vi.fn() } as any)

      const { classify, isClassifying } = useBoardClassification(BASE_CONFIG)
      const promise = classify()
      expect(isClassifying.value).toBe(true)
      await promise
      expect(isClassifying.value).toBe(false)
      expect(observedDuring).toBe(true)
    })
  })

  describe('malformed-JSON fallback to line parsing', () => {
    it('parses "<fileId>: <lane>" lines when the response is not JSON', async () => {
      setupResourcesStore([makeFile({ id: 'f1', name: 'roadmap.md' })])
      setupLLMMock({ response: 'f1: final' })

      const { classify, lanes } = useBoardClassification(BASE_CONFIG)
      await classify()

      expect(lanes.value.final.map((r) => r.id)).toEqual(['f1'])
    })

    it('falls back to matching by file name when fileId is not present in the text', async () => {
      setupResourcesStore([makeFile({ id: 'f1', name: 'roadmap.md' })])
      setupLLMMock({ response: 'roadmap.md: in review' })

      const { classify, lanes } = useBoardClassification(BASE_CONFIG)
      await classify()

      expect(lanes.value['in-review'].map((r) => r.id)).toEqual(['f1'])
    })

    it('does not throw when the response is unparseable garbage', async () => {
      setupResourcesStore([makeFile({ id: 'f1', name: 'roadmap.md' })])
      setupLLMMock({ response: 'not json and no colon lines here' })

      const { classify, lanes, panelError } = useBoardClassification(BASE_CONFIG)
      await classify()

      expect(panelError.value).toBeNull()
      expect(lanes.value.draft.map((r) => r.id)).toEqual(['f1'])
    })
  })

  describe('excerpt-omitted filename-only fallback', () => {
    it('omits the excerpt segment from the prompt line when fetchExcerpt returns undefined', async () => {
      setupExcerptMock(undefined)
      setupResourcesStore([makeFile({ id: 'f1', name: 'roadmap.md' })])
      setupLLMMock({ response: JSON.stringify({ classifications: [] }) })

      const { classify } = useBoardClassification(BASE_CONFIG)
      await classify()

      const prompt = completeMock.mock.calls[0][0][0].content as string
      expect(prompt).toContain('id: f1 | name: roadmap.md')
      expect(prompt).not.toContain('excerpt:')
    })

    it('includes the excerpt segment in the prompt line when fetchExcerpt returns text', async () => {
      setupExcerptMock('Q3 launch plan draft.')
      setupResourcesStore([makeFile({ id: 'f1', name: 'roadmap.md' })])
      setupLLMMock({ response: JSON.stringify({ classifications: [] }) })

      const { classify } = useBoardClassification(BASE_CONFIG)
      await classify()

      const prompt = completeMock.mock.calls[0][0][0].content as string
      expect(prompt).toContain('excerpt: Q3 launch plan draft.')
    })
  })

  describe('LLM error mapping to panelError', () => {
    it('maps HTTP 401/403 to an access-denied message', async () => {
      setupLLMMock({ status: 'ready' })
      completeMock.mockRejectedValue(new Error('LLM request failed: 401 Unauthorized'))
      const { classify, panelError } = useBoardClassification(BASE_CONFIG)
      await classify()
      expect(panelError.value).toMatch(/denied|session/i)
    })

    it('maps HTTP 404 to an endpoint-not-found message', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 404 Not Found'))
      const { classify, panelError } = useBoardClassification(BASE_CONFIG)
      await classify()
      expect(panelError.value).toMatch(/not be found|endpoint/i)
    })

    it('maps HTTP 429 to a busy message', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 429 Too Many Requests'))
      const { classify, panelError } = useBoardClassification(BASE_CONFIG)
      await classify()
      expect(panelError.value).toMatch(/busy|try again/i)
    })

    it('maps HTTP 5xx to an unavailable message', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 503 Service Unavailable'))
      const { classify, panelError } = useBoardClassification(BASE_CONFIG)
      await classify()
      expect(panelError.value).toMatch(/unavailable|try again/i)
    })

    it('maps a TypeError to a network-error message', async () => {
      completeMock.mockRejectedValue(new TypeError('Failed to fetch'))
      const { classify, panelError } = useBoardClassification(BASE_CONFIG)
      await classify()
      expect(panelError.value).toMatch(/network|connection/i)
    })

    it('maps a DOMException TimeoutError to a timeout message', async () => {
      completeMock.mockRejectedValue(new DOMException('Timeout', 'TimeoutError'))
      const { classify, panelError } = useBoardClassification(BASE_CONFIG)
      await classify()
      expect(panelError.value).toMatch(/time|respond/i)
    })

    it('sets isClassifying back to false after an error', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 500 Internal Server Error'))
      const { classify, isClassifying } = useBoardClassification(BASE_CONFIG)
      await classify()
      expect(isClassifying.value).toBe(false)
    })

    it('sets a cross-origin panelError without calling the LLM', async () => {
      setupLLMMock({ status: 'cross-origin' })
      const { classify, panelError } = useBoardClassification(BASE_CONFIG)
      await classify()
      expect(panelError.value).toMatch(/same server|cross-origin/i)
      expect(completeMock).not.toHaveBeenCalled()
    })

    it('defaults every file to draft without error when unconfigured', async () => {
      setupLLMMock({ status: 'unconfigured' })
      setupResourcesStore([makeFile({ id: 'f1' })])
      const { classify, panelError, lanes } = useBoardClassification(null)
      await classify()
      expect(panelError.value).toBeNull()
      expect(lanes.value.draft.map((r) => r.id)).toEqual(['f1'])
      expect(completeMock).not.toHaveBeenCalled()
    })
  })

  describe('empty folder state', () => {
    it('produces empty lanes and does not call the LLM when there are no files', async () => {
      setupResourcesStore([])
      const { classify, lanes, panelError } = useBoardClassification(BASE_CONFIG)
      await classify()

      expect(lanes.value).toEqual({ draft: [], 'in-review': [], final: [] })
      expect(panelError.value).toBeNull()
      expect(completeMock).not.toHaveBeenCalled()
    })

    it('excludes folders from the classified file set', async () => {
      setupResourcesStore([makeFile({ id: 'folder-1', isFolder: true }), makeFile({ id: 'f1' })])
      setupLLMMock({ response: JSON.stringify({ classifications: [] }) })

      const { classify, lanes } = useBoardClassification(BASE_CONFIG)
      await classify()

      const allIds = [...lanes.value.draft, ...lanes.value['in-review'], ...lanes.value.final].map(
        (r) => r.id
      )
      expect(allIds).toEqual(['f1'])
    })
  })
})
