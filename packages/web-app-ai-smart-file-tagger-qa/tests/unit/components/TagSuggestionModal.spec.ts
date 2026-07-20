import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import TagSuggestionModal from '../../../src/components/TagSuggestionModal.vue'

vi.mock('../../../src/composables/useTagSuggestions')

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({
    $gettext: (s: string) => s,
    $pgettext: (_context: string, s: string) => s
  })
}))

import { useTagSuggestions } from '../../../src/composables/useTagSuggestions.js'
import type {
  TagSuggestionsStatus,
  TagSuggestion,
  TagResource
} from '../../../src/composables/useTagSuggestions.js'
import type { LLMConfig } from '../../../src/composables/useLLM.js'

const fetchSuggestionsMock = vi.fn().mockResolvedValue(undefined)
const applyTagsMock = vi.fn().mockResolvedValue(undefined)

function setupUseTagSuggestionsMock({
  status = 'unconfigured' as TagSuggestionsStatus,
  tags = [] as TagSuggestion[],
  isGenerating = false,
  error = null as string | null
} = {}) {
  vi.mocked(useTagSuggestions).mockReturnValue({
    status: ref(status),
    tags: ref(tags),
    isGenerating: ref(isGenerating),
    error: ref(error),
    fetchSuggestions: fetchSuggestionsMock,
    applyTags: applyTagsMock
  })
}

function createWrapper(
  props: {
    resource?: TagResource | null
    llmConfig?: LLMConfig | null
    modal?: { id: string; title: string }
  } = {}
) {
  return mount(TagSuggestionModal, {
    props: {
      resource: null,
      llmConfig: null,
      ...props
    }
  })
}

describe('TagSuggestionModal', () => {
  beforeEach(() => {
    fetchSuggestionsMock.mockReset().mockResolvedValue(undefined)
    applyTagsMock.mockReset().mockResolvedValue(undefined)
    setupUseTagSuggestionsMock()
  })

  describe('unconfigured state', () => {
    it('shows an info message instead of a tooltip-style call to action when no LLM is configured', async () => {
      setupUseTagSuggestionsMock({ status: 'unconfigured' })
      const wrapper = createWrapper()
      await flushPromises()
      const placeholder = wrapper.find('.tag-suggestion-placeholder')
      expect(placeholder.exists()).toBe(true)
      expect(placeholder.text()).toContain('administrator')
    })

    it('does not fetch suggestions when unconfigured', async () => {
      setupUseTagSuggestionsMock({ status: 'unconfigured' })
      createWrapper()
      await flushPromises()
      expect(fetchSuggestionsMock).not.toHaveBeenCalled()
    })

    it('does not show the error banner or tag chips', async () => {
      setupUseTagSuggestionsMock({ status: 'unconfigured' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.tag-suggestion-error').exists()).toBe(false)
      expect(wrapper.find('[data-testid="tag-suggestion-chips"]').exists()).toBe(false)
    })
  })

  describe('loading state', () => {
    it('shows a spinner while suggestions are being generated', async () => {
      setupUseTagSuggestionsMock({ status: 'loading', isGenerating: true })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('[aria-label="Generating tag suggestions…"]').exists()).toBe(true)
    })

    it('calls fetchSuggestions on mount when an LLM is configured', async () => {
      setupUseTagSuggestionsMock({ status: 'loading', isGenerating: true })
      createWrapper()
      await flushPromises()
      expect(fetchSuggestionsMock).toHaveBeenCalledTimes(1)
    })

    it('keeps the modal-provided confirm action disabled while generating', async () => {
      setupUseTagSuggestionsMock({ status: 'loading', isGenerating: true })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.emitted('update:confirmDisabled')?.at(-1)).toEqual([true])
    })
  })

  describe('chip rendering', () => {
    const tags: TagSuggestion[] = [
      { name: 'invoice', confidence: 0.92, selected: true },
      { name: 'quarterly-report', confidence: null, selected: false }
    ]

    it('renders one chip per suggested tag', async () => {
      setupUseTagSuggestionsMock({ status: 'ready', tags })
      const wrapper = createWrapper()
      await flushPromises()
      const chips = wrapper.findAll('[data-testid="tag-suggestion-chips"] .tag-suggestion-chip')
      expect(chips).toHaveLength(2)
      expect(chips[0].text()).toContain('invoice')
      expect(chips[1].text()).toContain('quarterly-report')
    })

    it('shows a confidence badge only for tags that have a confidence score', async () => {
      setupUseTagSuggestionsMock({ status: 'ready', tags })
      const wrapper = createWrapper()
      await flushPromises()
      const chips = wrapper.findAll('[data-testid="tag-suggestion-chips"] .tag-suggestion-chip')
      expect(chips[0].find('.tag-suggestion-chip-confidence').exists()).toBe(true)
      expect(chips[0].find('.tag-suggestion-chip-confidence').text()).toBe('92%')
      expect(chips[1].find('.tag-suggestion-chip-confidence').exists()).toBe(false)
    })

    it('shows a placeholder when the LLM suggested no tags', async () => {
      setupUseTagSuggestionsMock({ status: 'ready', tags: [] })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.tag-suggestion-placeholder').text()).toContain('No tags were suggested')
    })
  })

  describe('chip toggle', () => {
    it('toggles a tag selected state when its chip is clicked', async () => {
      const tags: TagSuggestion[] = [{ name: 'invoice', confidence: 0.8, selected: false }]
      setupUseTagSuggestionsMock({ status: 'ready', tags })
      const wrapper = createWrapper()
      await flushPromises()

      const chip = wrapper.find('.tag-suggestion-chip')
      expect(chip.classes()).not.toContain('tag-suggestion-chip-selected')

      await chip.trigger('click')
      expect(tags[0].selected).toBe(true)
      expect(chip.classes()).toContain('tag-suggestion-chip-selected')

      await chip.trigger('click')
      expect(tags[0].selected).toBe(false)
      expect(chip.classes()).not.toContain('tag-suggestion-chip-selected')
    })
  })

  describe('confirm', () => {
    it('exposes onConfirm, which calls applyTags', async () => {
      const tags: TagSuggestion[] = [{ name: 'invoice', confidence: 0.8, selected: true }]
      setupUseTagSuggestionsMock({ status: 'ready', tags })
      const wrapper = createWrapper()
      await flushPromises()

      await (wrapper.vm as unknown as { onConfirm(): Promise<void> }).onConfirm()

      expect(applyTagsMock).toHaveBeenCalledTimes(1)
    })

    it('emits update:confirmDisabled(false) once a tag is selected', async () => {
      const tags: TagSuggestion[] = [{ name: 'invoice', confidence: 0.8, selected: false }]
      setupUseTagSuggestionsMock({ status: 'ready', tags })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.emitted('update:confirmDisabled')?.at(-1)).toEqual([true])

      await wrapper.find('.tag-suggestion-chip').trigger('click')

      expect(wrapper.emitted('update:confirmDisabled')?.at(-1)).toEqual([false])
    })

    it('keeps confirm disabled when no tags are selected', async () => {
      const tags: TagSuggestion[] = [{ name: 'invoice', confidence: 0.8, selected: false }]
      setupUseTagSuggestionsMock({ status: 'ready', tags })
      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.emitted('update:confirmDisabled')?.at(-1)).toEqual([true])
    })

    it('shows a fallback error and rethrows so the modal framework keeps the dialog open when applyTags rejects', async () => {
      const tags: TagSuggestion[] = [{ name: 'invoice', confidence: 0.8, selected: true }]
      applyTagsMock.mockRejectedValueOnce(new Error('Could not reach the AI service.'))
      setupUseTagSuggestionsMock({ status: 'ready', tags })
      const wrapper = createWrapper({ modal: { id: 'modal-2', title: 'Suggest Tags' } })
      await flushPromises()

      await expect(
        (wrapper.vm as unknown as { onConfirm(): Promise<void> }).onConfirm()
      ).rejects.toThrow('Could not reach the AI service.')
      await flushPromises()

      expect(wrapper.find('.tag-suggestion-error').text()).toBe('Could not reach the AI service.')
    })
  })

  describe('error banner', () => {
    it('shows the error message returned by the composable', async () => {
      setupUseTagSuggestionsMock({ status: 'error', error: 'Could not reach the AI service.' })
      const wrapper = createWrapper()
      await flushPromises()
      const banner = wrapper.find('.tag-suggestion-error')
      expect(banner.exists()).toBe(true)
      expect(banner.text()).toBe('Could not reach the AI service.')
    })

    it('does not render tag chips alongside the error', async () => {
      setupUseTagSuggestionsMock({
        status: 'error',
        error: 'Boom',
        tags: [{ name: 'invoice', confidence: null, selected: true }]
      })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('[data-testid="tag-suggestion-chips"]').exists()).toBe(false)
    })
  })
})
