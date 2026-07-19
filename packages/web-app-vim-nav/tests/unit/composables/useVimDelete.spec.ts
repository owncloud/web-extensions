import { describe, it, expect, vi } from 'vitest'
import { defaultComponentMocks, defaultPlugins, mount } from '@ownclouders/web-test-helpers'
import { useResourcesStore, useFileActionsDelete } from '@ownclouders/web-pkg'
import { useVimDelete } from '../../../src/composables/useVimDelete'
import { computed, defineComponent, h } from 'vue'
import { mock } from 'vitest-mock-extended'
import { Resource, SpaceResource } from '@ownclouders/web-client'

vi.mock('@ownclouders/web-pkg', async () => {
  const actual = await vi.importActual<object>('@ownclouders/web-pkg')
  return {
    ...actual,
    useFileActionsDelete: vi.fn()
  }
})

const SPACE_ID = 'space-1'
const buildResource = (id: string): Resource => mock<Resource>({ id })

function setup({
  resources = [],
  selectedIds = [],
  currentSpace = mock<SpaceResource>({ id: SPACE_ID }),
  deleteHandler = vi.fn().mockResolvedValue(undefined)
}: {
  resources?: Resource[]
  selectedIds?: string[]
  currentSpace?: SpaceResource
  deleteHandler?: ReturnType<typeof vi.fn>
} = {}) {
  vi.mocked(useFileActionsDelete).mockReturnValue({
    actions: computed(() => [{ name: 'delete', handler: deleteHandler }])
  } as unknown as ReturnType<typeof useFileActionsDelete>)

  const mocks = defaultComponentMocks()
  let resourcesStore: ReturnType<typeof useResourcesStore>
  let vimDelete: ReturnType<typeof useVimDelete>

  const Wrapper = defineComponent({
    setup() {
      resourcesStore = useResourcesStore()
      vimDelete = useVimDelete()
      return () => h('div')
    }
  })

  mount(Wrapper, {
    global: {
      plugins: [
        ...defaultPlugins({
          piniaOptions: {
            stubActions: false,
            resourcesStore: { resources },
            spacesState: { currentSpace, spaces: [currentSpace] }
          }
        })
      ],
      mocks,
      provide: mocks
    }
  })

  if (selectedIds.length) {
    resourcesStore.setSelection(selectedIds)
  }

  return { vimDelete, deleteHandler, currentSpace }
}

describe('useVimDelete', () => {
  it('invokes the delete action handler with the current space and selected resources', async () => {
    const resource = buildResource('a')
    const { vimDelete, deleteHandler, currentSpace } = setup({
      resources: [resource],
      selectedIds: ['a']
    })

    await vimDelete.deleteSelected()

    expect(deleteHandler).toHaveBeenCalledWith({ space: currentSpace, resources: [resource] })
  })

  it('does nothing when there is no selection', async () => {
    const { vimDelete, deleteHandler } = setup()

    await vimDelete.deleteSelected()

    expect(deleteHandler).not.toHaveBeenCalled()
  })
})
