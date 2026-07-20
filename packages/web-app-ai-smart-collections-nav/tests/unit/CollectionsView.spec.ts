import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import CollectionsView from '../../src/views/CollectionsView.vue'
import CollectionFileList from '../../src/components/CollectionFileList.vue'
import ConsentDialog from '../../src/components/ConsentDialog.vue'

vi.mock('../../src/composables/useRecentFiles')
vi.mock('../../src/composables/useCollections')

function interpolate(str: string, params?: Record<string, string>): string {
  if (!params) return str
  return str.replace(/%\{(\w+)\}/g, (_, key) => params[key] ?? '')
}

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({
    $gettext: (s: string, params?: Record<string, string>) => interpolate(s, params),
    $ngettext: (singular: string, plural: string, n: number, params?: Record<string, string>) =>
      interpolate(n === 1 ? singular : plural, params),
    $pgettext: (_context: string, s: string, params?: Record<string, string>) => interpolate(s, params)
  })
}))

import { useRecentFiles } from '../../src/composables/useRecentFiles'
import { useCollections } from '../../src/composables/useCollections'
import { _resetSessionConsentForTesting } from '../../src/composables/useConsent'
import type { RecentFile } from '../../src/composables/useRecentFiles'
import type { Collection } from '../../src/composables/useCollections'
import type { LLMStatus } from '../../src/composables/useLLM'

// Minimal OcButton stub that forwards click events, mirroring InsightsPanel.spec.ts's pattern.
const OcButton = {
  name: 'OcButton',
  props: ['size', 'variant', 'appearance'],
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>'
}

function makeFile(overrides: Partial<RecentFile> = {}): RecentFile {
  return {
    fileId: 'f1',
    name: 'invoice.pdf',
    path: '/invoice.pdf',
    storageId: 'space-1',
    spaceId: 'space-1',
    mdate: 'Mon, 01 Jan 2024 00:00:00 GMT',
    size: 1024,
    ...overrides
  }
}

const fetchRecentFilesMock = vi.fn()
function setupRecentFiles({
  isLoading = false,
  error = null as string | null,
  files = [] as RecentFile[]
} = {}) {
  fetchRecentFilesMock.mockReset().mockResolvedValue(files)
  vi.mocked(useRecentFiles).mockReturnValue({
    isLoading: ref(isLoading),
    error: ref(error),
    fetchRecentFiles: fetchRecentFilesMock
  })
}

const clusterFilesMock = vi.fn()
function setupCollections({
  // Defaults to 'unconfigured', which makes startClustering() skip the consent dialog
  // entirely and call clusterFiles() directly — most tests don't care about consent gating.
  // Tests that do (see the 'consent gating' describe block) pass status: 'ready' explicitly
  // and reset useConsent's real, module-scoped flag via _resetSessionConsentForTesting.
  status = 'unconfigured' as LLMStatus,
  isClustering = false,
  collections = [] as Collection[],
  clusterError = null as string | null
} = {}) {
  clusterFilesMock.mockReset().mockResolvedValue(undefined)
  vi.mocked(useCollections).mockReturnValue({
    status: ref(status),
    isClustering: ref(isClustering),
    collections: ref(collections),
    clusterError: ref(clusterError),
    clusterFiles: clusterFilesMock
  })
}

function createWrapper() {
  return mount(CollectionsView, {
    global: {
      components: { OcButton },
      stubs: { OcButton: false }
    }
  })
}

beforeEach(() => {
  setupRecentFiles()
  setupCollections()
  _resetSessionConsentForTesting()
})

describe('CollectionsView', () => {
  describe('loading states', () => {
    it('shows a spinner and "looking for recent files" message while files are loading', async () => {
      setupRecentFiles({ isLoading: true })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('oc-spinner').exists()).toBe(true)
      expect(wrapper.text()).toContain('Looking for your recent files')
    })

    it('shows a spinner and "grouping files" message while clustering', async () => {
      setupRecentFiles({ files: [makeFile()] })
      setupCollections({ isClustering: true })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('oc-spinner').exists()).toBe(true)
      expect(wrapper.text()).toContain('Grouping your files into collections')
    })
  })

  describe('error state', () => {
    it('shows the files error message with a Retry button', async () => {
      setupRecentFiles({ error: 'Something went wrong while listing recent files.' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('[role="alert"]').text()).toContain(
        'Something went wrong while listing recent files.'
      )
      expect(wrapper.findComponent(OcButton).text()).toContain('Retry')
    })

    it('re-fetches recent files when Retry is clicked', async () => {
      setupRecentFiles({ error: 'boom' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(fetchRecentFilesMock).toHaveBeenCalledTimes(1)
      await wrapper.findComponent(OcButton).trigger('click')
      await flushPromises()
      expect(fetchRecentFilesMock).toHaveBeenCalledTimes(2)
    })

    it('shows the cluster error message when file listing succeeded but clustering failed', async () => {
      setupRecentFiles({ files: [makeFile()] })
      setupCollections({ clusterError: 'Admin needs to configure the AI endpoint.' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('[role="alert"]').text()).toContain('Admin needs to configure the AI endpoint.')
    })
  })

  describe('empty states', () => {
    it('shows a "no recent files" message when no files were found', async () => {
      setupRecentFiles({ files: [] })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.text()).toContain('No recent files were found to group into collections.')
    })

    it('shows a "no collections could be inferred" message when files exist but clustering produced nothing', async () => {
      setupRecentFiles({ files: [makeFile()] })
      setupCollections({ collections: [] })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.text()).toContain('No collections could be inferred from your recent files.')
    })
  })

  describe('collection grid', () => {
    const files = [
      makeFile({ fileId: 'a', name: 'invoice-1.pdf' }),
      makeFile({ fileId: 'b', name: 'invoice-2.pdf' }),
      makeFile({ fileId: 'c', name: 'contract.pdf' })
    ]
    const collections: Collection[] = [
      { label: 'Invoices', fileIds: ['a', 'b'] },
      { label: 'Contracts', fileIds: ['c'] }
    ]

    it('renders one CollectionCard per collection with its label and file count', async () => {
      setupRecentFiles({ files })
      setupCollections({ collections })
      const wrapper = createWrapper()
      await flushPromises()

      const labels = wrapper.findAll('.collection-card-label').map((el) => el.text())
      expect(labels).toEqual(['Invoices', 'Contracts'])
      const counts = wrapper.findAll('.collection-card-count').map((el) => el.text())
      expect(counts).toEqual(['2 files', '1 file'])
    })

    it('filters to the selected collection\'s files when its card is clicked', async () => {
      setupRecentFiles({ files })
      setupCollections({ collections })
      const wrapper = createWrapper()
      await flushPromises()

      await wrapper.find('.collection-card').trigger('click')
      await flushPromises()

      expect(wrapper.find('.collections-grid').exists()).toBe(false)
      expect(wrapper.text()).toContain('invoice-1.pdf')
      expect(wrapper.text()).toContain('invoice-2.pdf')
      expect(wrapper.text()).not.toContain('contract.pdf')
    })

    it('returns to the grid when CollectionFileList emits "back"', async () => {
      setupRecentFiles({ files })
      setupCollections({ collections })
      const wrapper = createWrapper()
      await flushPromises()

      await wrapper.find('.collection-card').trigger('click')
      await flushPromises()
      expect(wrapper.find('.collections-grid').exists()).toBe(false)

      // CollectionsView.vue wires the back button's click through CollectionFileList's own
      // "back" emit (`@back="backToGrid"`); emitting it directly here keeps this test focused
      // on that wiring rather than on CollectionFileList's internal button markup.
      await wrapper.findComponent(CollectionFileList).vm.$emit('back')
      await flushPromises()

      expect(wrapper.find('.collections-grid').exists()).toBe(true)
      expect(wrapper.findAll('.collection-card')).toHaveLength(2)
    })

    it('renders the grid alongside an inline error notice when partial results and a cluster error are both present', async () => {
      setupRecentFiles({ files })
      setupCollections({ collections, clusterError: 'Some files could not be grouped: boom' })
      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.find('.collections-grid').exists()).toBe(true)
      expect(wrapper.findAll('.collection-card')).toHaveLength(2)
      expect(wrapper.find('.collections-view-inline-error').text()).toContain(
        'Some files could not be grouped: boom'
      )
    })
  })

  describe('consent gating', () => {
    it('shows the consent dialog and does not call clusterFiles before consent is given', async () => {
      setupRecentFiles({ files: [makeFile()] })
      setupCollections({ status: 'ready' })
      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.findComponent(ConsentDialog).exists()).toBe(true)
      expect(clusterFilesMock).not.toHaveBeenCalled()
    })

    it('does not call clusterFiles when consent is denied, and shows the cancelled message', async () => {
      setupRecentFiles({ files: [makeFile()] })
      setupCollections({ status: 'ready' })
      const wrapper = createWrapper()
      await flushPromises()

      await wrapper.findComponent(ConsentDialog).vm.$emit('deny')
      await flushPromises()

      expect(clusterFilesMock).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('Grouping was cancelled. No file data was sent to the AI service.')
    })

    it('calls clusterFiles after consent is confirmed', async () => {
      setupRecentFiles({ files: [makeFile()] })
      setupCollections({ status: 'ready' })
      const wrapper = createWrapper()
      await flushPromises()

      await wrapper.findComponent(ConsentDialog).vm.$emit('confirm')
      await flushPromises()

      expect(clusterFilesMock).toHaveBeenCalledTimes(1)
    })
  })
})
