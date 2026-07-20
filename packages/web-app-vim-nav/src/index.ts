import { defineWebApplication } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'
import { useVimNav } from './composables/useVimNav'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    useVimNav()

    return {
      appInfo: {
        id: 'vim-nav',
        name: $gettext('Vim Navigation')
      },
      translations
    }
  }
})
