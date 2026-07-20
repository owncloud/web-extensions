import { unref } from 'vue'
import { useResourcesStore, useClipboardStore, useSpacesStore, useFileActionsPaste } from '@ownclouders/web-pkg'

export function useVimClipboard() {
  const resourcesStore = useResourcesStore()
  const clipboardStore = useClipboardStore()
  const spacesStore = useSpacesStore()
  const { actions: pasteActions } = useFileActionsPaste()

  const yank = () => {
    const resources = unref(resourcesStore.selectedResources)
    if (!resources.length) {
      return
    }
    clipboardStore.copyResources(resources)
  }

  const cut = () => {
    const resources = unref(resourcesStore.selectedResources)
    if (!resources.length) {
      return
    }
    clipboardStore.cutResources(resources)
  }

  const paste = async () => {
    if (!unref(clipboardStore.resources).length) {
      return
    }
    const pasteAction = unref(pasteActions).find((a) => a.name === 'paste')
    if (!pasteAction) {
      return
    }
    await pasteAction.handler({ space: unref(spacesStore.currentSpace), resources: [] })
  }

  return { yank, cut, paste }
}
