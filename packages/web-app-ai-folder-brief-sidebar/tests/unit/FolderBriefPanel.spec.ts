import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount, defaultPlugins } from '@ownclouders/web-test-helpers'
import FolderBriefPanel from '../../src/components/FolderBriefPanel.vue'

vi.mock('../../src/composables/useFolderBrief')
import { useFolderBrief } from '../../src/composables/useFolderBrief'
import type { BriefResult } from '../../src/composables/useFolderBrief'
import type { LlmStatus, LlmConfig } from '../../src/composables/useLlm'
import type { Resource } from '@ownclouders/web-client'

const triggerBriefMock = vi.fn()
const ensureReadyMock = vi.fn().mockResolvedValue(undefined)

function setupMock({
  status = 'unconfigured' as LlmStatus,
  isLoading = false,
  briefResult = null as BriefResult | null,
  panelError = null as string | null
} = {}) {
  vi.mocked(useFolderBrief).mockReturnValue({
    status: ref(status),
    isLoading: ref(isLoading),
    briefResult: ref(briefResult),
    panelError: ref(panelError),
    triggerBrief: triggerBriefMock,
    ensureReady: ensureReadyMock
  })
}

function createWrapper(props: { resource?: Resource | null; llmConfig?: LlmConfig | null } = {}) {
  return mount(FolderBriefPanel, {
    props: { llmConfig: null, resource: null, ...props },
    global: { plugins: [...defaultPlugins()] }
  })
}

describe('FolderBriefPanel', () => {
  beforeEach(() => {
    triggerBriefMock.mockReset()
    ensureReadyMock.mockReset().mockResolvedValue(undefined)
    setupMock()
  })

  it('shows the loading placeholder while isLoading is true', async () => {
    setupMock({ status: 'ready', isLoading: true })
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.find('.ai-folder-brief-placeholder').text()).toMatch(/Generating|Loading/)
  })

  it('shows the error message when panelError is set', async () => {
    setupMock({ status: 'ready', panelError: 'AI service unreachable.' })
    const wrapper = createWrapper()
    await flushPromises()
    const err = wrapper.find('.ai-folder-brief-error')
    expect(err.exists()).toBe(true)
    expect(err.text()).toBe('AI service unreachable.')
  })

  it('renders the summary when briefResult is present', async () => {
    setupMock({
      status: 'ready',
      briefResult: { summary: 'A project folder.', isStatic: false }
    })
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.text()).toContain('A project folder.')
  })

  it('shows filesByType and recentChanges when present in briefResult', async () => {
    setupMock({
      status: 'ready',
      briefResult: {
        summary: 'Project folder.',
        filesByType: 'Mostly PDFs.',
        recentChanges: 'Updated last week.',
        isStatic: false
      }
    })
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.text()).toContain('Mostly PDFs.')
    expect(wrapper.text()).toContain('Updated last week.')
  })

  it('shows Regenerate button after a LLM brief (isStatic: false)', async () => {
    setupMock({
      status: 'ready',
      briefResult: { summary: 'Project folder.', isStatic: false }
    })
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.text()).toContain('Regenerate')
  })

  it('hides Regenerate button for static brief (isStatic: true)', async () => {
    setupMock({
      status: 'unconfigured',
      briefResult: { summary: 'Contains 3 PDFs.', isStatic: true }
    })
    const wrapper = createWrapper()
    await flushPromises()
    expect(wrapper.text()).not.toContain('Regenerate')
  })

  it('calls triggerBrief on mount', async () => {
    setupMock({ status: 'ready' })
    createWrapper()
    await flushPromises()
    expect(triggerBriefMock).toHaveBeenCalledTimes(1)
  })

  it('calls triggerBrief when Regenerate is clicked', async () => {
    setupMock({
      status: 'ready',
      briefResult: { summary: 'Project folder.', isStatic: false }
    })
    const wrapper = createWrapper()
    await flushPromises()
    triggerBriefMock.mockReset()
    await wrapper.findComponent({ name: 'OcButton' }).trigger('click')
    expect(triggerBriefMock).toHaveBeenCalledTimes(1)
  })

  it('passes llmConfig and resource props to useFolderBrief', async () => {
    const llmConfig = { endpoint: 'http://llm.local/v1', model: 'llama3.2' }
    const resource = { id: 'f1', name: 'Project Alpha', isFolder: true }
    setupMock({ status: 'ready' })
    createWrapper({ llmConfig, resource: resource as unknown as Resource })
    await flushPromises()
    expect(vi.mocked(useFolderBrief)).toHaveBeenCalledWith(
      llmConfig,
      expect.objectContaining({ value: resource })
    )
  })
})
