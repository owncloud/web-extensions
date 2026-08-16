import {
  AppMenuItemExtension,
  ApplicationSetupOptions,
  SidebarPanelExtension
} from '@ownclouders/web-pkg'
import {
  isProjectSpaceResource,
  isSpaceResource,
  Resource,
  SpaceResource
} from '@ownclouders/web-client'
import { useGettext } from 'vue3-gettext'
import { computed } from 'vue'
import { JitsiConferenceConfigSchema } from './types'
import SpaceCallPanel from './components/SpaceCallPanel.vue'
import FileCallPanel from './components/FileCallPanel.vue'

const appId = 'jitsi-conference'

type JitsiExtension =
  | AppMenuItemExtension
  | SidebarPanelExtension<SpaceResource, Resource, Resource>
  | SidebarPanelExtension<Resource, Resource, Resource>

export const extensions = ({ applicationConfig }: ApplicationSetupOptions) => {
  const { $gettext } = useGettext()

  const { url, color, icon, priority, jitsiAdminProxy } =
    JitsiConferenceConfigSchema.parse(applicationConfig)

  return computed<JitsiExtension[]>(() => {
    const result: JitsiExtension[] = []

    // No operator-configured jitsi-admin instance means there is nothing to link to.
    // Never fall back to a public jitsi-admin instance, see DECISIONS.md (D4).
    if (url) {
      result.push({
        id: `app.${appId}.menuItem`,
        type: 'appMenuItem',
        label: () => $gettext('Start video call'),
        color: color || '#33B5B5',
        icon: icon || 'vidicon-line',
        priority: priority ?? 30,
        // No `path` is set on purpose: the call always opens in a new browser tab
        // instead of an oCIS-nested iframe, see DECISIONS.md (D1).
        url
      })
    }

    // Room provisioning needs the jitsi-admin-proxy sidecar (see DECISIONS.md, D3) —
    // without it, there is nothing this panel could actually do.
    if (jitsiAdminProxy?.endpoint) {
      result.push({
        id: `app.${appId}.spaceCallPanel`,
        type: 'sidebarPanel',
        extensionPointIds: ['global.files.sidebar'],
        panel: {
          name: 'jitsi-conference-space-call',
          icon: 'vidicon-line',
          title: () => $gettext('Video call'),
          isVisible: ({ items }) => items?.length === 1 && isProjectSpaceResource(items[0]),
          component: SpaceCallPanel,
          componentAttrs: ({ items }) => ({
            space: (items?.[0] as SpaceResource) ?? null,
            proxyConfig: jitsiAdminProxy,
            jitsiAdminUrl: url
          })
        }
      })

      // Same sidecar, same extension point, but for a regular file/folder's share
      // recipients instead of a Space's members — see DECISIONS.md (Phase 3).
      result.push({
        id: `app.${appId}.fileCallPanel`,
        type: 'sidebarPanel',
        extensionPointIds: ['global.files.sidebar'],
        panel: {
          name: 'jitsi-conference-file-call',
          icon: 'vidicon-line',
          title: () => $gettext('Video call'),
          isVisible: ({ items }) => items?.length === 1 && !isSpaceResource(items[0]),
          component: FileCallPanel,
          componentAttrs: ({ items }) => ({
            resource: items?.[0] ?? null,
            proxyConfig: jitsiAdminProxy,
            jitsiAdminUrl: url
          })
        }
      })
    }

    return result
  })
}
