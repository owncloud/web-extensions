import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import DraftCreatorModal from '../../../src/components/DraftCreatorModal.vue'

vi.mock('../../../src/composables/useDraftCreator')

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({
    $gettext: (s: string) => s,
    $pgettext: (_context: string, s: string) => s
  })
}))

vi.mock('@ownclouders/web-pkg', () => ({
  useFileActions: () => ({ triggerDefaultAction: vi.fn() })
}))

import { useDraftCreator } from '../../../src/composables/useDraftCreator.js'
import type { CreatedDraft, DraftFormat } from '../../../src/composables/useDraftCreator.js'
import type { LLMConfig } from '../../../src/composables/useLLM.js'

const createDraftMock = vi.fn()

function setupUseDraftCreatorMock({
  creating = false,
  error = null as string | null
} = {}) {
  vi.mocked(useDraftCreator).mockReturnValue({
    creating: ref(creating),
    error: ref(error),
    canCreate: vi.fn().mockReturnValue(true),
    createDraft: createDraftMock
  })
}

function createWrapper(props: { llmConfig?: LLMConfig | null } = {}) {
  return mount(DraftCreatorModal, {
    props: {
      llmConfig: null,
      ...props
    }
  })
}

describe('DraftCreatorModal', () => {
  beforeEach(() => {
    createDraftMock.mockReset().mockResolvedValue(null as unknown as CreatedDraft | null)
    setupUseDraftCreatorMock()
  })

  describe('error state', () => {
    it('does not show an error banner when there is no error', async () => {
      setupUseDraftCreatorMock({ error: null })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.draft-creator-modal__error').exists()).toBe(false)
    })

    it('shows the error message returned by the composable', async () => {
      setupUseDraftCreatorMock({ error: 'signal timed out' })
      const wrapper = createWrapper()
      await flushPromises()
      const banner = wrapper.find('.draft-creator-modal__error')
      expect(banner.exists()).toBe(true)
      expect(banner.text()).toBe('signal timed out')
    })

    it('assigns role="alert" to the error element', async () => {
      setupUseDraftCreatorMock({ error: 'signal timed out' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    })

    it('renders the error after the description and format fields, and before the actions', async () => {
      setupUseDraftCreatorMock({ error: 'signal timed out' })
      const wrapper = createWrapper()
      await flushPromises()

      const children = Array.from(wrapper.element.children) as Element[]
      const descriptionIndex = children.findIndex((el) =>
        el.querySelector('[data-testid="draft-description"]')
      )
      const errorIndex = children.findIndex((el) => el.classList.contains('draft-creator-modal__error'))
      const actionsIndex = children.findIndex((el) =>
        el.classList.contains('draft-creator-modal__actions')
      )

      expect(descriptionIndex).toBeGreaterThanOrEqual(0)
      expect(errorIndex).toBeGreaterThan(descriptionIndex)
      expect(actionsIndex).toBeGreaterThan(errorIndex)
    })
  })

  describe('create draft', () => {
    it('calls createDraft with the trimmed description and selected format', async () => {
      setupUseDraftCreatorMock()
      const wrapper = createWrapper()
      await flushPromises()

      await wrapper.find('[data-testid="draft-description"]').setValue('  A budget review  ')
      await wrapper.find<HTMLButtonElement>('[data-testid="draft-create"]').trigger('click')
      await flushPromises()

      expect(createDraftMock).toHaveBeenCalledWith('A budget review', 'markdown' as DraftFormat)
    })
  })
})
