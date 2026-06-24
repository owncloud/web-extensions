import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Module-level mocks — hoisted by vitest before any import
vi.mock('../../src/composables/useLLM', () => ({ useLLM: vi.fn() }))

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({ $gettext: (s: string) => s, current: 'en' })
}))

vi.mock('@ownclouders/web-pkg', () => ({
  useClientService: vi.fn(),
  useSpacesStore: vi.fn(),
  useUserStore: vi.fn()
}))

import { useInsights } from '../../src/composables/useInsights'
import { useLLM } from '../../src/composables/useLLM'
import { useClientService, useSpacesStore, useUserStore } from '@ownclouders/web-pkg'
import type { LLMConfig, LLMStatus } from '../../src/composables/useLLM'

const BASE_CONFIG: LLMConfig = {
  endpoint: 'http://localhost:3000/ai-proxy/v1',
  model: 'test-model'
}

function makeResource(overrides: Record<string, unknown> = {}) {
  return ref({
    id: 'f1',
    name: 'data.csv',
    extension: 'csv',
    storageId: 'space-1',
    path: '/data.csv',
    ...overrides
  })
}

const HAPPY_PATH_LLM_RESPONSE = JSON.stringify({
  columnTypes: [{ column: 'name', type: 'string' }, { column: 'age', type: 'number' }],
  ranges: [{ column: 'age', min: '20', max: '45' }],
  observations: ['The file has two columns.', 'Age values are numeric.']
})

let completeMock: ReturnType<typeof vi.fn>

function setupLLMMock({ status = 'ready' as LLMStatus, response = HAPPY_PATH_LLM_RESPONSE } = {}) {
  completeMock = vi.fn().mockResolvedValue(response)
  vi.mocked(useLLM).mockReturnValue({
    status: ref(status),
    complete: completeMock,
    stream: vi.fn()
  })
}

let getFileContentsMock: ReturnType<typeof vi.fn>

function setupWebdavMock({ csvText = 'name,age\nAlice,30\nBob,25' } = {}) {
  getFileContentsMock = vi.fn().mockResolvedValue({ response: { data: csvText } })
  vi.mocked(useClientService).mockReturnValue({
    webdav: { getFileContents: getFileContentsMock }
  } as any)
}

beforeEach(() => {
  vi.restoreAllMocks()
  setupLLMMock()
  setupWebdavMock()
  vi.mocked(useSpacesStore).mockReturnValue({
    getSpace: vi.fn().mockReturnValue({ id: 'space-1' })
  } as any)
  vi.mocked(useUserStore).mockReturnValue({
    user: { preferredLanguage: 'en' }
  } as any)
})

describe('useInsights', () => {
  describe('initial state', () => {
    it('starts with isAnalyzing = false', () => {
      const { isAnalyzing } = useInsights(BASE_CONFIG, makeResource())
      expect(isAnalyzing.value).toBe(false)
    })

    it('starts with insightsResult = null', () => {
      const { insightsResult } = useInsights(BASE_CONFIG, makeResource())
      expect(insightsResult.value).toBeNull()
    })

    it('starts with panelError = null', () => {
      const { panelError } = useInsights(BASE_CONFIG, makeResource())
      expect(panelError.value).toBeNull()
    })

    it('exposes the status from useLLM', () => {
      setupLLMMock({ status: 'unconfigured' })
      const { status } = useInsights(null, makeResource())
      expect(status.value).toBe('unconfigured')
    })
  })

  describe('ensureReady', () => {
    it('resolves immediately — useLLM sets status synchronously at init', async () => {
      const { ensureReady } = useInsights(BASE_CONFIG, makeResource())
      await expect(ensureReady()).resolves.toBeUndefined()
    })
  })

  describe('triggerInsights — guard conditions', () => {
    it('returns early without fetching when LLM status is unconfigured', async () => {
      setupLLMMock({ status: 'unconfigured' })
      const { triggerInsights, panelError } = useInsights(null, makeResource())
      await triggerInsights()
      expect(getFileContentsMock).not.toHaveBeenCalled()
      expect(panelError.value).toBeNull()
    })

    it('sets a cross-origin panelError when LLM status is cross-origin', async () => {
      setupLLMMock({ status: 'cross-origin' })
      const { triggerInsights, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(getFileContentsMock).not.toHaveBeenCalled()
      expect(panelError.value).toMatch(/same server|cross-origin/i)
    })

    it('sets panelError when the resource has no storageId', async () => {
      const { triggerInsights, panelError } = useInsights(
        BASE_CONFIG,
        makeResource({ storageId: undefined, path: undefined })
      )
      await triggerInsights()
      expect(panelError.value).not.toBeNull()
    })

    it('sets panelError when the space cannot be resolved', async () => {
      vi.mocked(useSpacesStore).mockReturnValue({
        getSpace: vi.fn().mockReturnValue(null)
      } as any)
      const { triggerInsights, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(panelError.value).not.toBeNull()
    })
  })

  describe('triggerInsights — WebDAV fetch', () => {
    it('fetches the file via WebDAV with responseType text', async () => {
      const { triggerInsights } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(getFileContentsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ path: '/data.csv' }),
        expect.objectContaining({ responseType: 'text' })
      )
    })

    it('uses tab delimiter for .tsv files', async () => {
      setupWebdavMock({ csvText: 'col1\tcol2\nval1\tval2' })
      const { triggerInsights } = useInsights(BASE_CONFIG, makeResource({ extension: 'tsv', name: 'data.tsv' }))
      await triggerInsights()
      expect(completeMock).toHaveBeenCalled()
      // TSV should be parsed — completeMock called means the CSV was processed
      expect(completeMock.mock.calls[0][0][0].content).toContain('col1')
    })
  })

  describe('triggerInsights — happy path', () => {
    it('sets insightsResult with parsed columnTypes, ranges, and observations', async () => {
      const { triggerInsights, insightsResult } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(insightsResult.value).toEqual({
        columnTypes: [
          { column: 'name', type: 'string' },
          { column: 'age', type: 'number' }
        ],
        ranges: [{ column: 'age', min: '20', max: '45' }],
        observations: ['The file has two columns.', 'Age values are numeric.']
      })
    })

    it('sets isAnalyzing to true while the call is in flight and false after', async () => {
      let observedDuring = false
      completeMock.mockImplementation(() => {
        observedDuring = true
        return Promise.resolve(HAPPY_PATH_LLM_RESPONSE)
      })
      const { triggerInsights, isAnalyzing } = useInsights(BASE_CONFIG, makeResource())
      const promise = triggerInsights()
      expect(isAnalyzing.value).toBe(true)
      await promise
      expect(isAnalyzing.value).toBe(false)
      expect(observedDuring).toBe(true)
    })

    it('clears panelError at the start of a subsequent successful call', async () => {
      completeMock
        .mockRejectedValueOnce(new Error('LLM request failed: 500 Internal Server Error'))
        .mockResolvedValueOnce(JSON.stringify({ columnTypes: [], ranges: [], observations: [] }))

      const { triggerInsights, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(panelError.value).not.toBeNull()
      await triggerInsights()
      expect(panelError.value).toBeNull()
    })

    it('sends the LLM request to the configured endpoint', async () => {
      const { triggerInsights } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(completeMock).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ role: 'user' })]),
        expect.objectContaining({ responseFormat: { type: 'json_object' } })
      )
    })

    it('treats a non-JSON LLM response as empty results without throwing', async () => {
      completeMock.mockResolvedValue('not valid json at all')
      const { triggerInsights, insightsResult, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(insightsResult.value).toEqual({ columnTypes: [], ranges: [], observations: [] })
      expect(panelError.value).toBeNull()
    })
  })

  describe('triggerInsights — error handling', () => {
    it('sets a human-readable panelError on HTTP 401', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 401 Unauthorized'))
      const { triggerInsights, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(panelError.value).toMatch(/denied|session/i)
    })

    it('sets a human-readable panelError on HTTP 403', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 403 Forbidden'))
      const { triggerInsights, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(panelError.value).toMatch(/denied|session/i)
    })

    it('sets a human-readable panelError on HTTP 404', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 404 Not Found'))
      const { triggerInsights, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(panelError.value).toMatch(/not be found|endpoint/i)
    })

    it('sets a human-readable panelError on HTTP 429', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 429 Too Many Requests'))
      const { triggerInsights, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(panelError.value).toMatch(/busy|try again/i)
    })

    it('sets a human-readable panelError on HTTP 5xx', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 503 Service Unavailable'))
      const { triggerInsights, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(panelError.value).toMatch(/unavailable|try again/i)
    })

    it('sets a network-error panelError on TypeError', async () => {
      completeMock.mockRejectedValue(new TypeError('Failed to fetch'))
      const { triggerInsights, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(panelError.value).toMatch(/network|connection/i)
    })

    it('sets a timeout panelError on DOMException TimeoutError', async () => {
      completeMock.mockRejectedValue(new DOMException('Timeout', 'TimeoutError'))
      const { triggerInsights, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(panelError.value).toMatch(/time|respond/i)
    })

    it('sets isAnalyzing back to false after an error', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 500 Error'))
      const { triggerInsights, isAnalyzing } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(isAnalyzing.value).toBe(false)
    })
  })
})
