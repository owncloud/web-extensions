import {
  ActionExtension,
  ApplicationSetupOptions,
  Extension,
  FileAction,
  FileActionOptions,
  useUserStore
} from '@ownclouders/web-pkg'
import { isPersonalSpaceResource, urlJoin } from '@ownclouders/web-client'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'

// applicationConfig.serverUrl:      base URL of the JupyterHub instance
// applicationConfig.serverPath:     path appended after serverUrl (default: hub/user-redirect/lab/tree)
// applicationConfig.serverRootPath: oCIS-space-relative folder mapped as the Jupyter tree root
export const extensions = ({ applicationConfig }: ApplicationSetupOptions) => {
  const { $gettext } = useGettext()
  const userStore = useUserStore()

  const action: FileAction = {
    name: 'open-jupyter',
    category: 'context',
    icon: 'resource-type-jupyter',
    iconFillType: 'fill',
    label: () => $gettext('Open in Notebooks'),
    showOpenInNewTabHint: true,
    isVisible: ({ space, resources }: FileActionOptions) => {
      if (resources?.length !== 1) {
        return false
      }
      if (resources[0].extension !== 'ipynb') {
        return false
      }
      if (!isPersonalSpaceResource(space) || !space.isOwner(userStore.user)) {
        return false
      }
      const path = resources[0].path.replace(/^\/+/u, '')
      const rootPath = (applicationConfig?.serverRootPath || '').replace(/^\/+/u, '')
      if (rootPath && !path.startsWith(rootPath)) {
        return false
      }
      return true
    },
    href: ({ resources }: FileActionOptions) => {
      const serverUrl = applicationConfig?.serverUrl || ''
      const serverPath = applicationConfig?.serverPath || 'hub/user-redirect/lab/tree'
      let path = resources[0].path.replace(/^\/+/u, '')
      const rootPath = (applicationConfig?.serverRootPath || '').replace(/^\/+/u, '')
      if (rootPath && path.startsWith(rootPath)) {
        path = path.slice(rootPath.length)
      }
      path = path.replaceAll('//', '/')
      return urlJoin(serverUrl, serverPath, encodeURI(path)) + `?fileId=${resources[0].id}`
    }
  }

  const extension: ActionExtension = {
    id: 'com.github.owncloud.web-app-jupyter.open-action',
    type: 'action',
    extensionPointIds: ['global.files.context-actions', 'global.files.default-actions'],
    action
  }

  return computed<Extension[]>(() => [extension])
}
