import { defineWebApplication } from '@ownclouders/web-pkg'
import type { Extension } from '@ownclouders/web-pkg'
import { computed } from 'vue'
import translations from '../l10n/translations.json'

export default defineWebApplication({
  setup() {
    const extensions = computed((): Extension[] => [])

    return {
      appInfo: {
        name: 'AI Folder Brief',
        id: 'ai-folder-brief-sidebar'
      },
      translations,
      extensions
    }
  }
})
