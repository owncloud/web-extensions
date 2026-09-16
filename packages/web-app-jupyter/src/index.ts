import { defineWebApplication } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'
import { extensions } from './extensions'

export default defineWebApplication({
  setup(args) {
    const { $gettext } = useGettext()

    return {
      appInfo: {
        name: $gettext('Jupyter'),
        id: 'jupyter'
      },
      translations,
      extensions: extensions(args)
    }
  }
})
