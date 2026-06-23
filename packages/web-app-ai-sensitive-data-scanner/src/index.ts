import { defineWebApplication, useModals } from '@ownclouders/web-pkg'
import type { ActionExtension, FileActionOptions } from '@ownclouders/web-pkg'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import ScanResultsModal from './components/ScanResultsModal.vue'
import type { LlmConfig } from './composables/useScanner'
import { isSupportedFile } from './utils/file-support'

const APP_ID = 'ai-sensitive-data-scanner'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $pgettext } = useGettext()
    const { dispatchModal } = useModals()

    const rawLlm = applicationConfig?.llm as Record<string, string> | undefined
    const llmConfig: LlmConfig | null =
      rawLlm?.endpoint && rawLlm?.model
        ? { endpoint: rawLlm.endpoint, model: rawLlm.model }
        : null

    const extensions = computed(() => [
      {
        id: `${APP_ID}.action`,
        type: 'action',
        extensionPointIds: ['global.files.batch-actions'],
        action: {
          name: `${APP_ID}-scan`,
          icon: 'search',
          label: () => $pgettext('Batch action to scan files for sensitive data', 'Scan for sensitive data'),
          isVisible: ({ resources }: { resources?: Array<{ extension?: string }> }) =>
            (resources?.length ?? 0) >= 1 && (resources ?? []).some((r) => isSupportedFile(r)),
          handler: ({ resources }: FileActionOptions) => {
            dispatchModal({
              title: $pgettext('Sensitive data scan results modal title', 'Sensitive Data Scan'),
              hideConfirmButton: true,
              customComponent: ScanResultsModal,
              customComponentAttrs: () => ({
                resources,
                llmConfig
              })
            })
          }
        }
      } as ActionExtension
    ])

    return {
      appInfo: {
        name: $pgettext('AI Sensitive Data Scanner extension name', 'AI Sensitive Data Scanner'),
        id: APP_ID
      },
      extensions
    }
  }
})
