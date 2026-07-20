import { defineWebApplication } from '@ownclouders/web-pkg'
import type { FolderViewExtension } from '@ownclouders/web-pkg'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { LLMConfig } from './composables/useLLM'
import ProjectBoardView from './components/ProjectBoardView.vue'
import translations from '../l10n/translations.json'

const APP_ID = 'ai-project-board-view'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $pgettext } = useGettext()

    const rawLlm = applicationConfig?.llm as Record<string, string> | undefined
    const llmConfig: LLMConfig | null =
      rawLlm?.endpoint && rawLlm?.model
        ? { endpoint: rawLlm.endpoint, model: rawLlm.model }
        : null

    const extensions = computed(() => [
      {
        id: `${APP_ID}.board`,
        type: 'folderView',
        extensionPointIds: ['app.files.folder-views.project-spaces'],
        folderView: {
          name: APP_ID,
          label: $pgettext('Folder view mode', 'Status Board'),
          icon: { name: 'grid', fillType: 'line' },
          isScrollable: true,
          component: ProjectBoardView,
          componentAttrs: () => ({ llmConfig })
        }
      } as FolderViewExtension
    ])

    return {
      appInfo: {
        name: $pgettext(
          'AI Project Space Status Board extension name',
          'AI Project Space Status Board'
        ),
        id: APP_ID
      },
      translations,
      extensions
    }
  }
})
