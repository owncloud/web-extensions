import { defineWebApplication, useModals } from '@ownclouders/web-pkg'
import type { ActionExtension, FileActionOptions } from '@ownclouders/web-pkg'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import TagSuggestionModal from './components/TagSuggestionModal.vue'
import type { LLMConfig } from './composables/useLLM'

const APP_ID = 'ai-smart-file-tagger-qa'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $pgettext } = useGettext()
    const { dispatchModal } = useModals()

    const rawLlm = applicationConfig?.llm as Record<string, string> | undefined
    const llmConfig: LLMConfig | null =
      rawLlm?.endpoint && rawLlm?.model
        ? { endpoint: rawLlm.endpoint, model: rawLlm.model }
        : null

    const extensions = computed(() => [
      {
        id: `${APP_ID}.action`,
        type: 'action',
        // app.files.quick-actions does not exist in this web-pkg version; using context-actions
        extensionPointIds: ['global.files.context-actions'],
        action: {
          name: `${APP_ID}-tag`,
          icon: 'sparkling-2',
          label: () => $pgettext('Context menu action to suggest AI tags for a file', 'Suggest tags'),
          isVisible: ({ resources }: FileActionOptions) => (resources?.length ?? 0) === 1,
          handler: ({ resources }: FileActionOptions) => {
            dispatchModal({
              title: $pgettext('Tag suggestion modal title', 'Suggest Tags'),
              confirmText: $pgettext(
                'Button to apply the selected tag suggestions to the file',
                'Apply tags'
              ),
              customComponent: TagSuggestionModal,
              customComponentAttrs: () => ({
                resource: resources?.[0] ?? null,
                llmConfig
              })
            })
          }
        }
      } as ActionExtension
    ])

    return {
      appInfo: {
        name: $pgettext('AI Smart File Tagger extension name', 'AI Smart File Tagger'),
        id: APP_ID
      },
      extensions
    }
  }
})
