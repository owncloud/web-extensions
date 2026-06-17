import {
  defineWebApplication,
  eventBus,
  SideBarEventTopics,
  useResourcesStore
} from '@ownclouders/web-pkg'
import type {
  SidebarPanelExtension,
  ActionExtension,
  FileActionOptions
} from '@ownclouders/web-pkg'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { Resource, SpaceResource } from '@ownclouders/web-client'
import SummaryPanel from './components/SummaryPanel.vue'
import { isSupportedFile } from './utils/file-support'
import type { LlmConfig } from './composables/useLlm'

const SUPPORTED_EXTS = ['pdf', 'txt', 'md']
const APP_ID = 'ai-doc-summary'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $pgettext } = useGettext()
    const resourcesStore = useResourcesStore()

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
          name: 'ai-doc-summary',
          icon: 'sparkling-2',
          title: () => $pgettext('Sidebar panel tab title', 'Summary'),
          isVisible: ({ items }: { items?: Array<{ extension?: string }> }) =>
            items?.length === 1 && isSupportedFile(items[0], SUPPORTED_EXTS),
          component: SummaryPanel,
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
          name: 'ai-doc-summary-summarize',
          icon: 'sparkling-2',
          label: () => $pgettext('Context menu action to open document summary', 'Summarize'),
          isVisible: ({ resources }: { resources?: Array<{ extension?: string }> }) =>
            resources?.length === 1 && isSupportedFile(resources[0], SUPPORTED_EXTS),
          handler: ({ resources }: FileActionOptions) => {
            resourcesStore.setSelection(resources.map(({ id }) => id))
            eventBus.publish(SideBarEventTopics.openWithPanel, 'ai-doc-summary')
          }
        }
      } as ActionExtension
    ])

    return {
      appInfo: {
        name: $pgettext('AI Document Summary extension name', 'AI Document Summary'),
        id: APP_ID
      },
      extensions
    }
  }
})
