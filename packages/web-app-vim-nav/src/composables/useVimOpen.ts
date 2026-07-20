import { unref } from 'vue'
import {
  useResourcesStore,
  useFileActions,
  useGetMatchingSpace,
  useRouter,
  useResourceRouteResolver
} from '@ownclouders/web-pkg'

export function useVimOpen() {
  const resourcesStore = useResourcesStore()
  const { triggerDefaultAction } = useFileActions()
  const { getMatchingSpace } = useGetMatchingSpace()
  const router = useRouter()
  const { createFolderLink } = useResourceRouteResolver()

  const openSelected = () => {
    const resources = unref(resourcesStore.selectedResources)
    if (!resources.length) return
    const resource = resources[0]
    const space = getMatchingSpace(resource)
    if (!space) return

    if (resource.isFolder) {
      const route = createFolderLink({ path: resource.path, fileId: resource.fileId, resource })
      router.push(route)
    } else {
      triggerDefaultAction({ space, resources })
    }
  }

  return { openSelected }
}
