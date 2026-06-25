import {
  defineWebApplication,
  eventBus,
  SideBarEventTopics,
  useResourcesStore
} from '@ownclouders/web-pkg'
import type { SidebarPanelExtension, ActionExtension, FileActionOptions } from '@ownclouders/web-pkg'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { Resource, SpaceResource } from '@ownclouders/web-client'
import InsightsPanel from './components/InsightsPanel.vue'
import { isSupportedFile } from './utils/file-support'
import type { LLMConfig } from './composables/useLLM'

const SUPPORTED_EXTS = ['csv', 'tsv']
const APP_ID = 'ai-data-insights-sidebar'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $pgettext } = useGettext()
    const resourcesStore = useResourcesStore()

    const rawLlm = applicationConfig?.llm as Record<string, unknown> | undefined
    const llmConfig: LLMConfig | null =
      rawLlm?.endpoint && rawLlm?.model
        ? { endpoint: rawLlm.endpoint as string, model: rawLlm.model as string }
        : null

    const extensions = computed(() => [
      {
        id: `${APP_ID}.panel`,
        type: 'sidebarPanel',
        extensionPointIds: ['global.files.sidebar'],
        panel: {
          name: APP_ID,
          icon: 'sparkling-2',
          title: () => $pgettext('Sidebar panel tab title', 'Insights'),
          isVisible: ({ items }: { items?: Resource[] }) =>
            llmConfig !== null &&
            items?.length === 1 &&
            isSupportedFile(items[0], SUPPORTED_EXTS),
          component: InsightsPanel,
          componentAttrs: ({ items }: { items?: Resource[] }) => ({
            resource: items?.[0] ?? null,
            llmConfig
          })
        }
      } as SidebarPanelExtension<SpaceResource, Resource, Resource>,
      {
        id: `${APP_ID}.action`,
        type: 'action',
        extensionPointIds: ['global.files.context-actions'],
        action: {
          name: `${APP_ID}-insights`,
          icon: 'sparkling-2',
          label: () => $pgettext('Context menu action to open data insights', 'Insights'),
          isVisible: ({ resources }: { resources?: Resource[] }) =>
            llmConfig !== null &&
            resources?.length === 1 &&
            isSupportedFile(resources[0], SUPPORTED_EXTS),
          handler: ({ resources }: FileActionOptions) => {
            resourcesStore.setSelection(resources.map(({ id }) => id))
            eventBus.publish(SideBarEventTopics.openWithPanel, APP_ID)
          }
        }
      } as ActionExtension
    ])

    return {
      appInfo: {
        name: $pgettext(
          'AI CSV / Spreadsheet Insights Sidebar extension name',
          'AI CSV / Spreadsheet Insights Sidebar'
        ),
        id: APP_ID
      },
      extensions
    }
  }
})
