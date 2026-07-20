import { describe, it, expect, afterEach } from 'vitest'
import { defaultComponentMocks, defaultPlugins, mount } from '@ownclouders/web-test-helpers'
import { useResourcesStore } from '@ownclouders/web-pkg'
import { useVimNavigation } from '../../../src/composables/useVimNavigation'
import { defineComponent, h } from 'vue'
import { mock } from 'vitest-mock-extended'
import { Resource } from '@ownclouders/web-client'

const buildResource = (id: string): Resource => mock<Resource>({ id })

function seedRenderedResources(ids: string[]) {
  const rows = ids.map((id) => `<div data-item-id="${id}"></div>`).join('')
  document.body.innerHTML = `<div id="files-view">${rows}</div>`
}

afterEach(() => {
  document.body.innerHTML = ''
})

function setup({
  renderedIds = [],
  selectedIds = []
}: {
  renderedIds?: string[]
  selectedIds?: string[]
} = {}) {
  seedRenderedResources(renderedIds)

  const mocks = defaultComponentMocks()
  let resourcesStore: ReturnType<typeof useResourcesStore>
  let vimNavigation: ReturnType<typeof useVimNavigation>

  const Wrapper = defineComponent({
    setup() {
      resourcesStore = useResourcesStore()
      vimNavigation = useVimNavigation()
      return () => h('div')
    }
  })

  mount(Wrapper, {
    global: {
      plugins: [
        ...defaultPlugins({
          piniaOptions: {
            stubActions: false,
            resourcesStore: { resources: renderedIds.map(buildResource) }
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

  return { vimNavigation, resourcesStore }
}

describe('useVimNavigation', () => {
  it('moveDown selects the first resource when nothing is selected', async () => {
    const { vimNavigation, resourcesStore } = setup({ renderedIds: ['a', 'b'] })

    await vimNavigation.moveDown()

    expect(resourcesStore.selectedIds).toEqual(['a'])
  })

  it('moveDown selects the next resource in rendered (DOM) order', async () => {
    const { vimNavigation, resourcesStore } = setup({
      renderedIds: ['a', 'b', 'c'],
      selectedIds: ['a']
    })

    await vimNavigation.moveDown()

    expect(resourcesStore.selectedIds).toEqual(['b'])
  })

  it('moveDown stays on the last resource', async () => {
    const { vimNavigation, resourcesStore } = setup({
      renderedIds: ['a', 'b'],
      selectedIds: ['b']
    })

    await vimNavigation.moveDown()

    expect(resourcesStore.selectedIds).toEqual(['b'])
  })

  it('moveUp selects the previous resource in rendered (DOM) order', async () => {
    const { vimNavigation, resourcesStore } = setup({
      renderedIds: ['a', 'b', 'c'],
      selectedIds: ['c']
    })

    await vimNavigation.moveUp()

    expect(resourcesStore.selectedIds).toEqual(['b'])
  })

  it('moveUp stays on the first resource', async () => {
    const { vimNavigation, resourcesStore } = setup({
      renderedIds: ['a', 'b'],
      selectedIds: ['a']
    })

    await vimNavigation.moveUp()

    expect(resourcesStore.selectedIds).toEqual(['a'])
  })

  it('moveDown falls back to the first resource when the current selection is not rendered', async () => {
    const { vimNavigation, resourcesStore } = setup({
      renderedIds: ['a', 'b'],
      selectedIds: ['deleted']
    })

    await vimNavigation.moveDown()

    expect(resourcesStore.selectedIds).toEqual(['a'])
  })

  it('follows DOM order even when it differs from store/array order', async () => {
    const { vimNavigation, resourcesStore } = setup({
      renderedIds: ['c', 'a', 'b'],
      selectedIds: ['c']
    })

    await vimNavigation.moveDown()

    expect(resourcesStore.selectedIds).toEqual(['a'])
  })

  it('jumpToFirst selects the first rendered resource', async () => {
    const { vimNavigation, resourcesStore } = setup({
      renderedIds: ['a', 'b', 'c'],
      selectedIds: ['c']
    })

    await vimNavigation.jumpToFirst()

    expect(resourcesStore.selectedIds).toEqual(['a'])
  })

  it('jumpToLast selects the last rendered resource', async () => {
    const { vimNavigation, resourcesStore } = setup({
      renderedIds: ['a', 'b', 'c'],
      selectedIds: ['a']
    })

    await vimNavigation.jumpToLast()

    expect(resourcesStore.selectedIds).toEqual(['c'])
  })

  it('moveDown does nothing when no resources are rendered', async () => {
    const { vimNavigation, resourcesStore } = setup()

    await vimNavigation.moveDown()

    expect(resourcesStore.selectedIds).toEqual([])
  })

  it('jumpToFirst does nothing when no resources are rendered', async () => {
    const { vimNavigation, resourcesStore } = setup()

    await vimNavigation.jumpToFirst()

    expect(resourcesStore.selectedIds).toEqual([])
  })
})
