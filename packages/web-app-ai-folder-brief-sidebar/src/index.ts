import { defineWebApplication } from '@ownclouders/web-pkg'
import translations from '../l10n/translations.json'

export default defineWebApplication({
  setup() {
    return {
      appInfo: {
        name: 'AI Folder Brief',
        id: 'ai-folder-brief-sidebar'
      },
      translations,
      extensions: []
    }
  }
})
