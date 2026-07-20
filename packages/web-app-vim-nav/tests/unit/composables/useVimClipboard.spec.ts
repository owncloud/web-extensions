import { describe, it, expect, vi } from 'vitest'
import { defaultComponentMocks, defaultPlugins, mount } from '@ownclouders/web-test-helpers'
import { useResourcesStore, useClipboardStore, useFileActionsPaste } from '@ownclouders/web-pkg'
import { useVimClipboard } from '../../../src/composables/useVimClipboard'
import { computed, defineComponent, h } from 'vue'
import { mock } from 'vitest-mock-extended'
import { Resource, SpaceResource } from '@ownclouders/web-client'

vi.mock('@ownclouders/web-pkg', async () => {
  const actual = await vi.importActual<object>('@ownclouders/web-pkg')
  return {
    ...actual,
    useFileActionsPaste: vi.fn()
  }
})

const SPACE_ID = 'space-1'

const buildResource = (id: string): Resource =>
  mock<Resource>({ id, path: `/${id}`, spaceId: SPACE_ID, canDownload: () => true })

function setup({
  resources = [],
  selectedIds = [],
  clipboardResources = [],
  currentSpace = mock<SpaceResource>({ id: SPACE_ID }),
  pasteHandler = vi.fn().mockResolvedValue(undefined)
}: {
  resources?: Resource[]
  selectedIds?: string[]
  clipboardResources?: Resource[]
  currentSpace?: SpaceResource
  pasteHandler?: ReturnType<typeof vi.fn>
} = {}) {
  vi.mocked(useFileActionsPaste).mockReturnValue({
    actions: computed(() => [{ name: 'paste', handler: pasteHandler }])
  } as unknown as ReturnType<typeof useFileActionsPaste>)

  const mocks = defaultComponentMocks()
  let resourcesStore: ReturnType<typeof useResourcesStore>
  let clipboardStore: ReturnType<typeof useClipboardStore>
  let clipboard: ReturnType<typeof useVimClipboard>

  const Wrapper = defineComponent({
    setup() {
      resourcesStore = useResourcesStore()
      clipboardStore = useClipboardStore()
      clipboard = useVimClipboard()
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
            clipboardState: { resources: clipboardResources },
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

  return { resourcesStore, clipboardStore, clipboard, pasteHandler, currentSpace }
}

describe('useVimClipboard', () => {
  it('yank copies the current selection into the clipboard store', () => {
    const resource = buildResource('a')
    const { clipboardStore, clipboard } = setup({ resources: [resource], selectedIds: ['a'] })

    clipboard.yank()

    expect(clipboardStore.resources).toEqual([resource])
  })

  it('cut moves the current selection into the clipboard store in cut mode', () => {
    const resource = buildResource('a')
    const { clipboardStore, clipboard } = setup({ resources: [resource], selectedIds: ['a'] })

    clipboard.cut()

    expect(clipboardStore.resources).toEqual([resource])
    expect(clipboardStore.action).toBe('cut')
  })

  it('yank does nothing when there is no selection', () => {
    const { clipboardStore, clipboard } = setup()

    clipboard.yank()

    expect(clipboardStore.resources).toEqual([])
  })

  it('paste invokes the paste action handler with the current space', async () => {
    const clipboardResource = buildResource('z')
    const { clipboard, pasteHandler, currentSpace } = setup({ clipboardResources: [clipboardResource] })

    await clipboard.paste()

    expect(pasteHandler).toHaveBeenCalledWith({ space: currentSpace, resources: [] })
  })

  it('paste does nothing when the clipboard is empty', async () => {
    const { clipboard, pasteHandler } = setup({ clipboardResources: [] })

    await clipboard.paste()

    expect(pasteHandler).not.toHaveBeenCalled()
  })
})
