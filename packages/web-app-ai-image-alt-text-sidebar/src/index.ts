// NOTE: Search-engine indexing of alt text stored in the custom WebDAV property
// (urn:oc:ai:alt-text) requires a future server-side oCIS change to index that
// property. This is out of scope for a client-side extension.

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
import AltTextPanel from './components/AltTextPanel.vue'
import { isSupportedImage } from './utils/image-support'
import type { LlmConfig } from './composables/useLlm'

const APP_ID = 'ai-image-alt-text'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $pgettext } = useGettext()
    const resourcesStore = useResourcesStore()

    const rawLlm = applicationConfig?.llm as Record<string, unknown> | undefined
    const llmConfig: LlmConfig | null =
      rawLlm?.endpoint && rawLlm?.model
        ? {
            endpoint: rawLlm.endpoint as string,
            model: rawLlm.model as string,
            vision: rawLlm.vision === true
          }
        : null

    const extensions = computed(() => [
      {
        id: `${APP_ID}.panel`,
        type: 'sidebarPanel',
        extensionPointIds: ['global.files.sidebar'],
        panel: {
          name: APP_ID,
          icon: 'sparkling-2',
          title: () => $pgettext('Sidebar panel tab title', 'Alt Text'),
          isVisible: ({ items }: { items?: Resource[] }) =>
            llmConfig !== null && items?.length === 1 && isSupportedImage(items[0]),
          component: AltTextPanel,
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
          name: `${APP_ID}-generate`,
          icon: 'sparkling-2',
          label: () => $pgettext('Context menu action label', 'Generate Alt Text'),
          isVisible: ({ resources }: { resources?: Resource[] }) =>
            llmConfig !== null && resources?.length === 1 && isSupportedImage(resources[0]),
          handler: ({ resources }: FileActionOptions) => {
            resourcesStore.setSelection(resources.map(({ id }) => id))
            eventBus.publish(SideBarEventTopics.openWithPanel, APP_ID)
          }
        }
      } as ActionExtension
    ])

    return {
      appInfo: {
        name: $pgettext('AI Image Alt-Text extension name', 'AI Image Alt-Text'),
        id: APP_ID
      },
      extensions
    }
  }
})
