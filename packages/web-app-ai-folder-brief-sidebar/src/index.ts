import { defineWebApplication } from '@ownclouders/web-pkg'
import type { SidebarPanelExtension } from '@ownclouders/web-pkg'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { Resource, SpaceResource } from '@ownclouders/web-client'
import FolderBriefPanel from './components/FolderBriefPanel.vue'
import type { LlmConfig } from './composables/useLlm'
import translations from '../l10n/translations.json'

const APP_ID = 'ai-folder-brief-sidebar'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $pgettext } = useGettext()

    const rawLlm = applicationConfig?.llm as Record<string, string> | undefined
    const llmConfig: LlmConfig | null =
      rawLlm?.endpoint && rawLlm?.model
        ? { endpoint: rawLlm.endpoint, model: rawLlm.model }
        : null

    const extensions = computed(() => [
      {
        id: `${APP_ID}.panel`,
        type: 'sidebarPanel',
        extensionPointIds: ['global.files.sidebar'],
        panel: {
          name: APP_ID,
          icon: 'sparkling-2',
          title: () => $pgettext('Sidebar panel tab title', 'Folder Brief'),
          isVisible: ({ items }: { items?: Array<{ isFolder?: boolean }> }) =>
            items?.length === 1 && items[0]?.isFolder === true,
          component: FolderBriefPanel,
          componentAttrs: ({ items }: { items?: Resource[] }) => ({
            resource: items?.[0] ?? null,
            llmConfig
          })
        }
      } as SidebarPanelExtension<SpaceResource, Resource, Resource>
    ])

    return {
      appInfo: {
        name: $pgettext('AI Folder Brief extension name', 'AI Folder Brief'),
        id: APP_ID
      },
      translations,
      extensions
    }
  }
})
