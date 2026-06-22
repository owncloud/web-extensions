import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { defaultComponentMocks, getComposableWrapper } from '@ownclouders/web-test-helpers'

vi.mock('../../src/composables/useLlm', () => ({ useLlm: vi.fn() }))
vi.mock('@ownclouders/web-pkg', async () => {
  const actual = await vi.importActual<typeof import('@ownclouders/web-pkg')>('@ownclouders/web-pkg')
  return { ...actual, useSpacesStore: vi.fn(), useAuthStore: vi.fn() }
})

import { useAltText } from '../../src/composables/useAltText'
import { useLlm } from '../../src/composables/useLlm'
import { useSpacesStore, useAuthStore } from '@ownclouders/web-pkg'

const BASE_CONFIG = { endpoint: 'http://llm.local/v1', model: 'llava' }
const RESOURCE = {
  id: 'f1',
  name: 'photo.jpg',
  extension: 'jpg',
  mimeType: 'image/jpeg',
  storageId: 'space-1',
  path: '/photo.jpg',
  size: 1024
}

function setupUseLlmMock(initialStatus = 'unconfigured', cfg: unknown = BASE_CONFIG) {
  const status = ref(initialStatus as any)
  vi.mocked(useLlm).mockReturnValue({
    status,
    config: ref(cfg as any),
    ensureReady: vi.fn().mockImplementation(async (probe?: () => Promise<boolean>) => {
      if (status.value !== 'unconfigured') return
      if (!cfg) return
      if (probe) {
        try {
          status.value = (await probe()) ? 'vision-ready' : 'text-only'
        } catch {
          // stay unconfigured
        }
      } else {
        status.value = 'vision-ready'
      }
    })
  })
  return status
}

function makeFetch(body: unknown, ok = true, statusCode = 200) {
  return Promise.resolve({ ok, status: statusCode, json: async () => body })
}

function makeMocks() {
  const mocks = { ...defaultComponentMocks() }
  mocks.$clientService.webdav.getFileContents.mockResolvedValue({
    response: { data: new ArrayBuffer(8) }
  })
  vi.mocked(useSpacesStore).mockReturnValue({ getSpace: vi.fn().mockReturnValue({ id: 'space-1' }) } as any)
  return mocks
}

function getWrapper(
  setup: (result: ReturnType<typeof useAltText>) => void,
  resource: typeof RESOURCE | { size: number } & typeof RESOURCE = RESOURCE
) {
  const mocks = makeMocks()
  return getComposableWrapper(() => {
    const instance = useAltText(BASE_CONFIG, ref(resource as any))
    setup(instance)
  }, { mocks, provide: mocks })
}

function getWrapperWithRef(
  setup: (result: ReturnType<typeof useAltText>) => void,
  resourceRef: ReturnType<typeof ref>,
  config = BASE_CONFIG
) {
  const mocks = makeMocks()
  return getComposableWrapper(() => {
    const instance = useAltText(config, resourceRef as any)
    setup(instance)
  }, { mocks, provide: mocks })
}

describe('useAltText', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    setupUseLlmMock('vision-ready')
    vi.mocked(useAuthStore).mockReturnValue({ accessToken: 'mock-oidc-token' } as any)
  })

  it('does not call fetch when status is text-only', async () => {
    setupUseLlmMock('text-only')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await new Promise<void>((resolve) => {
      getWrapper((instance) => {
        instance.triggerGenerate().then(() => {
          expect(fetchMock).not.toHaveBeenCalled()
          resolve()
        })
      })
    })
  })

  it('does not call fetch when status is unconfigured', async () => {
    setupUseLlmMock('unconfigured', null)

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await new Promise<void>((resolve) => {
      getWrapper((instance) => {
        instance.triggerGenerate().then(() => {
          expect(fetchMock).not.toHaveBeenCalled()
          resolve()
        })
      })
    })
  })

  it('sets panelError when image exceeds 4 MB', async () => {
    setupUseLlmMock('vision-ready')
    const largeResource = { ...RESOURCE, size: 5_000_000 }
    await new Promise<void>((resolve) => {
      getWrapper((instance) => {
        instance.triggerGenerate().then(() => {
          expect(instance.panelError.value).toMatch(/4 MB/i)
          resolve()
        })
      }, largeResource)
    })
  })

  it('calls LLM endpoint with multimodal content block on success', async () => {
    const fetchMock = vi.fn().mockReturnValue(
      makeFetch({ choices: [{ message: { content: 'Sunset over mountains.' } }] })
    )
    vi.stubGlobal('fetch', fetchMock)
    await new Promise<void>((resolve) => {
      getWrapper((instance) => {
        instance.triggerGenerate().then(() => {
          const body = JSON.parse(fetchMock.mock.calls[0][1].body)
          expect(body.messages[0].content).toBeInstanceOf(Array)
          expect(body.messages[0].content[1].type).toBe('image_url')
          expect(body.messages[0].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/)
          resolve()
        })
      })
    })
  })

  it('sets altText from LLM response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        makeFetch({ choices: [{ message: { content: 'A dog running on a beach.' } }] })
      )
    )
    await new Promise<void>((resolve) => {
      getWrapper((instance) => {
        instance.triggerGenerate().then(() => {
          expect(instance.altText.value).toBe('A dog running on a beach.')
          resolve()
        })
      })
    })
  })

  it('sets panelError on HTTP 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeFetch(null, false, 401)))
    await new Promise<void>((resolve) => {
      getWrapper((instance) => {
        instance.triggerGenerate().then(() => {
          expect(instance.panelError.value).toMatch(/denied|expired/i)
          resolve()
        })
      })
    })
  })

  it('sets panelError on network TypeError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await new Promise<void>((resolve) => {
      getWrapper((instance) => {
        instance.triggerGenerate().then(() => {
          expect(instance.panelError.value).toMatch(/network|connection/i)
          resolve()
        })
      })
    })
  })

  it('sets isGenerating true during fetch and false after', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        makeFetch({ choices: [{ message: { content: 'Some alt text.' } }] })
      )
    )
    await new Promise<void>((resolve) => {
      getWrapper((instance) => {
        const trigger = instance.triggerGenerate()
        expect(instance.isGenerating.value).toBe(true)
        trigger.then(() => {
          expect(instance.isGenerating.value).toBe(false)
          resolve()
        })
      })
    })
  })

  it('does not set altText when resource changes during generation', async () => {
    const resourceRef = ref({ ...RESOURCE, id: 'f1' } as any)
    let resolveFetch: () => void
    const fetchDone = new Promise<void>((r) => { resolveFetch = r })
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      await fetchDone
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'stale result' } }] }) }
    }))
    await new Promise<void>((done) => {
      getWrapperWithRef((instance) => {
        const trigger = instance.triggerGenerate()
        resourceRef.value = { ...RESOURCE, id: 'f2' }
        resolveFetch!()
        trigger.then(() => {
          expect(instance.altText.value).toBeNull()
          done()
        })
      }, resourceRef)
    })
  })

  it('does not set panelError when resource changes during generation', async () => {
    const resourceRef = ref({ ...RESOURCE, id: 'f1' } as any)
    let resolveFetch: () => void
    const fetchDone = new Promise<void>((r) => { resolveFetch = r })
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      await fetchDone
      return { ok: false, status: 500 }
    }))
    await new Promise<void>((done) => {
      getWrapperWithRef((instance) => {
        const trigger = instance.triggerGenerate()
        resourceRef.value = { ...RESOURCE, id: 'f2' }
        resolveFetch!()
        trigger.then(() => {
          expect(instance.panelError.value).toBeNull()
          done()
        })
      }, resourceRef)
    })
  })

  it('omits Authorization header when endpoint is cross-origin', async () => {
    const crossOriginConfig = { endpoint: 'https://external-llm.example.com/v1', model: 'llava' }
    setupUseLlmMock('vision-ready', crossOriginConfig)
    const fetchMock = vi.fn().mockReturnValue(
      makeFetch({ choices: [{ message: { content: 'text' } }] })
    )
    vi.stubGlobal('fetch', fetchMock)
    await new Promise<void>((resolve) => {
      getWrapperWithRef((instance) => {
        instance.triggerGenerate().then(() => {
          const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
          expect(headers['Authorization']).toBeUndefined()
          resolve()
        })
      }, ref(RESOURCE as any), crossOriginConfig)
    })
  })

  it('includes Authorization header when endpoint is same-origin', async () => {
    // Vitest's jsdom sets location.origin to http://localhost:3000
    const sameOriginConfig = { endpoint: 'http://localhost:3000/v1', model: 'llava' }
    setupUseLlmMock('vision-ready', sameOriginConfig)
    const fetchMock = vi.fn().mockReturnValue(
      makeFetch({ choices: [{ message: { content: 'text' } }] })
    )
    vi.stubGlobal('fetch', fetchMock)
    await new Promise<void>((resolve) => {
      getWrapperWithRef((instance) => {
        instance.triggerGenerate().then(() => {
          const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
          expect(headers['Authorization']).toMatch(/^Bearer /)
          resolve()
        })
      }, ref(RESOURCE as any), sameOriginConfig)
    })
  })

  it('reset() clears altText and panelError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(
      makeFetch({ choices: [{ message: { content: 'Some text.' } }] })
    ))
    await new Promise<void>((resolve) => {
      getWrapper((instance) => {
        instance.triggerGenerate().then(() => {
          expect(instance.altText.value).toBe('Some text.')
          instance.reset()
          expect(instance.altText.value).toBeNull()
          expect(instance.panelError.value).toBeNull()
          resolve()
        })
      })
    })
  })

  describe('vision probe (ensureReady)', () => {
    it('sets status to vision-ready when probe response is ok', async () => {
      setupUseLlmMock()
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
      await new Promise<void>((resolve) => {
        getWrapper(async (instance) => {
          await instance.ensureReady()
          expect(instance.status.value).toBe('vision-ready')
          resolve()
        })
      })
    })

    it('sets status to text-only when probe body signals no image support', async () => {
      setupUseLlmMock()
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: async () => ({ error: { message: 'model does not support image input' } })
        })
      )
      await new Promise<void>((resolve) => {
        getWrapper(async (instance) => {
          await instance.ensureReady()
          expect(instance.status.value).toBe('text-only')
          resolve()
        })
      })
    })

    it('stays unconfigured when probe throws a network error', async () => {
      setupUseLlmMock()
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
      await new Promise<void>((resolve) => {
        getWrapper(async (instance) => {
          await instance.ensureReady()
          expect(instance.status.value).toBe('unconfigured')
          resolve()
        })
      })
    })

    it('stays unconfigured when probe returns a non-vision HTTP error (e.g. 404)', async () => {
      setupUseLlmMock()
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' })
        })
      )
      await new Promise<void>((resolve) => {
        getWrapper(async (instance) => {
          await instance.ensureReady()
          expect(instance.status.value).toBe('unconfigured')
          resolve()
        })
      })
    })
  })
})
