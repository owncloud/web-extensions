import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn()
}))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs', () => ({}))

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({ $gettext: (s: string) => s })
}))

vi.mock('@ownclouders/web-pkg', () => ({
  useClientService: vi.fn(),
  useSpacesStore: vi.fn(),
  useResourcesStore: vi.fn()
}))

vi.mock('../../../src/composables/useLLM', () => ({
  useLLM: vi.fn()
}))

import { useTagSuggestions } from '../../../src/composables/useTagSuggestions'
import type { TagResource } from '../../../src/composables/useTagSuggestions'
import { useLLM } from '../../../src/composables/useLLM'
import { useClientService, useResourcesStore, useSpacesStore } from '@ownclouders/web-pkg'

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

function setupClientServiceMock({ fileContents = 'Document content here.' } = {}) {
  const getFileContents = vi.fn().mockResolvedValue({ response: { data: fileContents } })
  const assignTags = vi.fn().mockResolvedValue(undefined)
  vi.mocked(useClientService).mockReturnValue({
    webdav: { getFileContents },
    graphAuthenticated: { tags: { assignTags } }
  } as any)
  vi.mocked(useSpacesStore).mockReturnValue({
    getSpace: vi.fn().mockReturnValue({ id: 'space-1' })
  } as any)
  return { getFileContents, assignTags }
}

function setupResourcesStoreMock({
  resources = [] as Array<{ id: string; tags?: string[] }>,
  currentFolder = null as { id: string; tags?: string[] } | null
} = {}) {
  const updateResourceField = vi.fn()
  vi.mocked(useResourcesStore).mockReturnValue({
    resources,
    currentFolder,
    updateResourceField
  } as any)
  return { updateResourceField }
}

function createInstance(
  resource: TagResource | null = TEXT_RESOURCE,
  llmConfig: typeof BASE_CONFIG | null = BASE_CONFIG
) {
  return useTagSuggestions(ref(resource), llmConfig)
}

describe('useTagSuggestions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('prompt construction', () => {
    it('sends the file content in the prompt for content-extraction-eligible files', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue('{"tags":[{"name":"finance","confidence":0.9}]}')
      setupClientServiceMock()

      const instance = createInstance()
      await instance.fetchSuggestions()

      const [messages] = completeMock.mock.calls[0]
      expect(messages[0].content).toContain('File content:\nDocument content here.')
      expect(messages[0].content).toContain('File name: "report.txt"')
      expect(messages[0].content).not.toContain('File type:')
    })

    it('fetches the file content via WebDAV for content mode', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue('{"tags":[{"name":"finance","confidence":0.9}]}')
      const { getFileContents } = setupClientServiceMock()

      const instance = createInstance()
      await instance.fetchSuggestions()

      expect(getFileContents).toHaveBeenCalledTimes(1)
    })

    it('sends only the file name and MIME type for files not eligible for content extraction', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue('{"tags":[{"name":"photo","confidence":0.8}]}')
      setupClientServiceMock()

      const instance = createInstance(IMAGE_RESOURCE)
      await instance.fetchSuggestions()

      const [messages] = completeMock.mock.calls[0]
      expect(messages[0].content).toContain('File name: "photo.png"')
      expect(messages[0].content).toContain('File type: image/png')
      expect(messages[0].content).not.toContain('File content:')
    })

    it('does not call WebDAV when the file is not eligible for content extraction', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue('{"tags":[{"name":"photo","confidence":0.8}]}')
      const { getFileContents } = setupClientServiceMock()

      const instance = createInstance(IMAGE_RESOURCE)
      await instance.fetchSuggestions()

      expect(getFileContents).not.toHaveBeenCalled()
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
      setupClientServiceMock()

      const instance = createInstance()
      await instance.fetchSuggestions()

      expect(instance.status.value).toBe('ready')
      expect(instance.tags.value).toEqual([
        { name: 'quarterly-report', confidence: 0.92, selected: false },
        { name: 'finance', confidence: 1, selected: false }
      ])
    })

    it('strips markdown code fences before parsing JSON', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue('```json\n{"tags":[{"name":"invoice","confidence":0.5}]}\n```')
      setupClientServiceMock()

      const instance = createInstance()
      await instance.fetchSuggestions()

      expect(instance.tags.value).toEqual([{ name: 'invoice', confidence: 0.5, selected: false }])
    })

    it('caps the number of suggested tags at five', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue(
        JSON.stringify({
          tags: Array.from({ length: 8 }, (_, i) => ({ name: `tag-${i}`, confidence: 0.5 }))
        })
      )
      setupClientServiceMock()

      const instance = createInstance()
      await instance.fetchSuggestions()

      expect(instance.tags.value).toHaveLength(5)
    })
  })

  describe('plain-text fallback', () => {
    it('splits a non-JSON response into tags by comma, newline, and semicolon', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue('Invoices, Quarterly Report; project-x\ntax-document')
      setupClientServiceMock()

      const instance = createInstance()
      await instance.fetchSuggestions()

      expect(instance.status.value).toBe('ready')
      expect(instance.tags.value).toEqual([
        { name: 'invoices', confidence: null, selected: false },
        { name: 'quarterly-report', confidence: null, selected: false },
        { name: 'project-x', confidence: null, selected: false },
        { name: 'tax-document', confidence: null, selected: false }
      ])
    })

    it('strips leading list numbering from a numbered-list response', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue('1. waffle\n2. despair\n3. sarcasm\n4. absurdity\n5. humor')
      setupClientServiceMock()

      const instance = createInstance()
      await instance.fetchSuggestions()

      expect(instance.status.value).toBe('ready')
      expect(instance.tags.value).toEqual([
        { name: 'waffle', confidence: null, selected: false },
        { name: 'despair', confidence: null, selected: false },
        { name: 'sarcasm', confidence: null, selected: false },
        { name: 'absurdity', confidence: null, selected: false },
        { name: 'humor', confidence: null, selected: false }
      ])
    })

    it('sets an error when no usable tags can be parsed from the response', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue('   ')
      setupClientServiceMock()

      const instance = createInstance()
      await instance.fetchSuggestions()

      expect(instance.status.value).toBe('error')
      expect(instance.tags.value).toEqual([])
      expect(instance.error.value).toMatch(/no tags/i)
    })

    it('does not mangle valid JSON that lacks a usable tags array into garbage chips', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue(
        '{"file-type":"text","content-type":"plain-text","encoding":"utf-8"}'
      )
      setupClientServiceMock()

      const instance = createInstance()
      await instance.fetchSuggestions()

      expect(instance.status.value).toBe('error')
      expect(instance.tags.value).toEqual([])
      expect(instance.error.value).toMatch(/no tags/i)
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
      const { assignTags } = setupClientServiceMock()
      setupResourcesStoreMock({ resources: [{ id: 'f1', tags: [] }] })

      const instance = createInstance()
      await instance.fetchSuggestions()
      instance.tags.value[0].selected = true
      await instance.applyTags()

      expect(assignTags).toHaveBeenCalledWith({
        resourceId: 'f1',
        tags: ['invoice']
      })
    })

    it('updates the resources store so the file list/sidebar reflect the new tags without a page refresh', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue(JSON.stringify({ tags: [{ name: 'invoice', confidence: 0.9 }] }))
      setupClientServiceMock()
      const { updateResourceField } = setupResourcesStoreMock({
        resources: [{ id: 'f1', tags: ['existing-tag'] }]
      })

      const instance = createInstance()
      await instance.fetchSuggestions()
      instance.tags.value[0].selected = true
      await instance.applyTags()

      expect(updateResourceField).toHaveBeenCalledWith({
        id: 'f1',
        field: 'tags',
        value: ['existing-tag', 'invoice']
      })
    })

    it('falls back to the current folder when the resource is not in the resources list', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue(JSON.stringify({ tags: [{ name: 'invoice', confidence: 0.9 }] }))
      setupClientServiceMock()
      const { updateResourceField } = setupResourcesStoreMock({
        resources: [],
        currentFolder: { id: 'f1', tags: ['existing-tag'] }
      })

      const instance = createInstance()
      await instance.fetchSuggestions()
      instance.tags.value[0].selected = true
      await instance.applyTags()

      expect(updateResourceField).toHaveBeenCalledWith({
        id: 'f1',
        field: 'tags',
        value: ['existing-tag', 'invoice']
      })
    })

    it('does not call the Graph API when no tags are selected', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockResolvedValue(JSON.stringify({ tags: [{ name: 'invoice', confidence: 0.9 }] }))
      const { assignTags } = setupClientServiceMock()
      const { updateResourceField } = setupResourcesStoreMock()

      const instance = createInstance()
      await instance.fetchSuggestions()
      await instance.applyTags()

      expect(assignTags).not.toHaveBeenCalled()
      expect(updateResourceField).not.toHaveBeenCalled()
    })

    it('rejects when the resource has no usable id', async () => {
      setupUseLLMMock()
      setupClientServiceMock()
      setupResourcesStoreMock()

      const instance = createInstance({ ...TEXT_RESOURCE, id: undefined, fileId: undefined })

      await expect(instance.applyTags()).rejects.toBeInstanceOf(Error)
    })
  })

  describe('error branches', () => {
    it('surfaces a 401 failure from the LLM request', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockRejectedValue(new Error('LLM request failed: 401 Unauthorized'))
      setupClientServiceMock()

      const instance = createInstance()
      await instance.fetchSuggestions()

      expect(instance.status.value).toBe('error')
      expect(instance.error.value).toBe('LLM request failed: 401 Unauthorized')
    })

    it('surfaces a 429 rate-limit failure from the LLM request', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockRejectedValue(new Error('LLM request failed: 429 Too Many Requests'))
      setupClientServiceMock()

      const instance = createInstance()
      await instance.fetchSuggestions()

      expect(instance.status.value).toBe('error')
      expect(instance.error.value).toBe('LLM request failed: 429 Too Many Requests')
    })

    it('sets a network error message on a network failure', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockRejectedValue(new TypeError('Failed to fetch'))
      setupClientServiceMock()

      const instance = createInstance()
      await instance.fetchSuggestions()

      expect(instance.status.value).toBe('error')
      expect(instance.error.value).toMatch(/network|connection/i)
    })

    it('clears isGenerating after a failure', async () => {
      const completeMock = setupUseLLMMock()
      completeMock.mockRejectedValue(new TypeError('Failed to fetch'))
      setupClientServiceMock()

      const instance = createInstance()
      await instance.fetchSuggestions()

      expect(instance.isGenerating.value).toBe(false)
    })
  })

  describe('unconfigured guard', () => {
    it('does not call the LLM when no config is provided', async () => {
      const completeMock = setupUseLLMMock({ status: 'unconfigured' })
      setupClientServiceMock()

      const instance = createInstance(TEXT_RESOURCE, null)
      await instance.fetchSuggestions()

      expect(completeMock).not.toHaveBeenCalled()
      expect(instance.status.value).toBe('unconfigured')
    })
  })
})
