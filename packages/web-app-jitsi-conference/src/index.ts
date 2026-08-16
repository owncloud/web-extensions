import { defineWebApplication } from '@ownclouders/web-pkg'
import translations from '../l10n/translations.json'
import { useGettext } from 'vue3-gettext'
import { extensions } from './extensions'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $gettext } = useGettext()

    const appInfo = {
      name: $gettext('Jitsi Conference'),
      id: 'jitsi-conference',
      icon: 'vidicon-line'
    } as const

    return {
      appInfo,
      routes: [],
      translations,
      extensions: extensions({ applicationConfig })
    }
  }
})
