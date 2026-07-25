import { describe, it, expect, beforeEach } from 'vitest'
import { defaultComponentMocks, defaultPlugins, mount } from '@ownclouders/web-test-helpers'
import { useResourcesStore, useSideBar } from '@ownclouders/web-pkg'
import { useVimDetails } from '../../../src/composables/useVimDetails'
import { defineComponent, h } from 'vue'
import { mock } from 'vitest-mock-extended'
import { Resource } from '@ownclouders/web-client'

const buildResource = (id: string): Resource => mock<Resource>({ id, path: `/${id}` })

function setup({ resources = [], selectedIds = [] }: { resources?: Resource[]; selectedIds?: string[] } = {}) {
  const mocks = defaultComponentMocks()
  let resourcesStore: ReturnType<typeof useResourcesStore>
  let sideBar: ReturnType<typeof useSideBar>
  let details: ReturnType<typeof useVimDetails>

  const Wrapper = defineComponent({
    setup() {
      resourcesStore = useResourcesStore()
      sideBar = useSideBar()
      details = useVimDetails()
      return () => h('div')
    }
  })

  mount(Wrapper, {
    global: {
      plugins: [
        ...defaultPlugins({
          piniaOptions: { stubActions: false, resourcesStore: { resources } }
        })
      ],
      mocks,
      provide: mocks
    }
  })

  if (selectedIds.length) {
    resourcesStore.setSelection(selectedIds)
  }

  return { resourcesStore, sideBar, details }
}

describe('useVimDetails', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('opens the sidebar on the details panel for the selected resource', () => {
    const resource = buildResource('a')
    const { sideBar, details } = setup({ resources: [resource], selectedIds: ['a'] })

    details.toggleDetails()

    expect(sideBar.isSideBarOpen.value).toBe(true)
    expect(sideBar.sideBarActivePanel.value).toBe('details')
  })

  it('does nothing when there is no selection', () => {
    const { sideBar, details } = setup()

    details.toggleDetails()

    expect(sideBar.isSideBarOpen.value).toBe(false)
  })

  it('closes the sidebar when the details panel is already open', () => {
    const resource = buildResource('a')
    const { sideBar, details } = setup({ resources: [resource], selectedIds: ['a'] })

    details.toggleDetails()
    expect(sideBar.isSideBarOpen.value).toBe(true)

    details.toggleDetails()

    expect(sideBar.isSideBarOpen.value).toBe(false)
  })
})
