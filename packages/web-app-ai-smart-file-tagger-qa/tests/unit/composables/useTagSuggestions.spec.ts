import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { defaultComponentMocks, getComposableWrapper } from '@ownclouders/web-test-helpers'

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn()
}))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs', () => ({}))

vi.mock('../../../src/composables/useLLM', () => ({
  useLLM: vi.fn()
}))

vi.mock('@ownclouders/web-pkg', async () => {
  const actual = await vi.importActual<typeof import('@ownclouders/web-pkg')>('@ownclouders/web-pkg')
  return { ...actual, useSpacesStore: vi.fn() }
})

import { useTagSuggestions } from '../../../src/composables/useTagSuggestions'
import type { TagResource } from '../../../src/composables/useTagSuggestions'
import { useLLM } from '../../../src/composables/useLLM'
import { useSpacesStore } from '@ownclouders/web-pkg'

const BASE_CONFIG = { endpoint: 'http://llm.local/v1', model: 'test-model' }

const TEXT_RESOURCE: TagResource = {
  id: 'f1',
  fileId: 'f1',
  name: 'report.txt',
  extension: 'txt',
  storageId: 'space-1',
  path: '/report.txt'
}

const IMAGE_RESOURCE: TagResource = {
  id: 'f2',
  fileId: 'f2',
  name: 'photo.png',
  extension: 'png',
  storageId: 'space-1',
  path: '/photo.png'
}

function setupUseLLMMock({ status = 'ready', complete = vi.fn() } = {}) {
  vi.mocked(useLLM).mockReturnValue({
    status: ref(status as any),
    complete,
    stream: vi.fn()
  })
  return complete
}

function getWrapper(
  setup: (result: ReturnType<typeof useTagSuggestions>) => void,
  {
    resource = TEXT_RESOURCE as TagResource | null,
    llmConfig = BASE_CONFIG as typeof BASE_CONFIG | null,
    fileContents = 'Document content here.'
  } = {}
) {
  const mocks = { ...defaultComponentMocks() }
  mocks.$clientService.webdav.getFileContents.mockResolvedValue({
    response: { data: fileContents }
  })
  mocks.$clientService.graphAuthenticated.tags.assignTags.mockResolvedValue(undefined)

  const mockSpace = { id: 'space-1' }
  vi.mocked(useSpacesStore).mockReturnValue({
    getSpace: vi.fn().mockReturnValue(mockSpace)
  } as any)

  return getComposableWrapper(
    () => {
      const resourceRef = ref(resource)
      const instance = useTagSuggestions(resourceRef, llmConfig)
      setup(instance)
    },
    { mocks, provide: mocks }
  )
}

describe('useTagSuggestions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('prompt construction', () => {
    it('sends the file content in the prompt for content-extraction-eligible files', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue('{"tags":[{"name":"finance","confidence":0.9}]}')

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.fetchSuggestions().then(() => {
            const [messages] = completeMock.mock.calls[0]
            expect(messages[0].content).toContain('File content:\nDocument content here.')
            expect(messages[0].content).toContain('File name: "report.txt"')
            expect(messages[0].content).not.toContain('File type:')
            resolve()
          })
        })
      })
    })

    it('fetches the file content via WebDAV for content mode', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue('{"tags":[{"name":"finance","confidence":0.9}]}')

      await new Promise<void>((resolve) => {
        const mocks = { ...defaultComponentMocks() }
        mocks.$clientService.webdav.getFileContents.mockResolvedValue({
          response: { data: 'Document content here.' }
        })
        vi.mocked(useSpacesStore).mockReturnValue({
          getSpace: vi.fn().mockReturnValue({ id: 'space-1' })
        } as any)

        getComposableWrapper(
          () => {
            const resourceRef = ref(TEXT_RESOURCE)
            const instance = useTagSuggestions(resourceRef, BASE_CONFIG)
            instance.fetchSuggestions().then(() => {
              expect(mocks.$clientService.webdav.getFileContents).toHaveBeenCalledTimes(1)
              resolve()
            })
          },
          { mocks, provide: mocks }
        )
      })
    })

    it('sends only the file name and MIME type for files not eligible for content extraction', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue('{"tags":[{"name":"photo","confidence":0.8}]}')

      await new Promise<void>((resolve) => {
        getWrapper(
          (instance) => {
            instance.fetchSuggestions().then(() => {
              const [messages] = completeMock.mock.calls[0]
              expect(messages[0].content).toContain('File name: "photo.png"')
              expect(messages[0].content).toContain('File type: image/png')
              expect(messages[0].content).not.toContain('File content:')
              resolve()
            })
          },
          { resource: IMAGE_RESOURCE }
        )
      })
    })

    it('does not call WebDAV when the file is not eligible for content extraction', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue('{"tags":[{"name":"photo","confidence":0.8}]}')

      await new Promise<void>((resolve) => {
        const mocks = { ...defaultComponentMocks() }
        mocks.$clientService.webdav.getFileContents.mockResolvedValue({
          response: { data: 'unused' }
        })
        vi.mocked(useSpacesStore).mockReturnValue({
          getSpace: vi.fn().mockReturnValue({ id: 'space-1' })
        } as any)

        getComposableWrapper(
          () => {
            const resourceRef = ref(IMAGE_RESOURCE)
            const instance = useTagSuggestions(resourceRef, BASE_CONFIG)
            instance.fetchSuggestions().then(() => {
              expect(mocks.$clientService.webdav.getFileContents).not.toHaveBeenCalled()
              resolve()
            })
          },
          { mocks, provide: mocks }
        )
      })
    })
  })

  describe('structured JSON response parsing', () => {
    it('parses tags with confidence scores, normalizing names and clamping confidence', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue(
        JSON.stringify({
          tags: [
            { name: 'Quarterly Report', confidence: 0.92 },
            { name: 'finance', confidence: 1.4 },
            { name: '   ', confidence: 0.5 }
          ]
        })
      )

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.fetchSuggestions().then(() => {
            expect(instance.status.value).toBe('ready')
            expect(instance.tags.value).toEqual([
              { name: 'quarterly-report', confidence: 0.92, selected: true },
              { name: 'finance', confidence: 1, selected: true }
            ])
            resolve()
          })
        })
      })
    })

    it('strips markdown code fences before parsing JSON', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue('```json\n{"tags":[{"name":"invoice","confidence":0.5}]}\n```')

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.fetchSuggestions().then(() => {
            expect(instance.tags.value).toEqual([{ name: 'invoice', confidence: 0.5, selected: true }])
            resolve()
          })
        })
      })
    })

    it('caps the number of suggested tags at five', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue(
        JSON.stringify({
          tags: Array.from({ length: 8 }, (_, i) => ({ name: `tag-${i}`, confidence: 0.5 }))
        })
      )

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.fetchSuggestions().then(() => {
            expect(instance.tags.value).toHaveLength(5)
            resolve()
          })
        })
      })
    })
  })

  describe('plain-text fallback', () => {
    it('splits a non-JSON response into tags by comma, newline, and semicolon', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue('Invoices, Quarterly Report; project-x\ntax-document')

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.fetchSuggestions().then(() => {
            expect(instance.status.value).toBe('ready')
            expect(instance.tags.value).toEqual([
              { name: 'invoices', confidence: null, selected: true },
              { name: 'quarterly-report', confidence: null, selected: true },
              { name: 'project-x', confidence: null, selected: true },
              { name: 'tax-document', confidence: null, selected: true }
            ])
            resolve()
          })
        })
      })
    })

    it('sets an error when no usable tags can be parsed from the response', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue('   ')

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.fetchSuggestions().then(() => {
            expect(instance.status.value).toBe('error')
            expect(instance.tags.value).toEqual([])
            expect(instance.error.value).toMatch(/no tags/i)
            resolve()
          })
        })
      })
    })
  })

  describe('applyTags', () => {
    it('assigns only the selected tag names to the resource via the Graph API', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue(
        JSON.stringify({
          tags: [
            { name: 'invoice', confidence: 0.9 },
            { name: 'draft', confidence: 0.4 }
          ]
        })
      )

      await new Promise<void>((resolve) => {
        const mocks = { ...defaultComponentMocks() }
        mocks.$clientService.webdav.getFileContents.mockResolvedValue({
          response: { data: 'Document content here.' }
        })
        mocks.$clientService.graphAuthenticated.tags.assignTags.mockResolvedValue(undefined)
        vi.mocked(useSpacesStore).mockReturnValue({
          getSpace: vi.fn().mockReturnValue({ id: 'space-1' })
        } as any)

        getComposableWrapper(
          () => {
            const resourceRef = ref(TEXT_RESOURCE)
            const instance = useTagSuggestions(resourceRef, BASE_CONFIG)
            instance
              .fetchSuggestions()
              .then(() => {
                instance.tags.value[1].selected = false
                return instance.applyTags()
              })
              .then(() => {
                expect(mocks.$clientService.graphAuthenticated.tags.assignTags).toHaveBeenCalledWith({
                  resourceId: 'f1',
                  tags: ['invoice']
                })
                resolve()
              })
          },
          { mocks, provide: mocks }
        )
      })
    })

    it('does not call the Graph API when no tags are selected', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue(JSON.stringify({ tags: [{ name: 'invoice', confidence: 0.9 }] }))

      await new Promise<void>((resolve) => {
        const mocks = { ...defaultComponentMocks() }
        mocks.$clientService.webdav.getFileContents.mockResolvedValue({
          response: { data: 'Document content here.' }
        })
        vi.mocked(useSpacesStore).mockReturnValue({
          getSpace: vi.fn().mockReturnValue({ id: 'space-1' })
        } as any)

        getComposableWrapper(
          () => {
            const resourceRef = ref(TEXT_RESOURCE)
            const instance = useTagSuggestions(resourceRef, BASE_CONFIG)
            instance
              .fetchSuggestions()
              .then(() => {
                instance.tags.value[0].selected = false
                return instance.applyTags()
              })
              .then(() => {
                expect(mocks.$clientService.graphAuthenticated.tags.assignTags).not.toHaveBeenCalled()
                resolve()
              })
          },
          { mocks, provide: mocks }
        )
      })
    })

    it('rejects when the resource has no usable id', async () => {
      setupUseLLMMock()

      await new Promise<void>((resolve) => {
        getWrapper(
          (instance) => {
            instance.applyTags().catch((err) => {
              expect(err).toBeInstanceOf(Error)
              resolve()
            })
          },
          { resource: { ...TEXT_RESOURCE, id: undefined, fileId: undefined } }
        )
      })
    })
  })

  describe('error branches', () => {
    it('surfaces a 401 failure from the LLM request', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockRejectedValue(new Error('LLM request failed: 401 Unauthorized'))

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.fetchSuggestions().then(() => {
            expect(instance.status.value).toBe('error')
            expect(instance.error.value).toBe('LLM request failed: 401 Unauthorized')
            resolve()
          })
        })
      })
    })

    it('surfaces a 429 rate-limit failure from the LLM request', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockRejectedValue(new Error('LLM request failed: 429 Too Many Requests'))

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.fetchSuggestions().then(() => {
            expect(instance.status.value).toBe('error')
            expect(instance.error.value).toBe('LLM request failed: 429 Too Many Requests')
            resolve()
          })
        })
      })
    })

    it('sets a network error message on a network failure', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockRejectedValue(new TypeError('Failed to fetch'))

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.fetchSuggestions().then(() => {
            expect(instance.status.value).toBe('error')
            expect(instance.error.value).toMatch(/network|connection/i)
            resolve()
          })
        })
      })
    })

    it('clears isGenerating after a failure', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockRejectedValue(new TypeError('Failed to fetch'))

      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.fetchSuggestions().then(() => {
            expect(instance.isGenerating.value).toBe(false)
            resolve()
          })
        })
      })
    })
  })

  describe('unconfigured guard', () => {
    it('does not call the LLM when no config is provided', async () => {
      const completeMock = setupUseLLMMock({ status: 'unconfigured' })

      await new Promise<void>((resolve) => {
        getWrapper(
          (instance) => {
            instance.fetchSuggestions().then(() => {
              expect(completeMock).not.toHaveBeenCalled()
              expect(instance.status.value).toBe('unconfigured')
              resolve()
            })
          },
          { llmConfig: null }
        )
      })
    })
  })
})
