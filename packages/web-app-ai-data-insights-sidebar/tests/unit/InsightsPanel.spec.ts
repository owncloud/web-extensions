import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import InsightsPanel from '../../src/components/InsightsPanel.vue'

// Module-level mocks — hoisted by vitest before any import
vi.mock('../../src/composables/useInsights')

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({
    $gettext: (s: string) => s,
    $pgettext: (_ctx: string, s: string) => s
  })
}))

import { useInsights } from '../../src/composables/useInsights'
import type { InsightsResult } from '../../src/composables/useInsights'
import type { LLMConfig } from '../../src/composables/useLLM'

// Minimal OcButton stub that forwards click events
const OcButton = {
  name: 'OcButton',
  props: ['disabled', 'size', 'variant', 'appearance'],
  emits: ['click'],
  template: '<button :disabled="disabled" @click="!disabled && $emit(\'click\')"><slot /></button>'
}

const triggerInsightsMock = vi.fn()
const ensureReadyMock = vi.fn().mockResolvedValue(undefined)

function setupUseInsightsMock({
  isAnalyzing = false,
  insightsResult = null as InsightsResult | null,
  panelError = null as string | null
} = {}) {
  vi.mocked(useInsights).mockReturnValue({
    status: ref('ready' as const),
    isAnalyzing: ref(isAnalyzing),
    insightsResult: ref(insightsResult),
    panelError: ref(panelError),
    triggerInsights: triggerInsightsMock,
    ensureReady: ensureReadyMock
  })
}

function createWrapper(props: { llmConfig?: LLMConfig | null; resource?: object | null } = {}) {
  return mount(InsightsPanel, {
    props: { llmConfig: null, resource: null, ...props },
    global: {
      components: { OcButton },
      stubs: { OcButton: false }
    }
  })
}

describe('InsightsPanel', () => {
  beforeEach(() => {
    triggerInsightsMock.mockReset()
    ensureReadyMock.mockReset().mockResolvedValue(undefined)
    setupUseInsightsMock()
  })

  describe('analyzing state', () => {
    it('shows the analyzing placeholder when isAnalyzing is true', async () => {
      setupUseInsightsMock({ isAnalyzing: true })
      const wrapper = createWrapper()
      await flushPromises()
      const placeholder = wrapper.find('.ai-insights-placeholder')
      expect(placeholder.exists()).toBe(true)
      expect(placeholder.text()).toContain('Analyzing')
    })

    it('does not show the error element while analyzing', async () => {
      setupUseInsightsMock({ isAnalyzing: true })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.ai-insights-error').exists()).toBe(false)
    })

    it('does not show any buttons while analyzing', async () => {
      setupUseInsightsMock({ isAnalyzing: true })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.findAllComponents(OcButton)).toHaveLength(0)
    })
  })

  describe('error state', () => {
    it('shows the error message in .ai-insights-error', async () => {
      setupUseInsightsMock({ panelError: 'AI service unreachable.' })
      const wrapper = createWrapper()
      await flushPromises()
      const err = wrapper.find('.ai-insights-error')
      expect(err.exists()).toBe(true)
      expect(err.text()).toBe('AI service unreachable.')
    })

    it('renders the error with role="alert"', async () => {
      setupUseInsightsMock({ panelError: 'Something went wrong.' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    })

    it('does not show the Re-analyze button when panelError is set', async () => {
      const result: InsightsResult = { columnTypes: [], ranges: [], observations: [] }
      setupUseInsightsMock({ insightsResult: result, panelError: 'Error occurred.' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.oc-flex.oc-flex-right').exists()).toBe(false)
    })

    it('does not render the result table alongside the error', async () => {
      const result: InsightsResult = {
        columnTypes: [{ column: 'name', type: 'string' }],
        ranges: [],
        observations: []
      }
      setupUseInsightsMock({ insightsResult: result, panelError: 'LLM failed.' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.ai-insights-table').exists()).toBe(false)
    })
  })

  describe('result state', () => {
    const result: InsightsResult = {
      columnTypes: [
        { column: 'name', type: 'string' },
        { column: 'age', type: 'number' }
      ],
      ranges: [{ column: 'age', min: '20', max: '45' }],
      observations: ['The dataset has two columns.', 'Age values are numeric.']
    }

    it('renders the column type table', async () => {
      setupUseInsightsMock({ insightsResult: result })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.ai-insights-table').exists()).toBe(true)
      const rows = wrapper.findAll('.ai-insights-table tbody tr')
      expect(rows).toHaveLength(2)
    })

    it('renders the column name and type in each table row', async () => {
      setupUseInsightsMock({ insightsResult: result })
      const wrapper = createWrapper()
      await flushPromises()
      const firstRow = wrapper.findAll('.ai-insights-table tbody tr')[0]
      expect(firstRow.text()).toContain('name')
      expect(firstRow.text()).toContain('string')
    })

    it('renders the numeric range in the third column', async () => {
      setupUseInsightsMock({ insightsResult: result })
      const wrapper = createWrapper()
      await flushPromises()
      const secondRow = wrapper.findAll('.ai-insights-table tbody tr')[1]
      expect(secondRow.text()).toContain('20')
      expect(secondRow.text()).toContain('45')
    })

    it('renders observations as list items', async () => {
      setupUseInsightsMock({ insightsResult: result })
      const wrapper = createWrapper()
      await flushPromises()
      const items = wrapper.findAll('ul.oc-mt-s li')
      expect(items).toHaveLength(2)
      expect(items[0].text()).toBe('The dataset has two columns.')
      expect(items[1].text()).toBe('Age values are numeric.')
    })

    it('shows the Re-analyze button', async () => {
      setupUseInsightsMock({ insightsResult: result })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.oc-flex.oc-flex-right').exists()).toBe(true)
      expect(wrapper.find('.oc-flex.oc-flex-right').text()).toContain('Re-analyze')
    })

    it('calls triggerInsights when Re-analyze is clicked', async () => {
      setupUseInsightsMock({ insightsResult: result })
      const wrapper = createWrapper()
      await flushPromises()
      triggerInsightsMock.mockReset()
      await wrapper.findComponent(OcButton).trigger('click')
      expect(triggerInsightsMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('idle state', () => {
    it('shows the description and Analyze button before any analysis', async () => {
      setupUseInsightsMock()
      const wrapper = createWrapper()
      await flushPromises()
      const idle = wrapper.find('.oc-flex.oc-flex-center')
      expect(idle.exists()).toBe(true)
      expect(idle.find('p').text()).toContain('Analyze')
    })

    it('shows the Analyze button in the idle state', async () => {
      setupUseInsightsMock()
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.findComponent(OcButton).text()).toBe('Analyze')
    })

    it('calls triggerInsights when Analyze is clicked', async () => {
      setupUseInsightsMock()
      const wrapper = createWrapper()
      await flushPromises()
      await wrapper.findComponent(OcButton).trigger('click')
      expect(triggerInsightsMock).toHaveBeenCalledTimes(1)
    })

    it('does not show the Re-analyze button in idle state', async () => {
      setupUseInsightsMock()
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.oc-flex.oc-flex-right').exists()).toBe(false)
    })
  })

  describe('lifecycle', () => {
    it('calls ensureReady on mount', async () => {
      setupUseInsightsMock()
      createWrapper()
      await flushPromises()
      expect(ensureReadyMock).toHaveBeenCalledTimes(1)
    })

    it('does not auto-trigger analysis on mount', async () => {
      setupUseInsightsMock()
      createWrapper()
      await flushPromises()
      expect(triggerInsightsMock).not.toHaveBeenCalled()
    })

    it('passes llmConfig and resource props to useInsights', async () => {
      const llmConfig: LLMConfig = { endpoint: 'http://llm.local/v1', model: 'gpt-4' }
      const resource = { id: 'file-1', extension: 'csv', name: 'data.csv' }
      setupUseInsightsMock()
      createWrapper({ llmConfig, resource })
      await flushPromises()
      expect(vi.mocked(useInsights)).toHaveBeenCalledWith(
        llmConfig,
        expect.objectContaining({ value: resource })
      )
    })

    it('passes null as llmConfig when prop is not provided', async () => {
      setupUseInsightsMock()
      createWrapper()
      await flushPromises()
      expect(vi.mocked(useInsights)).toHaveBeenCalledWith(
        null,
        expect.anything()
      )
    })
  })
})
