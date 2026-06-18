import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({
    $gettext: (s: string, params?: Record<string, unknown>) => {
      if (params) {
        return s.replace(/%\{(\w+)\}/g, (_, k) => String(params[k] ?? ''))
      }
      return s
    },
    $pgettext: (_ctx: string, s: string) => s
  })
}))

vi.mock('../../src/composables/useVersionHistory')
vi.mock('../../src/composables/useChangelog')

vi.mock('@ownclouders/web-pkg', () => ({
  useClientService: vi.fn(),
  useConfigStore: vi.fn(),
  useSpacesStore: vi.fn()
}))

import ChangelogPanel from '../../src/components/ChangelogPanel.vue'
import { useVersionHistory } from '../../src/composables/useVersionHistory'
import { useChangelog } from '../../src/composables/useChangelog'
import { useClientService, useConfigStore, useSpacesStore } from '@ownclouders/web-pkg'
import type { ChangelogEntry } from '../../src/composables/useChangelog'

const fetchVersionsMock = vi.fn()
const generateEntryMock = vi.fn()
const clearErrorMock = vi.fn()

function setupVersionHistoryMock({
  versions = [] as any[],
  isLoading = false,
  error = null as string | null
} = {}) {
  vi.mocked(useVersionHistory).mockReturnValue({
    versions: ref(versions),
    isLoading: ref(isLoading),
    error: ref(error),
    fetchVersions: fetchVersionsMock
  })
}

function setupChangelogMock({
  entries = {} as Record<string, any>,
  generatingKeys = new Set<string>(),
  errors = {} as Record<string, string>
} = {}) {
  vi.mocked(useChangelog).mockReturnValue({
    generateEntry: generateEntryMock,
    getEntry: (key: string) => entries[key],
    isGeneratingKey: (key: string) => generatingKeys.has(key),
    getError: (key: string) => errors[key],
    clearError: clearErrorMock
  })
}

function setupServiceMocks() {
  vi.mocked(useClientService).mockReturnValue({
    httpAuthenticated: { get: vi.fn() },
    webdav: { getFileContents: vi.fn(), listFileVersions: vi.fn() }
  } as any)
  vi.mocked(useConfigStore).mockReturnValue({ serverUrl: 'https://server.example.com' } as any)
  vi.mocked(useSpacesStore).mockReturnValue({ getSpace: vi.fn().mockReturnValue(null) } as any)
}

function makeVersion(index: number) {
  return {
    id: `v${index}`,
    name: `Version ${index}`,
    mdate: new Date(2024, 0, index).toUTCString(),
    etag: `etag-${index}`,
    path: `/meta/file-abc/v/${index}`
  }
}

function createWrapper(props: Record<string, unknown> = {}) {
  return mount(ChangelogPanel, {
    props: {
      resource: null,
      llmConfig: null,
      ...props
    },
    global: {
      stubs: {
        OcButton: {
          template: '<button v-bind="$attrs"><slot /></button>',
          inheritAttrs: false
        }
      }
    }
  })
}

describe('ChangelogPanel', () => {
  beforeEach(() => {
    fetchVersionsMock.mockReset()
    generateEntryMock.mockReset()
    clearErrorMock.mockReset()
    setupVersionHistoryMock()
    setupChangelogMock()
    setupServiceMocks()
  })

  describe('unconfigured banner', () => {
    it('shows config notice when llmConfig is null', async () => {
      const wrapper = createWrapper({ llmConfig: null })
      await flushPromises()
      expect(wrapper.find('.changelog-notice').exists()).toBe(true)
    })

    it('hides config notice when llmConfig is provided', async () => {
      setupVersionHistoryMock({ versions: [makeVersion(1)] })
      const wrapper = createWrapper({ llmConfig: { endpoint: 'http://llm.local/v1', model: 'llama3' } })
      await flushPromises()
      expect(wrapper.find('.changelog-notice').exists()).toBe(false)
    })
  })

  describe('loading state', () => {
    it('shows loading text while versions are loading', async () => {
      setupVersionHistoryMock({ isLoading: true })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.changelog-placeholder').text()).toContain('Loading version history')
    })
  })

  describe('error state', () => {
    it('shows error message when history fetch fails', async () => {
      setupVersionHistoryMock({ error: 'Failed to load version history.' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.changelog-error').text()).toBe('Failed to load version history.')
    })
  })

  describe('empty state', () => {
    it('shows placeholder when no versions exist', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.changelog-placeholder').text()).toContain('No version history')
    })
  })

  describe('version list', () => {
    it('renders a row for each version', async () => {
      setupVersionHistoryMock({ versions: [makeVersion(1), makeVersion(2)] })
      const wrapper = createWrapper({ resource: { fileId: 'file-abc', id: 'file-abc', mimeType: 'text/plain' } })
      await flushPromises()
      expect(wrapper.findAll('[data-testid="version-row"]')).toHaveLength(2)
    })

    it('shows Generate button disabled when llmConfig is null', async () => {
      setupVersionHistoryMock({ versions: [makeVersion(1)] })
      const wrapper = createWrapper({ resource: { fileId: 'file-abc', id: 'file-abc', mimeType: 'text/plain' }, llmConfig: null })
      await flushPromises()
      const btn = wrapper.find('button')
      expect(btn.attributes('disabled')).toBeDefined()
    })

    it('shows Generate button enabled when llmConfig is provided and no entry cached', async () => {
      setupVersionHistoryMock({ versions: [makeVersion(1)] })
      const wrapper = createWrapper({ resource: { fileId: 'file-abc', id: 'file-abc', mimeType: 'text/plain' }, llmConfig: { endpoint: 'http://llm.local/v1', model: 'm' } })
      await flushPromises()
      const btn = wrapper.find('button')
      expect(btn.attributes('disabled')).toBeUndefined()
    })

    it('calls generateEntry when Generate is clicked', async () => {
      setupVersionHistoryMock({ versions: [makeVersion(1)] })
      generateEntryMock.mockResolvedValue(undefined)
      const wrapper = createWrapper({ resource: { fileId: 'file-abc', id: 'file-abc', mimeType: 'text/plain' }, llmConfig: { endpoint: 'http://llm.local/v1', model: 'm' } })
      await flushPromises()
      await wrapper.find('button').trigger('click')
      expect(generateEntryMock).toHaveBeenCalledOnce()
    })
  })

  describe('entry rendering', () => {
    it('renders a changelog entry as a plain summary paragraph', async () => {
      const v = makeVersion(1)
      const entry: ChangelogEntry = { summary: 'Q3 figures were added and the draft watermark was removed.' }
      setupVersionHistoryMock({ versions: [v] })
      setupChangelogMock({ entries: { [`file-abc:${v.etag}`]: entry } })
      const wrapper = createWrapper({
        resource: { fileId: 'file-abc', storageId: 's1', id: 'f1', mimeType: 'text/plain' },
        llmConfig: { endpoint: 'http://x.local/v1', model: 'm' }
      })
      await flushPromises()
      expect(wrapper.find('.changelog-entry-plain').text()).toBe(
        'Q3 figures were added and the draft watermark was removed.'
      )
    })

    it('shows "Generating…" text when a key is generating', async () => {
      const v = makeVersion(1)
      setupVersionHistoryMock({ versions: [v] })
      setupChangelogMock({ generatingKeys: new Set([`file-abc:${v.etag}`]) })
      const wrapper = createWrapper({
        resource: { fileId: 'file-abc', storageId: 's1', id: 'f1', mimeType: 'text/plain' },
        llmConfig: { endpoint: 'http://x.local/v1', model: 'm' }
      })
      await flushPromises()
      expect(wrapper.find('.changelog-generating').exists()).toBe(true)
      expect(wrapper.text()).toContain('Generating')
    })

    it('shows inline error with Retry button', async () => {
      const v = makeVersion(1)
      setupVersionHistoryMock({ versions: [v] })
      setupChangelogMock({ errors: { [`file-abc:${v.etag}`]: 'AI service unavailable.' } })
      const wrapper = createWrapper({
        resource: { fileId: 'file-abc', storageId: 's1', id: 'f1', mimeType: 'text/plain' },
        llmConfig: { endpoint: 'http://x.local/v1', model: 'm' }
      })
      await flushPromises()
      expect(wrapper.find('.changelog-entry-error').text()).toContain('AI service unavailable.')
      expect(wrapper.text()).toContain('Retry')
    })

    it('calls clearError and generateEntry again when Retry is clicked', async () => {
      const v = makeVersion(1)
      setupVersionHistoryMock({ versions: [v] })
      setupChangelogMock({ errors: { [`file-abc:${v.etag}`]: 'Error.' } })
      generateEntryMock.mockResolvedValue(undefined)
      const wrapper = createWrapper({
        resource: { fileId: 'file-abc', storageId: 's1', id: 'f1', mimeType: 'text/plain' },
        llmConfig: { endpoint: 'http://x.local/v1', model: 'm' }
      })
      await flushPromises()
      const retryBtn = wrapper.findAll('button').find((b) => b.text() === 'Retry')
      await retryBtn!.trigger('click')
      expect(clearErrorMock).toHaveBeenCalledOnce()
      expect(generateEntryMock).toHaveBeenCalledOnce()
    })
  })

  describe('binary file detection', () => {
    it('shows binary notice for image files', async () => {
      const wrapper = createWrapper({
        resource: { fileId: 'f1', mimeType: 'image/png', id: 'f1' }
      })
      await flushPromises()
      expect(wrapper.find('.changelog-placeholder').text()).toContain('Binary files')
    })

    it('does not show binary notice for text files', async () => {
      const wrapper = createWrapper({
        resource: { fileId: 'f1', mimeType: 'text/plain', id: 'f1' }
      })
      await flushPromises()
      expect(wrapper.find('.changelog-placeholder').exists()).toBe(true)
      expect(wrapper.find('.changelog-placeholder').text()).not.toContain('Binary')
    })
  })

  describe('lifecycle', () => {
    it('calls fetchVersions on mount when resource has a fileId', async () => {
      createWrapper({ resource: { fileId: 'file-abc', id: 'file-abc', name: 'doc.txt', mimeType: 'text/plain' } })
      await flushPromises()
      expect(fetchVersionsMock).toHaveBeenCalledWith('file-abc')
    })
  })
})
