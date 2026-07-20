import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { defaultComponentMocks, getComposableWrapper } from '@ownclouders/web-test-helpers'

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn()
}))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs', () => ({}))

vi.mock('../../src/composables/useLlm', () => ({
  useLlm: vi.fn()
}))

vi.mock('@ownclouders/web-pkg', async () => {
  const actual = await vi.importActual<typeof import('@ownclouders/web-pkg')>('@ownclouders/web-pkg')
  return { ...actual, useSpacesStore: vi.fn() }
})

import { useSummary } from '../../src/composables/useSummary'
import { useLlm } from '../../src/composables/useLlm'
import { useSpacesStore } from '@ownclouders/web-pkg'

const BASE_CONFIG = { endpoint: 'http://llm.local/v1', model: 'test-model' }

function setupUseLlmMock({
  status = 'ready',
  config = BASE_CONFIG as typeof BASE_CONFIG | null
} = {}) {
  vi.mocked(useLlm).mockReturnValue({
    status: ref(status as any),
    config: ref(config),
    ensureReady: vi.fn().mockResolvedValue(undefined)
  })
}

function makeFetchResponse(body: unknown, ok = true, statusCode = 200) {
  return Promise.resolve({
    ok,
    status: statusCode,
    json: async () => body
  })
}

function getWrapper(
  setup: (result: ReturnType<typeof useSummary>) => void,
  {
    resource = { id: 'f1', name: 'doc.txt', extension: 'txt', storageId: 'space-1', path: '/doc.txt' }
  } = {}
) {
  const mocks = { ...defaultComponentMocks() }
  mocks.$clientService.webdav.getFileContents.mockResolvedValue({
    response: { data: 'Document content here.' }
  } as any)

  const mockSpace = { id: 'space-1' }
  vi.mocked(useSpacesStore).mockReturnValue({
    getSpace: vi.fn().mockReturnValue(mockSpace)
  } as any)

  return getComposableWrapper(
    () => {
      const resourceRef = ref(resource as any)
      const instance = useSummary(BASE_CONFIG, resourceRef)
      setup(instance)
    },
    { mocks, provide: mocks }
  )
}

describe('useSummary', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    setupUseLlmMock()
  })

  describe('triggerSummary when unconfigured', () => {
    it('returns immediately without calling fetch', async () => {
      setupUseLlmMock({ status: 'unconfigured', config: null })
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerSummary().then(() => {
            expect(fetchMock).not.toHaveBeenCalled()
            expect(instance.summaryResult.value).toBeNull()
            resolve()
          })
        })
      })
    })

    it('does not set panelError', async () => {
      setupUseLlmMock({ status: 'unconfigured', config: null })
      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerSummary().then(() => {
            expect(instance.panelError.value).toBeNull()
            resolve()
          })
        })
      })
    })
  })

  describe('triggerSummary with a text file', () => {
    it('calls the LLM /chat/completions endpoint with the file content', async () => {
      const fetchMock = vi.fn().mockReturnValue(
        makeFetchResponse({
          choices: [{ message: { content: JSON.stringify({ overview: 'A summary.', keyPoints: ['Point A'] }) } }]
        })
      )
      vi.stubGlobal('fetch', fetchMock)

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerSummary().then(() => {
            expect(fetchMock).toHaveBeenCalledWith(
              'http://llm.local/v1/chat/completions',
              expect.objectContaining({ method: 'POST' })
            )
            resolve()
          })
        })
      })
    })

    it('sets summaryResult with parsed overview and keyPoints', async () => {
      const llmContent = JSON.stringify({
        overview: 'Revenue grew in Q4.',
        keyPoints: ['Revenue +20%', 'Costs -8%']
      })
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: llmContent } }] })
      ))

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerSummary().then(() => {
            expect(instance.summaryResult.value).toEqual({
              overview: 'Revenue grew in Q4.',
              keyPoints: ['Revenue +20%', 'Costs -8%']
            })
            resolve()
          })
        })
      })
    })

    it('sets isGenerating to true during fetch and false after', async () => {
      let observedDuring = false
      const fetchMock = vi.fn().mockImplementation(() => {
        observedDuring = true
        return makeFetchResponse({
          choices: [{ message: { content: JSON.stringify({ overview: 'ok', keyPoints: [] }) } }]
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          const trigger = instance.triggerSummary()
          // isGenerating should be true while fetch is in flight
          // (fetchMock hasn't resolved yet at this point since promises are micro-tasks)
          expect(instance.isGenerating.value).toBe(true)
          trigger.then(() => {
            expect(instance.isGenerating.value).toBe(false)
            expect(observedDuring).toBe(true)
            resolve()
          })
        })
      })
    })
  })

  describe('LLM response parsing', () => {
    it('returns empty overview and keyPoints when response content is not valid JSON', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: 'Not a JSON string at all.' } }] })
      ))

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerSummary().then(() => {
            expect(instance.summaryResult.value).toEqual({ overview: '', keyPoints: [] })
            resolve()
          })
        })
      })
    })

    it('strips leading list markers from keyPoints', async () => {
      const content = JSON.stringify({
        overview: 'Overview.',
        keyPoints: ['> Revenue grew', '| Costs fell']
      })
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content } }] })
      ))

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerSummary().then(() => {
            expect(instance.summaryResult.value?.keyPoints).toEqual(['Revenue grew', 'Costs fell'])
            resolve()
          })
        })
      })
    })

    it('treats a non-array keyPoints field as an empty array', async () => {
      const content = JSON.stringify({ overview: 'Overview.', keyPoints: 'not an array' })
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content } }] })
      ))

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerSummary().then(() => {
            expect(instance.summaryResult.value?.keyPoints).toEqual([])
            resolve()
          })
        })
      })
    })
  })

  describe('error handling', () => {
    it('sets a human-readable panelError on HTTP 401', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeFetchResponse(null, false, 401)))

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerSummary().then(() => {
            expect(instance.panelError.value).toMatch(/denied|API key/i)
            expect(instance.summaryResult.value).toBeNull()
            resolve()
          })
        })
      })
    })

    it('sets a human-readable panelError on HTTP 404', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeFetchResponse(null, false, 404)))

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerSummary().then(() => {
            expect(instance.panelError.value).toMatch(/not be found|endpoint/i)
            resolve()
          })
        })
      })
    })

    it('sets a human-readable panelError on HTTP 429', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeFetchResponse(null, false, 429)))

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerSummary().then(() => {
            expect(instance.panelError.value).toMatch(/busy|try again/i)
            resolve()
          })
        })
      })
    })

    it('sets a panelError on network TypeError (no connection)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerSummary().then(() => {
            expect(instance.panelError.value).toMatch(/network|connection/i)
            resolve()
          })
        })
      })
    })

    it('clears panelError on a subsequent successful call', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockReturnValueOnce(makeFetchResponse(null, false, 500))
        .mockReturnValueOnce(makeFetchResponse({
          choices: [{ message: { content: JSON.stringify({ overview: 'ok', keyPoints: [] }) } }]
        }))
      )

      await new Promise<void>((resolve) => {
        getWrapper(async (instance) => {
          await instance.triggerSummary()
          expect(instance.panelError.value).not.toBeNull()
          await instance.triggerSummary()
          expect(instance.panelError.value).toBeNull()
          resolve()
        })
      })
    })
  })
})
