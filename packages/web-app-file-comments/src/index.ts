import type { Resource, SpaceResource } from '@ownclouders/web-client'
import {
  defineWebApplication,
  eventBus,
  SideBarEventTopics,
  useResourcesStore
} from '@ownclouders/web-pkg'
import type {
  ActionExtension,
  FileActionOptions,
  SidebarPanelExtension
} from '@ownclouders/web-pkg'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import FileCommentsPanel from './components/FileCommentsPanel.vue'
import { isCommentableResource } from './utils/commentable'

const APP_ID = 'file-comments'
const PANEL_NAME = 'file-comments'

export default defineWebApplication({
  setup() {
    const { $pgettext } = useGettext()
    const resourcesStore = useResourcesStore()

    const extensions = computed(() => [
      {
        id: `${APP_ID}.panel`,
        type: 'sidebarPanel',
        extensionPointIds: ['global.files.sidebar'],
        panel: {
          name: PANEL_NAME,
          icon: 'chat-3',
          title: () => $pgettext('File comments sidebar tab title', 'Comments'),
          isVisible: ({ items }: { items?: Resource[] }) =>
            items?.length === 1 && isCommentableResource(items[0]),
          component: FileCommentsPanel,
          componentAttrs: ({ items }: { items?: Resource[] }) => ({
            resource: items?.[0] ?? null
          })
        }
      } as SidebarPanelExtension<SpaceResource, Resource, Resource>,
      {
        id: `${APP_ID}.action`,
        type: 'action',
        extensionPointIds: ['global.files.context-actions'],
        action: {
          name: 'file-comments-open',
          icon: 'chat-3',
          label: () => $pgettext('Context menu action to open file comments', 'Comments'),
          isVisible: ({ resources }: { resources?: Resource[] }) =>
            resources?.length === 1 && isCommentableResource(resources[0]),
          handler: ({ resources }: FileActionOptions) => {
            resourcesStore.setSelection(resources.map(({ id }) => id))
            eventBus.publish(SideBarEventTopics.openWithPanel, PANEL_NAME)
          }
        }
      } as ActionExtension
    ])

    return {
      appInfo: {
        name: $pgettext('File comments extension name', 'File Comments'),
        id: APP_ID
      },
      extensions
    }
  }
})
