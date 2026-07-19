import { unref } from 'vue'
import {
  useResourcesStore,
  useSpacesStore,
  useFileActionsDelete,
  useFileActionsRestore,
  useFileActionsEmptyTrashBin,
  useRouter
} from '@ownclouders/web-pkg'

const TRASH_ROUTE_NAME = 'files-trash-generic'

export function useVimDelete() {
  const resourcesStore = useResourcesStore()
  const spacesStore = useSpacesStore()
  const router = useRouter()
  const { actions: deleteActions } = useFileActionsDelete()
  const { actions: restoreActions } = useFileActionsRestore()
  const { actions: emptyTrashActions } = useFileActionsEmptyTrashBin()

  const currentSpace = () => unref(spacesStore.currentSpace)
  const isTrash = () => router.currentRoute.value.name === TRASH_ROUTE_NAME

  const deleteSelected = async () => {
    const resources = unref(resourcesStore.selectedResources)
    if (!resources.length) return
    const actionName = isTrash() ? 'delete-permanent' : 'delete'
    const action = unref(deleteActions).find((a) => a.name === actionName)
    if (!action) return
    await action.handler({ space: currentSpace(), resources })
  }

  const restoreSelected = async () => {
    const resources = unref(resourcesStore.selectedResources)
    if (!resources.length) return
    const action = unref(restoreActions)[0]
    if (!action) return
    await action.handler({ space: currentSpace(), resources })
  }

  const emptyTrashBin = () => {
    const action = unref(emptyTrashActions)[0]
    if (!action) return
    action.handler({ space: currentSpace(), resources: [] })
  }

  return { deleteSelected, restoreSelected, emptyTrashBin }
}
