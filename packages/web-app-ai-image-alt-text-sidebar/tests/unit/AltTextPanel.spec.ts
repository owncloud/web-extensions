import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount, defaultPlugins } from '@ownclouders/web-test-helpers'
import AltTextPanel from '../../src/components/AltTextPanel.vue'

vi.mock('../../src/composables/useAltText')
vi.mock('../../src/composables/useAltTextStorage')

import { useAltText } from '../../src/composables/useAltText'
import { useAltTextStorage } from '../../src/composables/useAltTextStorage'
import type { LlmStatus, LlmConfig } from '../../src/composables/useLlm'

const triggerGenerateMock = vi.fn()
const ensureReadyMock = vi.fn().mockResolvedValue(undefined)
const saveTextMock = vi.fn().mockResolvedValue(undefined)
const loadStoredTextMock = vi.fn().mockResolvedValue(undefined)

function setupAltTextMock({
  status = 'vision-ready' as LlmStatus,
  isGenerating = false,
  altText = null as string | null,
  panelError = null as string | null
} = {}) {
  vi.mocked(useAltText).mockReturnValue({
    status: ref(status),
    isGenerating: ref(isGenerating),
    altText: ref(altText),
    panelError: ref(panelError),
    triggerGenerate: triggerGenerateMock,
    ensureReady: ensureReadyMock
  })
}

function setupStorageMock({
  storedText = null as string | null,
  isSaving = false,
  saveError = null as string | null
} = {}) {
  vi.mocked(useAltTextStorage).mockReturnValue({
    storedText: ref(storedText),
    isSaving: ref(isSaving),
    saveError: ref(saveError),
    loadStoredText: loadStoredTextMock,
    saveText: saveTextMock
  })
}

function createWrapper(props: { llmConfig?: LlmConfig | null; resource?: any } = {}) {
  return mount(AltTextPanel, {
    props: { llmConfig: null, resource: null, ...props },
    global: { plugins: [...defaultPlugins()] }
  })
}

describe('AltTextPanel', () => {
  beforeEach(() => {
    triggerGenerateMock.mockReset()
    ensureReadyMock.mockReset().mockResolvedValue(undefined)
    saveTextMock.mockReset().mockResolvedValue(undefined)
    loadStoredTextMock.mockReset().mockResolvedValue(undefined)
    setupAltTextMock()
    setupStorageMock()
  })

  it('calls ensureReady and loadStoredText on mount', async () => {
    createWrapper({ resource: { id: 'f1' } })
    await flushPromises()
    expect(ensureReadyMock).toHaveBeenCalledTimes(1)
    expect(loadStoredTextMock).toHaveBeenCalledTimes(1)
  })

  it('shows unconfigured notice when status is unconfigured', async () => {
    setupAltTextMock({ status: 'unconfigured' })
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('.ai-alt-text-placeholder').text()).toContain('configure')
  })

  it('shows text-only notice when status is text-only', async () => {
    setupAltTextMock({ status: 'text-only' })
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('.ai-alt-text-placeholder').text()).toContain('vision')
  })

  it('shows generating spinner', async () => {
    setupAltTextMock({ status: 'vision-ready', isGenerating: true })
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('.ai-alt-text-placeholder').text()).toContain('Generating')
  })

  it('shows idle Generate button when no alt text and not generating', async () => {
    setupAltTextMock({ status: 'vision-ready' })
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.text()).toContain('Generate')
  })

  it('shows the alt text in an oc-textarea', async () => {
    setupAltTextMock({ status: 'vision-ready', altText: 'A mountain landscape.' })
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.findComponent({ name: 'OcTextarea' }).exists()).toBe(true)
  })

  it('shows error message in error banner', async () => {
    setupAltTextMock({ status: 'vision-ready', panelError: 'Service unavailable.' })
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('.ai-alt-text-error').text()).toBe('Service unavailable.')
  })

  it('calls triggerGenerate when Generate button is clicked', async () => {
    setupAltTextMock({ status: 'vision-ready' })
    const wrapper = createWrapper()
    await flushPromises()
    await wrapper.findComponent({ name: 'OcButton' }).trigger('click')
    expect(triggerGenerateMock).toHaveBeenCalledTimes(1)
  })

  it('pre-fills textarea from storedText when no altText is generated', async () => {
    setupAltTextMock({ status: 'vision-ready', altText: null })
    setupStorageMock({ storedText: 'Previously saved description.' })
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.findComponent({ name: 'OcTextarea' }).exists()).toBe(true)
  })

  it('passes llmConfig and resource props to useAltText', async () => {
    const llmConfig = { endpoint: 'http://llm.local/v1', model: 'gpt-4o', vision: true }
    const resource = { id: 'file-1', extension: 'jpg', name: 'photo.jpg' }
    setupAltTextMock({ status: 'vision-ready' })
    createWrapper({ llmConfig, resource })
    await flushPromises()
    expect(vi.mocked(useAltText)).toHaveBeenCalledWith(
      llmConfig,
      expect.objectContaining({ value: resource })
    )
  })
})
