import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { defaultComponentMocks, getComposableWrapper } from '@ownclouders/web-test-helpers'

vi.mock('../../src/composables/useLlm', () => ({ useLlm: vi.fn() }))
vi.mock('@ownclouders/web-pkg', async () => {
  const actual = await vi.importActual<typeof import('@ownclouders/web-pkg')>('@ownclouders/web-pkg')
  return { ...actual, useSpacesStore: vi.fn() }
})

import { useAltText } from '../../src/composables/useAltText'
import { useLlm } from '../../src/composables/useLlm'
import { useSpacesStore } from '@ownclouders/web-pkg'

const BASE_CONFIG = { endpoint: 'http://llm.local/v1', model: 'gpt-4o', vision: true }
const RESOURCE = {
  id: 'f1',
  name: 'photo.jpg',
  extension: 'jpg',
  mimeType: 'image/jpeg',
  storageId: 'space-1',
  path: '/photo.jpg',
  size: 1024
}

function setupUseLlmMock(status = 'vision-ready', config: unknown = BASE_CONFIG) {
  vi.mocked(useLlm).mockReturnValue({
    status: ref(status as any),
    config: ref(config as any),
    ensureReady: vi.fn().mockResolvedValue(undefined)
  })
}

function makeFetch(body: unknown, ok = true, statusCode = 200) {
  return Promise.resolve({ ok, status: statusCode, json: async () => body })
}

function getWrapper(
  setup: (result: ReturnType<typeof useAltText>) => void,
  resource: typeof RESOURCE | { size: number } & typeof RESOURCE = RESOURCE
) {
  const mocks = { ...defaultComponentMocks() }
  mocks.$clientService.webdav.getFileContents.mockResolvedValue({
    response: { data: new ArrayBuffer(8) }
  })
  vi.mocked(useSpacesStore).mockReturnValue({ getSpace: vi.fn().mockReturnValue({ id: 'space-1' }) } as any)
  return getComposableWrapper(() => {
    const instance = useAltText(BASE_CONFIG, ref(resource as any))
    setup(instance)
  }, { mocks, provide: mocks })
}

describe('useAltText', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    setupUseLlmMock()
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
})
