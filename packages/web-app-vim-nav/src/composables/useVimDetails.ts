import { unref } from 'vue'
import { useResourcesStore, useSideBar, eventBus, SideBarEventTopics } from '@ownclouders/web-pkg'

const DETAILS_PANEL_NAME = 'details'

export function useVimDetails() {
  const resourcesStore = useResourcesStore()
  const { isSideBarOpen, sideBarActivePanel } = useSideBar()

  const toggleDetails = (): void => {
    const resources = unref(resourcesStore.selectedResources)
    if (!resources.length) return

    if (unref(isSideBarOpen) && unref(sideBarActivePanel) === DETAILS_PANEL_NAME) {
      eventBus.publish(SideBarEventTopics.close)
      return
    }

    eventBus.publish(SideBarEventTopics.openWithPanel, DETAILS_PANEL_NAME)
  }

  return { toggleDetails }
}
