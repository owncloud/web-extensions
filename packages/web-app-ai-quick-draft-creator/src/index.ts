import { defineWebApplication, useModals, useUserStore } from '@ownclouders/web-pkg'
import type { ApplicationInformation } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import type { LLMConfig } from './composables/useLLM'
import DraftCreatorModal from './components/DraftCreatorModal.vue'
import translations from '../l10n/translations.json'

const APP_ID = 'ai-quick-draft-creator'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $pgettext } = useGettext()
    const { dispatchModal, removeModal } = useModals()
    const userStore = useUserStore()

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

    const appInfo: ApplicationInformation = {
      name: $pgettext('AI Quick Draft Creator extension name', 'AI Quick Draft Creator'),
      id: APP_ID,
      extensions: [
        {
          newFileMenu: {
            menuTitle: () => $pgettext('New file menu item', 'Draft from description'),
            isVisible: ({ currentFolder }) =>
              llmConfig !== null && !!(currentFolder?.canUpload({ user: userStore.user }))
          },
          customHandler: () => openModal(),
          icon: 'draft'
        }
      ]
    }

    return {
      appInfo,
      translations
    }
  }
})
