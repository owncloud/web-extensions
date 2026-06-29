import { defineWebApplication, useModals, useResourcesStore, useUserStore } from '@ownclouders/web-pkg'
import type { ActionExtension } from '@ownclouders/web-pkg'
import { computed, storeToRefs } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { LLMConfig } from './composables/useLLM'
import DraftCreatorModal from './components/DraftCreatorModal.vue'

const APP_ID = 'ai-quick-draft-creator'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $pgettext } = useGettext()
    const { dispatchModal, removeModal } = useModals()
    const resourcesStore = useResourcesStore()
    const { currentFolder } = storeToRefs(resourcesStore)
    const userStore = useUserStore()

    const rawLlm = applicationConfig?.llm as Record<string, string> | undefined
    const llmConfig: LLMConfig | null =
      rawLlm?.endpoint && rawLlm?.model
        ? { endpoint: rawLlm.endpoint, model: rawLlm.model, apiKey: rawLlm.apiKey }
        : null

    function canUpload(): boolean {
      return !!(currentFolder.value?.canUpload({ user: userStore.user }))
    }

    function openModal(): void {
      // dispatchModal returns the modal object; capture it for closure use in attrs/onCancel.
      // customComponentAttrs is called lazily at render time, so `modal` is resolved.
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
          isVisible: () => llmConfig !== null && canUpload(),
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
      extensions
    }
  }
})
