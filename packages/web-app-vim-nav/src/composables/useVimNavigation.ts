import { nextTick, ref, unref } from 'vue'
import { useResourcesStore, useScrollTo, focusCheckbox } from '@ownclouders/web-pkg'

const TOPBAR_ELEMENT = 'files-app-bar'

export function useVimNavigation() {
  const resourcesStore = useResourcesStore()
  const { scrollToResource } = useScrollTo()

  const visualMode = ref(false)
  let visualAnchorId: string | null = null
  let visualCursorId: string | null = null

  const renderedResourceIds = (): string[] => {
    const activeIds = new Set(unref(resourcesStore.activeResources).map((r) => r.id))
    return Array.from(document.querySelectorAll('#files-view [data-item-id]'))
      .map((el) => el.getAttribute('data-item-id'))
      .filter((id) => activeIds.has(id))
  }

  const selectResource = async (id: string): Promise<void> => {
    resourcesStore.resetSelection()
    await nextTick()
    resourcesStore.addSelection(id)
    await nextTick()
    focusCheckbox(id)
    scrollToResource(id, { topbarElement: TOPBAR_ELEMENT })
  }

  const extendSelection = async (id: string): Promise<void> => {
    const ids = renderedResourceIds()
    const anchorIndex = ids.indexOf(visualAnchorId)
    const cursorIndex = ids.indexOf(id)
    if (anchorIndex === -1 || cursorIndex === -1) return

    const from = Math.min(anchorIndex, cursorIndex)
    const to = Math.max(anchorIndex, cursorIndex)
    const rangeIds = ids.slice(from, to + 1)

    resourcesStore.resetSelection()
    await nextTick()
    for (const rid of rangeIds) {
      resourcesStore.addSelection(rid)
    }
    await nextTick()
    focusCheckbox(id)
    scrollToResource(id, { topbarElement: TOPBAR_ELEMENT })
    visualCursorId = id
  }

  const move = async (offset: 1 | -1): Promise<void> => {
    const ids = renderedResourceIds()
    if (!ids.length) return

    if (unref(visualMode)) {
      const currentIndex = ids.indexOf(visualCursorId ?? visualAnchorId)
      const nextIndex =
        currentIndex === -1 ? 0 : Math.min(Math.max(currentIndex + offset, 0), ids.length - 1)
      await extendSelection(ids[nextIndex])
      return
    }

    const currentId = unref(resourcesStore.selectedResources)[0]?.id
    const currentIndex = ids.indexOf(currentId)
    const nextIndex =
      currentIndex === -1 ? 0 : Math.min(Math.max(currentIndex + offset, 0), ids.length - 1)
    await selectResource(ids[nextIndex])
  }

  const toggleVisualMode = (): void => {
    if (unref(visualMode)) {
      visualMode.value = false
      visualAnchorId = null
      visualCursorId = null
      return
    }
    const currentId = unref(resourcesStore.selectedResources)[0]?.id
    if (!currentId) return
    visualMode.value = true
    visualAnchorId = currentId
    visualCursorId = currentId
  }

  const exitVisualMode = (): void => {
    visualMode.value = false
    visualAnchorId = null
    visualCursorId = null
  }

  const moveDown = (): Promise<void> => move(1)
  const moveUp = (): Promise<void> => move(-1)

  const jumpToFirst = async (): Promise<void> => {
    const ids = renderedResourceIds()
    if (!ids.length) return
    if (unref(visualMode)) {
      await extendSelection(ids[0])
      return
    }
    await selectResource(ids[0])
  }

  const jumpToLast = async (): Promise<void> => {
    const ids = renderedResourceIds()
    if (!ids.length) return
    if (unref(visualMode)) {
      await extendSelection(ids[ids.length - 1])
      return
    }
    await selectResource(ids[ids.length - 1])
  }

  return { moveDown, moveUp, jumpToFirst, jumpToLast, toggleVisualMode, exitVisualMode, visualMode }
}
