import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import ProjectBoardView from '../../src/components/ProjectBoardView.vue'

// Module-level mocks — hoisted by vitest before any import
vi.mock('../../src/composables/useBoardClassification')

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({
    $gettext: (s: string) => s,
    $pgettext: (_ctx: string, s: string) => s
  })
}))

import { useBoardClassification } from '../../src/composables/useBoardClassification'
import type { BoardLanes, UseBoardClassificationResult } from '../../src/composables/useBoardClassification'
import type { LLMConfig, LLMStatus } from '../../src/composables/useLLM'
import type { Resource } from '@ownclouders/web-client'

// Minimal OcButton stub that forwards click events and respects disabled
const OcButton = {
  name: 'OcButton',
  props: ['disabled', 'size', 'variant', 'appearance'],
  emits: ['click'],
  template: '<button :disabled="disabled" @click="!disabled && $emit(\'click\')"><slot /></button>'
}

// Lightweight BoardLane stub — exposes the props ProjectBoardView passes down so we can assert
// lane placement/card content without rendering the real BoardCard/ResourceIcon tree.
const BoardLane = {
  name: 'BoardLane',
  props: ['lane', 'label', 'icon', 'resources'],
  template:
    '<section :data-testid="`board-lane-${lane}`"><span data-testid="board-lane-label">{{ label }}</span>' +
    '<div v-for="r in resources" :key="r.id" data-testid="board-lane-resource">{{ r.name }}</div></section>'
}

function makeFile(overrides: Partial<Resource> = {}): Resource {
  return { id: 'f1', name: 'roadmap.md', isFolder: false, ...overrides } as Resource
}

const EMPTY_LANES: BoardLanes = { draft: [], 'in-review': [], final: [] }

const classifyMock = vi.fn().mockResolvedValue(undefined)

function setupUseBoardClassificationMock({
  status = 'ready' as LLMStatus,
  isClassifying = false,
  lanes = EMPTY_LANES,
  panelError = null as string | null,
  truncated = false
} = {}) {
  vi.mocked(useBoardClassification).mockReturnValue({
    status: ref(status),
    lanes: computed(() => lanes),
    isClassifying: ref(isClassifying),
    panelError: ref(panelError),
    truncated: ref(truncated),
    classify: classifyMock
  } as UseBoardClassificationResult)
}

function createWrapper(props: { llmConfig?: LLMConfig | null } = {}) {
  return mount(ProjectBoardView, {
    props: { llmConfig: null, ...props },
    global: {
      components: { OcButton, BoardLane },
      stubs: { OcButton: false, BoardLane: false }
    }
  })
}

describe('ProjectBoardView', () => {
  beforeEach(() => {
    classifyMock.mockReset().mockResolvedValue(undefined)
    setupUseBoardClassificationMock()
  })

  describe('loading state', () => {
    it('shows the loading placeholder when isClassifying is true', async () => {
      setupUseBoardClassificationMock({ isClassifying: true })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('[data-testid="project-board-loading"]').exists()).toBe(true)
    })

    it('does not render lanes or the empty state while loading', async () => {
      setupUseBoardClassificationMock({ isClassifying: true })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('[data-testid="project-board-empty"]').exists()).toBe(false)
      expect(wrapper.findAllComponents(BoardLane)).toHaveLength(0)
    })
  })

  describe('empty state', () => {
    it('shows the empty placeholder when there are no files in any lane', async () => {
      setupUseBoardClassificationMock({ lanes: EMPTY_LANES })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('[data-testid="project-board-empty"]').exists()).toBe(true)
      expect(wrapper.findAllComponents(BoardLane)).toHaveLength(0)
    })
  })

  describe('error state', () => {
    it('renders panelError text with role="alert"', async () => {
      setupUseBoardClassificationMock({ panelError: 'The AI service is temporarily unavailable.' })
      const wrapper = createWrapper()
      await flushPromises()
      const err = wrapper.find('[data-testid="project-board-error"]')
      expect(err.exists()).toBe(true)
      expect(err.attributes('role')).toBe('alert')
      expect(err.text()).toBe('The AI service is temporarily unavailable.')
    })

    it('does not render the error element when panelError is null', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('[data-testid="project-board-error"]').exists()).toBe(false)
    })
  })

  describe('unconfigured / cross-origin notices', () => {
    it('shows the unconfigured notice when status is unconfigured', async () => {
      setupUseBoardClassificationMock({ status: 'unconfigured' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.text()).toContain('Configure an AI endpoint')
    })

    it('shows the cross-origin notice when status is cross-origin', async () => {
      setupUseBoardClassificationMock({ status: 'cross-origin' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.text()).toContain('same server as ownCloud')
    })

    it('shows the truncated notice with the file count when truncated is true', async () => {
      setupUseBoardClassificationMock({ truncated: true })
      const wrapper = createWrapper()
      await flushPromises()
      const notice = wrapper.find('[data-testid="project-board-truncated"]')
      expect(notice.exists()).toBe(true)
      expect(notice.text()).toContain('Only the first')
    })

    it('does not show the truncated notice when truncated is false', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('[data-testid="project-board-truncated"]').exists()).toBe(false)
    })
  })

  describe('three lanes render, cards placed correctly', () => {
    it('renders exactly three lanes in draft / in-review / final order', async () => {
      const lanes: BoardLanes = {
        draft: [makeFile({ id: 'd1', name: 'draft.md' })],
        'in-review': [makeFile({ id: 'r1', name: 'review.md' })],
        final: [makeFile({ id: 'f1', name: 'final.pdf' })]
      }
      setupUseBoardClassificationMock({ lanes })
      const wrapper = createWrapper()
      await flushPromises()

      const laneComponents = wrapper.findAllComponents(BoardLane)
      expect(laneComponents).toHaveLength(3)
      expect(laneComponents.map((c) => c.props('lane'))).toEqual(['draft', 'in-review', 'final'])
    })

    it('places each file under its own lane only', async () => {
      const lanes: BoardLanes = {
        draft: [makeFile({ id: 'd1', name: 'draft.md' })],
        'in-review': [makeFile({ id: 'r1', name: 'review.md' }), makeFile({ id: 'r2', name: 'review-2.md' })],
        final: []
      }
      setupUseBoardClassificationMock({ lanes })
      const wrapper = createWrapper()
      await flushPromises()

      const draftLane = wrapper.find('[data-testid="board-lane-draft"]')
      expect(draftLane.text()).toContain('draft.md')
      expect(draftLane.text()).not.toContain('review.md')

      const reviewLane = wrapper.find('[data-testid="board-lane-in-review"]')
      expect(reviewLane.text()).toContain('review.md')
      expect(reviewLane.text()).toContain('review-2.md')

      const finalLane = wrapper.find('[data-testid="board-lane-final"]')
      expect(finalLane.findAll('[data-testid="board-lane-resource"]')).toHaveLength(0)
    })

    it('passes the translated lane label down to each BoardLane', async () => {
      const lanes: BoardLanes = { draft: [makeFile()], 'in-review': [], final: [] }
      setupUseBoardClassificationMock({ lanes })
      const wrapper = createWrapper()
      await flushPromises()

      const draftLane = wrapper.findAllComponents(BoardLane).find((c) => c.props('lane') === 'draft')
      expect(draftLane?.props('label')).toBe('Draft')
    })
  })

  describe('re-run button behavior', () => {
    it('calls classify once automatically on mount', async () => {
      createWrapper()
      await flushPromises()
      expect(classifyMock).toHaveBeenCalledTimes(1)
    })

    it('calls classify again when the re-run button is clicked', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      classifyMock.mockClear()
      await wrapper.find('[data-testid="project-board-rerun"]').trigger('click')
      expect(classifyMock).toHaveBeenCalledTimes(1)
    })

    it('disables the re-run button while classifying', async () => {
      setupUseBoardClassificationMock({ isClassifying: true })
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('[data-testid="project-board-rerun"]')
      expect(button.attributes('disabled')).not.toBeUndefined()
    })

    it('disables the re-run button when the LLM status is not ready', async () => {
      setupUseBoardClassificationMock({ status: 'unconfigured' })
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('[data-testid="project-board-rerun"]')
      expect(button.attributes('disabled')).not.toBeUndefined()
    })

    it('enables the re-run button when ready and not classifying', async () => {
      const wrapper = createWrapper()
      await flushPromises()
      const button = wrapper.find('[data-testid="project-board-rerun"]')
      expect(button.attributes('disabled')).toBeUndefined()
    })

    it('does not call classify again when a disabled re-run button is clicked', async () => {
      setupUseBoardClassificationMock({ isClassifying: true })
      const wrapper = createWrapper()
      await flushPromises()
      classifyMock.mockClear()
      await wrapper.find('[data-testid="project-board-rerun"]').trigger('click')
      expect(classifyMock).not.toHaveBeenCalled()
    })
  })
})
