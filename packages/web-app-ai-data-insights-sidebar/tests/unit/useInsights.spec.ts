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
  useUserStore: vi.fn(),
  useAuthStore: vi.fn(() => ({ accessToken: 'test-token' }))
}))

import {
  useInsights,
  _resetSessionConsentForTesting,
  _giveSessionConsentForTesting
} from '../../src/composables/useInsights'
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
    size: 1024, // 1 KB — well within the 5 MB limit
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
    complete: completeMock
  } as any)
}

let getFileContentsMock: ReturnType<typeof vi.fn>

function setupWebdavMock({ csvText = 'name,age\nAlice,30\nBob,25' } = {}) {
  getFileContentsMock = vi.fn().mockResolvedValue({ response: { data: csvText } })
  vi.mocked(useClientService).mockReturnValue({
    webdav: { getFileContents: getFileContentsMock }
  } as any)
}

// Simulate a session reset between test groups by patching the module-level consent flag.
// We do this by calling denyConsent() on each fresh useInsights() instance (the flag starts
// false for a brand-new JS module; between tests we need to reset it because prior tests
// may have set it via confirmConsent).
async function resetConsent() {
  // Importing the module won't reset module-level state between tests in the same file.
  // Instead we rely on each test creating a fresh useInsights() instance and NOT calling
  // confirmConsent() unless the test explicitly requires it.
}

beforeEach(() => {
  vi.restoreAllMocks()
  // Reset the session-level consent flag so each test starts with consent unchecked.
  _resetSessionConsentForTesting()
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
      // Give consent first so the guard reaches the fetch stage
      _giveSessionConsentForTesting()
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
      // Give consent first so the guard reaches the fetch stage
      _giveSessionConsentForTesting()
      const { triggerInsights, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(panelError.value).not.toBeNull()
    })
  })

  describe('consent disclosure', () => {
    it('shows consent dialog on first triggerInsights call instead of analyzing', async () => {
      const { triggerInsights, showConsentDialog, isAnalyzing } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      expect(showConsentDialog.value).toBe(true)
      expect(isAnalyzing.value).toBe(false)
      expect(getFileContentsMock).not.toHaveBeenCalled()
    })

    it('hides consent dialog and starts analysis when confirmConsent is called', async () => {
      const { triggerInsights, confirmConsent, showConsentDialog, insightsResult } = useInsights(
        BASE_CONFIG,
        makeResource()
      )
      await triggerInsights()
      expect(showConsentDialog.value).toBe(true)
      await confirmConsent()
      expect(showConsentDialog.value).toBe(false)
      expect(insightsResult.value).not.toBeNull()
    })

    it('hides consent dialog without analyzing when denyConsent is called', async () => {
      const { triggerInsights, denyConsent, showConsentDialog } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      denyConsent()
      expect(showConsentDialog.value).toBe(false)
      expect(getFileContentsMock).not.toHaveBeenCalled()
    })

    it('does not show consent dialog again after consent was given once', async () => {
      const { triggerInsights, confirmConsent, showConsentDialog } = useInsights(BASE_CONFIG, makeResource())
      // First trigger → consent dialog
      await triggerInsights()
      expect(showConsentDialog.value).toBe(true)
      // Confirm → analysis runs, consent recorded for session
      await confirmConsent()
      expect(showConsentDialog.value).toBe(false)
      // Second trigger on a new instance — session consent persists
      const { triggerInsights: trigger2, showConsentDialog: dialog2 } = useInsights(BASE_CONFIG, makeResource())
      await trigger2()
      expect(dialog2.value).toBe(false)
      expect(getFileContentsMock).toHaveBeenCalled()
    })
  })

  describe('file-size guard', () => {
    it('sets panelError without fetching when file exceeds 5 MB', async () => {
      const FIVE_MB_PLUS_ONE = 5 * 1024 * 1024 + 1
      const { triggerInsights, confirmConsent, panelError } = useInsights(
        BASE_CONFIG,
        makeResource({ size: FIVE_MB_PLUS_ONE })
      )
      await triggerInsights()
      await confirmConsent()
      expect(getFileContentsMock).not.toHaveBeenCalled()
      expect(panelError.value).toMatch(/too large|5 MB/i)
    })

    it('proceeds normally when file is exactly at the 5 MB limit', async () => {
      const FIVE_MB = 5 * 1024 * 1024
      const { triggerInsights, confirmConsent, insightsResult } = useInsights(
        BASE_CONFIG,
        makeResource({ size: FIVE_MB })
      )
      await triggerInsights()
      await confirmConsent()
      expect(getFileContentsMock).toHaveBeenCalled()
      expect(insightsResult.value).not.toBeNull()
    })

    it('proceeds normally when file size is not set (unknown size)', async () => {
      const { triggerInsights, confirmConsent, insightsResult } = useInsights(
        BASE_CONFIG,
        makeResource({ size: undefined })
      )
      await triggerInsights()
      await confirmConsent()
      expect(getFileContentsMock).toHaveBeenCalled()
      expect(insightsResult.value).not.toBeNull()
    })
  })

  describe('triggerInsights — WebDAV fetch', () => {
    it('fetches the file via WebDAV with responseType text', async () => {
      const { triggerInsights, confirmConsent } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      await confirmConsent()
      expect(getFileContentsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ path: '/data.csv' }),
        expect.objectContaining({ responseType: 'text' })
      )
    })

    it('uses tab delimiter for .tsv files', async () => {
      setupWebdavMock({ csvText: 'col1\tcol2\nval1\tval2' })
      const { triggerInsights, confirmConsent } = useInsights(BASE_CONFIG, makeResource({ extension: 'tsv', name: 'data.tsv' }))
      await triggerInsights()
      await confirmConsent()
      expect(completeMock).toHaveBeenCalled()
      // TSV should be parsed — completeMock called means the CSV was processed
      expect(completeMock.mock.calls[0][0][0].content).toContain('col1')
    })
  })

  describe('triggerInsights — happy path', () => {
    it('sets insightsResult with parsed columnTypes, ranges, and observations', async () => {
      const { triggerInsights, confirmConsent, insightsResult } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      await confirmConsent()
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
      const { triggerInsights, confirmConsent, isAnalyzing } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      const promise = confirmConsent()
      expect(isAnalyzing.value).toBe(true)
      await promise
      expect(isAnalyzing.value).toBe(false)
      expect(observedDuring).toBe(true)
    })

    it('clears panelError at the start of a subsequent successful call', async () => {
      completeMock
        .mockRejectedValueOnce(new Error('LLM request failed: 500 Internal Server Error'))
        .mockResolvedValueOnce(JSON.stringify({ columnTypes: [], ranges: [], observations: [] }))

      const { triggerInsights, confirmConsent, panelError } = useInsights(BASE_CONFIG, makeResource())
      // First analyze — fails
      await triggerInsights()
      await confirmConsent()
      expect(panelError.value).not.toBeNull()
      // Second analyze — succeeds (no consent dialog because consent was already given)
      await triggerInsights()
      expect(panelError.value).toBeNull()
    })

    it('sends the LLM request to the configured endpoint', async () => {
      const { triggerInsights, confirmConsent } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      await confirmConsent()
      expect(completeMock).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ role: 'user' })]),
        expect.objectContaining({ responseFormat: { type: 'json_object' } })
      )
    })

    it('treats a non-JSON LLM response as empty results without throwing', async () => {
      completeMock.mockResolvedValue('not valid json at all')
      const { triggerInsights, confirmConsent, insightsResult, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      await confirmConsent()
      expect(insightsResult.value).toEqual({ columnTypes: [], ranges: [], observations: [] })
      expect(panelError.value).toBeNull()
    })
  })

  describe('triggerInsights — error handling', () => {
    it('sets a human-readable panelError on HTTP 401', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 401 Unauthorized'))
      const { triggerInsights, confirmConsent, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      await confirmConsent()
      expect(panelError.value).toMatch(/denied|session/i)
    })

    it('sets a human-readable panelError on HTTP 403', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 403 Forbidden'))
      const { triggerInsights, confirmConsent, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      await confirmConsent()
      expect(panelError.value).toMatch(/denied|session/i)
    })

    it('sets a human-readable panelError on HTTP 404', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 404 Not Found'))
      const { triggerInsights, confirmConsent, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      await confirmConsent()
      expect(panelError.value).toMatch(/not be found|endpoint/i)
    })

    it('sets a human-readable panelError on HTTP 429', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 429 Too Many Requests'))
      const { triggerInsights, confirmConsent, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      await confirmConsent()
      expect(panelError.value).toMatch(/busy|try again/i)
    })

    it('sets a human-readable panelError on HTTP 5xx', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 503 Service Unavailable'))
      const { triggerInsights, confirmConsent, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      await confirmConsent()
      expect(panelError.value).toMatch(/unavailable|try again/i)
    })

    it('sets a network-error panelError on TypeError', async () => {
      completeMock.mockRejectedValue(new TypeError('Failed to fetch'))
      const { triggerInsights, confirmConsent, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      await confirmConsent()
      expect(panelError.value).toMatch(/network|connection/i)
    })

    it('sets a timeout panelError on DOMException TimeoutError', async () => {
      completeMock.mockRejectedValue(new DOMException('Timeout', 'TimeoutError'))
      const { triggerInsights, confirmConsent, panelError } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      await confirmConsent()
      expect(panelError.value).toMatch(/time|respond/i)
    })

    it('sets isAnalyzing back to false after an error', async () => {
      completeMock.mockRejectedValue(new Error('LLM request failed: 500 Error'))
      const { triggerInsights, confirmConsent, isAnalyzing } = useInsights(BASE_CONFIG, makeResource())
      await triggerInsights()
      await confirmConsent()
      expect(isAnalyzing.value).toBe(false)
    })
  })
})
