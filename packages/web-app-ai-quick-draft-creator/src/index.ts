import { defineWebApplication, useModals } from '@ownclouders/web-pkg'
import type { ActionExtension } from '@ownclouders/web-pkg'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { LLMConfig } from './composables/useLLM'
import DraftCreatorModal from './components/DraftCreatorModal.vue'
import translations from '../l10n/translations.json'

const APP_ID = 'ai-quick-draft-creator'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $pgettext } = useGettext()
    const { dispatchModal, removeModal } = useModals()

    const rawLlm = applicationConfig?.llm as Record<string, string> | undefined
    // apiKey is intentionally omitted — the ai-llm-proxy holds the provider key server-side.
    // The browser authenticates to the proxy with the user's oCIS OIDC token.
    const llmConfig: LLMConfig | null =
      rawLlm?.endpoint && rawLlm?.model
        ? { endpoint: rawLlm.endpoint, model: rawLlm.model }
        : null

    function openModal(): void {
      const modal = dispatchModal({
        title: $pgettext('Modal title for AI draft creator', 'Create a draft'),
        hideActions: true,
        customComponent: DraftCreatorModal,
        customComponentAttrs: () => ({
          llmConfig,
          onConfirm: () => removeModal(modal.id),
          onCancel: () => removeModal(modal.id)
        })
      })
    }

    const extensions = computed<ActionExtension[]>(() => [
      {
        id: `${APP_ID}.upload-menu-action`,
        type: 'action',
        extensionPointIds: ['app.files.upload-menu'],
        action: {
          name: `${APP_ID}-create-draft`,
          icon: 'draft',
          label: () => $pgettext('Upload menu action label', 'Draft from description'),
          isVisible: () => llmConfig !== null,
          handler: () => openModal(),
          class: `oc-files-actions-${APP_ID}`
        }
      } as ActionExtension
    ])

    return {
      appInfo: {
        name: $pgettext('AI Quick Draft Creator extension name', 'AI Quick Draft Creator'),
        id: APP_ID
      },
      translations,
      extensions
    }
  }
})
