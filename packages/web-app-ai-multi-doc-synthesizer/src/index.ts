import { defineWebApplication, useModals } from '@ownclouders/web-pkg'
import type { ActionExtension, FileActionOptions } from '@ownclouders/web-pkg'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { Resource } from '@ownclouders/web-client'
import SynthesisPanel from './components/SynthesisPanel.vue'
import type { SynthesisResource } from './composables/useSynthesis'
import { isSupportedFile } from './utils/file-support'
import type { LLMConfig } from './composables/useLLM'
import translations from '../l10n/translations.json'

const SUPPORTED_EXTS = ['txt', 'md']
const APP_ID = 'ai-multi-doc-synthesizer'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $pgettext } = useGettext()
    const { dispatchModal } = useModals()

    const rawLlm = applicationConfig?.llm as Record<string, string> | undefined
    // No apiKey in config — the proxy authenticates with the provider.
    const llmConfig: LLMConfig | null =
      rawLlm?.endpoint && rawLlm?.model
        ? { endpoint: rawLlm.endpoint, model: rawLlm.model }
        : null

    const extensions = computed(() => [
      {
        id: `${APP_ID}.batch-action`,
        type: 'action',
        extensionPointIds: ['global.files.batch-actions'],
        action: {
          name: `${APP_ID}-synthesize`,
          icon: 'sparkling-2',
          label: () => $pgettext('Batch action to synthesize selected documents', 'Synthesize'),
          isVisible: ({ resources }: { resources?: Resource[] }) => {
            if (!llmConfig) return false
            if (!resources) return false
            const count = resources.length
            return (
              count >= 2 &&
              count <= 10 &&
              resources.every((r) => isSupportedFile(r as SynthesisResource, SUPPORTED_EXTS))
            )
          },
          handler: ({ resources }: FileActionOptions) => {
            dispatchModal({
              title: $pgettext('Document synthesis modal title', 'Document Synthesis'),
              hideConfirmButton: true,
              customComponent: SynthesisPanel,
              customComponentAttrs: () => ({
                resources: resources as SynthesisResource[],
                llmConfig
              })
            })
          }
        }
      } as ActionExtension
    ])

    return {
      appInfo: {
        name: $pgettext(
          'AI Multi-Document Synthesizer extension name',
          'AI Multi-Document Synthesizer'
        ),
        id: APP_ID
      },
      extensions,
      translations
    }
  }
})
