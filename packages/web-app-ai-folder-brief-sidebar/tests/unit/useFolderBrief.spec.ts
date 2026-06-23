import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { defaultComponentMocks, getComposableWrapper } from '@ownclouders/web-test-helpers'

vi.mock('../../src/composables/useLlm', () => ({ useLlm: vi.fn() }))
vi.mock('@ownclouders/web-pkg', async () => {
  const actual = await vi.importActual<typeof import('@ownclouders/web-pkg')>('@ownclouders/web-pkg')
  return { ...actual, useSpacesStore: vi.fn(), useUserStore: vi.fn() }
})

import { useFolderBrief } from '../../src/composables/useFolderBrief'
import { useLlm } from '../../src/composables/useLlm'
import { useSpacesStore, useUserStore } from '@ownclouders/web-pkg'

const BASE_CONFIG = { endpoint: 'http://llm.local/v1', model: 'llama3.2' }
const RESOURCE = {
  id: 'f1',
  name: 'Project Alpha',
  storageId: 'space-1',
  path: '/Project Alpha',
  isFolder: true
}
const CHILDREN = [
  {
    id: 'c1',
    name: 'report.pdf',
    extension: 'pdf',
    mimeType: 'application/pdf',
    size: 102400,
    mdate: '2024-05-01T10:00:00Z',
    isFolder: false
  },
  {
    id: 'c2',
    name: 'data.csv',
    extension: 'csv',
    mimeType: 'text/csv',
    size: 2048,
    mdate: '2024-04-20T08:00:00Z',
    isFolder: false
  },
  {
    id: 'c3',
    name: 'assets',
    extension: '',
    mimeType: '',
    size: 0,
    mdate: '2024-03-10T12:00:00Z',
    isFolder: true
  }
]

function setupUseLlmMock(status = 'ready', cfg: unknown = BASE_CONFIG) {
  vi.mocked(useLlm).mockReturnValue({
    status: ref(status as any),
    config: ref(cfg as any),
    ensureReady: vi.fn().mockResolvedValue(undefined),
    buildHeaders: vi.fn().mockReturnValue({ 'Content-Type': 'application/json' })
  })
}

function makeFetch(body: unknown, ok = true, statusCode = 200) {
  return Promise.resolve({ ok, status: statusCode, json: async () => body })
}

function getWrapper(setup: (result: ReturnType<typeof useFolderBrief>) => void) {
  const mocks = { ...defaultComponentMocks() }
  mocks.$clientService.webdav.listFiles.mockResolvedValue({ resource: RESOURCE, children: CHILDREN })
  vi.mocked(useSpacesStore).mockReturnValue({ getSpace: vi.fn().mockReturnValue({ id: 'space-1' }) } as any)
  vi.mocked(useUserStore).mockReturnValue({ user: { preferredLanguage: 'en' } } as any)

  return getComposableWrapper(
    () => {
      const instance = useFolderBrief(BASE_CONFIG, ref(RESOURCE as any))
      setup(instance)
    },
    { mocks, provide: mocks }
  )
}

describe('useFolderBrief', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    setupUseLlmMock()
  })

  describe('triggerBrief when unconfigured and no llmConfig', () => {
    it('returns a static brief (isStatic: true) without calling fetch', async () => {
      setupUseLlmMock('unconfigured', null)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerBrief().then(() => {
            expect(fetchMock).not.toHaveBeenCalled()
            expect(instance.briefResult.value?.isStatic).toBe(true)
            expect(instance.briefResult.value?.summary).toBeTruthy()
            resolve()
          })
        })
      })
    })
  })

  describe('triggerBrief with LLM configured', () => {
    it('calls webdav.listFiles and then the LLM endpoint', async () => {
      const llmContent = JSON.stringify({
        summary: 'A project folder.',
        filesByType: 'PDFs and CSVs.',
        recentChanges: 'Report updated.'
      })
      vi.stubGlobal(
        'fetch',
        vi.fn().mockReturnValue(makeFetch({ choices: [{ message: { content: llmContent } }] }))
      )

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerBrief().then(() => {
            expect(instance.briefResult.value?.summary).toBe('A project folder.')
            expect(instance.briefResult.value?.filesByType).toBe('PDFs and CSVs.')
            expect(instance.briefResult.value?.isStatic).toBe(false)
            resolve()
          })
        })
      })
    })

    it('sets isLoading to true during fetch and false after', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockReturnValue(
            makeFetch({ choices: [{ message: { content: JSON.stringify({ summary: 'ok' }) } }] })
          )
      )

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          const trigger = instance.triggerBrief()
          expect(instance.isLoading.value).toBe(true)
          trigger.then(() => {
            expect(instance.isLoading.value).toBe(false)
            resolve()
          })
        })
      })
    })

    it('falls back to placing raw text in summary when LLM returns non-JSON', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockReturnValue(
            makeFetch({ choices: [{ message: { content: 'Plain text response.' } }] })
          )
      )

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerBrief().then(() => {
            expect(instance.briefResult.value?.summary).toBe('Plain text response.')
            expect(instance.briefResult.value?.filesByType).toBeUndefined()
            resolve()
          })
        })
      })
    })
  })

  describe('empty folder', () => {
    it('shows a static "folder is empty" brief without calling fetch', async () => {
      const mocks = { ...defaultComponentMocks() }
      mocks.$clientService.webdav.listFiles.mockResolvedValue({ resource: RESOURCE, children: [] })
      vi.mocked(useSpacesStore).mockReturnValue({
        getSpace: vi.fn().mockReturnValue({ id: 'space-1' })
      } as any)
      vi.mocked(useUserStore).mockReturnValue({ user: { preferredLanguage: 'en' } } as any)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      await new Promise<void>((resolve) => {
        getComposableWrapper(
          () => {
            const instance = useFolderBrief(BASE_CONFIG, ref(RESOURCE as any))
            instance.triggerBrief().then(() => {
              expect(fetchMock).not.toHaveBeenCalled()
              expect(instance.briefResult.value?.summary).toMatch(/empty/i)
              resolve()
            })
          },
          { mocks, provide: mocks }
        )
      })
    })
  })

  describe('error handling', () => {
    it('sets panelError on HTTP 401', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeFetch(null, false, 401)))

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerBrief().then(() => {
            expect(instance.panelError.value).toMatch(/denied|API key/i)
            resolve()
          })
        })
      })
    })

    it('sets panelError on network TypeError', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.triggerBrief().then(() => {
            expect(instance.panelError.value).toMatch(/network|connection/i)
            resolve()
          })
        })
      })
    })

    it('clears panelError on a subsequent successful call', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockReturnValueOnce(makeFetch(null, false, 500))
          .mockReturnValueOnce(
            makeFetch({ choices: [{ message: { content: JSON.stringify({ summary: 'ok' }) } }] })
          )
      )

      await new Promise<void>((resolve) => {
        getWrapper(async (instance) => {
          await instance.triggerBrief()
          expect(instance.panelError.value).not.toBeNull()
          await instance.triggerBrief()
          expect(instance.panelError.value).toBeNull()
          resolve()
        })
      })
    })
  })
})
