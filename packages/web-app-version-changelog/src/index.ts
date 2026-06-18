import { defineWebApplication } from '@ownclouders/web-pkg'
import type { SidebarPanelExtension } from '@ownclouders/web-pkg'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { Resource, SpaceResource } from '@ownclouders/web-client'
import ChangelogPanel from './components/ChangelogPanel.vue'
import type { LlmConfig } from './composables/useLlm'

const APP_ID = 'version-changelog'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $pgettext } = useGettext()

    const rawLlm = applicationConfig?.llm as Record<string, string> | undefined
    const llmConfig: LlmConfig | null =
      rawLlm?.endpoint && rawLlm?.model ? { endpoint: rawLlm.endpoint, model: rawLlm.model } : null

    const extensions = computed(() => [
      {
        id: `${APP_ID}.panel`,
        type: 'sidebarPanel',
        extensionPointIds: ['global.files.sidebar'],
        panel: {
          name: APP_ID,
          icon: 'history',
          title: () => $pgettext('Sidebar panel tab title', 'Changelog'),
          isVisible: ({ items }: { items?: Array<{ isFolder?: boolean }> }) =>
            items?.length === 1 && !items[0]?.isFolder,
          component: ChangelogPanel,
          componentAttrs: ({ items }: { items?: Resource[] }) => ({
            resource: items?.[0] ?? null,
            llmConfig
          })
        }
      } as SidebarPanelExtension<SpaceResource, Resource, Resource>
    ])

    return {
      appInfo: {
        name: $pgettext('Version Changelog extension name', 'Version Changelog'),
        id: APP_ID
      },
      extensions
    }
  }
})
