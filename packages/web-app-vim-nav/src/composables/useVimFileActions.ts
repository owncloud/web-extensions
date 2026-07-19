import { unref } from 'vue'
import {
  useResourcesStore,
  useGetMatchingSpace,
  useDownloadFile,
  useFileActionsDuplicate
} from '@ownclouders/web-pkg'

export function useVimFileActions() {
  const resourcesStore = useResourcesStore()
  const { getMatchingSpace } = useGetMatchingSpace()
  const { downloadFile } = useDownloadFile()
  const { actions: duplicateActions } = useFileActionsDuplicate()

  const withSelected = (cb: (space: ReturnType<typeof getMatchingSpace>, resources: typeof resourcesStore.selectedResources) => void) => {
    const resources = unref(resourcesStore.selectedResources)
    if (!resources.length) return
    const space = getMatchingSpace(resources[0])
    if (!space) return
    cb(space, resources)
  }

  const downloadSelected = () => {
    withSelected((space, resources) => {
      for (const resource of unref(resources)) {
        downloadFile(space, resource)
      }
    })
  }

  const duplicateSelected = () => {
    withSelected((space, resources) => {
      const action = unref(duplicateActions)[0]
      if (action) action.handler({ space, resources: unref(resources) })
    })
  }

  return { downloadSelected, duplicateSelected }
}
