import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount, defaultPlugins } from '@ownclouders/web-test-helpers'
import SummaryPanel from '../../src/components/SummaryPanel.vue'

vi.mock('../../src/composables/useSummary')

import { useSummary } from '../../src/composables/useSummary.js'
import type { SummaryResource, SummaryResult } from '../../src/composables/useSummary.js'
import type { LlmStatus, LlmConfig } from '../../src/composables/useLlm.js'

const triggerSummaryMock = vi.fn()
const ensureReadyMock = vi.fn().mockResolvedValue(undefined)

function setupUseSummaryMock({
  status = 'unconfigured' as LlmStatus,
  isGenerating = false,
  summaryResult = null as SummaryResult | null,
  panelError = null as string | null
} = {}) {
  vi.mocked(useSummary).mockReturnValue({
    status: ref(status),
    isGenerating: ref(isGenerating),
    summaryResult: ref(summaryResult),
    panelError: ref(panelError),
    triggerSummary: triggerSummaryMock,
    ensureReady: ensureReadyMock
  })
}

function createWrapper(
  props: { llmConfig?: LlmConfig | null; resource?: SummaryResource | null } = {}
) {
  return mount(SummaryPanel, {
    props: {
      llmConfig: null,
      resource: null,
      ...props
    },
    global: { plugins: [...defaultPlugins()] }
  })
}

describe('SummaryPanel', () => {
  beforeEach(() => {
    triggerSummaryMock.mockReset()
    ensureReadyMock.mockReset().mockResolvedValue(undefined)
    setupUseSummaryMock()
  })

  describe('unconfigured state', () => {
    it('shows the placeholder when no LLM endpoint is configured', async () => {
      setupUseSummaryMock({ status: 'unconfigured' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.ai-summary-placeholder').exists()).toBe(true)
      expect(wrapper.find('.ai-summary-placeholder').text()).toContain('configure')
    })

    it('does not show an error element', async () => {
      setupUseSummaryMock({ status: 'unconfigured' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.ai-summary-error').exists()).toBe(false)
    })
  })

  describe('generating state', () => {
    it('shows "Summarizing…" while a summary is in flight', async () => {
      setupUseSummaryMock({ status: 'ready', isGenerating: true })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.ai-summary-placeholder').text()).toContain('Summarizing')
    })
  })

  describe('result state', () => {
    const result: SummaryResult = {
      overview: 'This document covers Q4 revenue targets.',
      keyPoints: ['Revenue grew 20%', 'Costs reduced by 8%']
    }

    it('renders the overview paragraph', async () => {
      setupUseSummaryMock({ status: 'ready', summaryResult: result })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('p.oc-mt-rm').text()).toContain('Q4 revenue targets')
    })

    it('renders each key point as a list item', async () => {
      setupUseSummaryMock({ status: 'ready', summaryResult: result })
      const wrapper = createWrapper()
      await flushPromises()
      const items = wrapper.findAll('ul.oc-mt-s li')
      expect(items).toHaveLength(2)
      expect(items[0].text()).toBe('Revenue grew 20%')
      expect(items[1].text()).toBe('Costs reduced by 8%')
    })

    it('shows the Regenerate button', async () => {
      setupUseSummaryMock({ status: 'ready', summaryResult: result })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.oc-flex.oc-flex-right').exists()).toBe(true)
      expect(wrapper.find('.oc-flex.oc-flex-right').text()).toContain('Regenerate')
    })

    it('calls triggerSummary when Regenerate is clicked', async () => {
      setupUseSummaryMock({ status: 'ready', summaryResult: result })
      const wrapper = createWrapper()
      await flushPromises()
      triggerSummaryMock.mockReset()
      await wrapper.findComponent({ name: 'OcButton' }).trigger('click')
      expect(triggerSummaryMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('panel error state', () => {
    it('shows the error message in .ai-summary-error', async () => {
      setupUseSummaryMock({ status: 'ready', panelError: 'AI service unreachable.' })
      const wrapper = createWrapper()
      await flushPromises()
      const err = wrapper.find('.ai-summary-error')
      expect(err.exists()).toBe(true)
      expect(err.text()).toBe('AI service unreachable.')
    })

    it('hides the Regenerate button when panelError is set', async () => {
      setupUseSummaryMock({ status: 'ready', panelError: 'Something went wrong.' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.oc-flex.oc-flex-right').exists()).toBe(false)
    })

    it('does not render the summary result alongside the error', async () => {
      const result: SummaryResult = { overview: 'Some text', keyPoints: ['Point'] }
      setupUseSummaryMock({ status: 'ready', summaryResult: result, panelError: 'Error.' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('p.oc-mt-rm').exists()).toBe(false)
    })
  })

  describe('idle state', () => {
    it('shows a description and Summarize button centered before any summary is generated', async () => {
      setupUseSummaryMock({ status: 'ready' })
      const wrapper = createWrapper()
      await flushPromises()
      const idle = wrapper.find('.oc-flex.oc-flex-center')
      expect(idle.find('p').text()).toContain('summary')
      expect(idle.text()).toContain('Summarize')
    })

    it('calls triggerSummary when Summarize is clicked', async () => {
      setupUseSummaryMock({ status: 'ready' })
      const wrapper = createWrapper()
      await flushPromises()
      await wrapper.findComponent({ name: 'OcButton' }).trigger('click')
      expect(triggerSummaryMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('lifecycle', () => {
    it('calls ensureReady on mount without auto-triggering a summary', async () => {
      setupUseSummaryMock({ status: 'ready' })
      createWrapper()
      await flushPromises()
      expect(ensureReadyMock).toHaveBeenCalledTimes(1)
      expect(triggerSummaryMock).not.toHaveBeenCalled()
    })

    it('passes llmConfig and resource props to useSummary', async () => {
      const llmConfig = { endpoint: 'http://llm.local/v1', model: 'gpt-4' }
      const resource = { id: 'file-1', extension: 'txt', name: 'report.txt' }
      setupUseSummaryMock({ status: 'ready' })
      createWrapper({ llmConfig, resource })
      await flushPromises()
      expect(vi.mocked(useSummary)).toHaveBeenCalledWith(
        llmConfig,
        expect.objectContaining({ value: resource })
      )
    })
  })
})
