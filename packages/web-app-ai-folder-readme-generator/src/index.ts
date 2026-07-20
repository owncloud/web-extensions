import { defineWebApplication, useMessages } from '@ownclouders/web-pkg'
import type { ActionExtension, FileActionOptions } from '@ownclouders/web-pkg'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { Resource } from '@ownclouders/web-client'
import { isFolder } from './utils/file-support'
import { useReadmeGenerator } from './composables/useReadmeGenerator'
import type { LLMConfig } from './composables/useLLM'
import translations from '../l10n/translations.json'

const APP_ID = 'ai-folder-readme-generator'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $pgettext } = useGettext()
    const { showMessage, showErrorMessage } = useMessages()

    const rawLlm = applicationConfig?.llm as Record<string, unknown> | undefined
    const llmConfig: LLMConfig | null =
      rawLlm?.endpoint && rawLlm?.model
        ? { endpoint: rawLlm.endpoint as string, model: rawLlm.model as string }
        : null

    const { error, generate } = useReadmeGenerator(llmConfig)

    const extensions = computed(() => [
      {
        id: `${APP_ID}.action`,
        type: 'action',
        extensionPointIds: ['global.files.context-actions'],
        action: {
          name: `${APP_ID}-generate`,
          icon: 'sparkling-2',
          label: () =>
            $pgettext('Context menu action to generate a README file for a folder', 'Generate README'),
          isVisible: ({ resources }: { resources?: Resource[] }) =>
            llmConfig !== null && resources?.length === 1 && isFolder(resources[0]),
          handler: async ({ space, resources }: FileActionOptions) => {
            const resource = resources[0]
            const written = await generate(space, resource)
            if (error.value) {
              showErrorMessage({
                title: $pgettext(
                  'Error notification after README generation failed',
                  'Failed to generate README'
                ),
                errors: [new Error(error.value)]
              })
              return
            }
            if (!written) {
              // User cancelled the overwrite-confirmation dialog — nothing was written.
              return
            }
            showMessage({
              title: $pgettext('Success notification after README generation', 'README.md generated')
            })
          }
        }
      } as ActionExtension
    ])

    return {
      appInfo: {
        name: $pgettext('AI Folder README Generator extension name', 'AI Folder README Generator'),
        id: APP_ID
      },
      translations,
      extensions
    }
  }
})
