import { AppMenuItemExtension, ApplicationSetupOptions } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import { computed } from 'vue'
import { JitsiConferenceConfigSchema } from './types'

const appId = 'jitsi-conference'

export const extensions = ({ applicationConfig }: ApplicationSetupOptions) => {
  const { $gettext } = useGettext()

  const { url, color, icon, priority } = JitsiConferenceConfigSchema.parse(applicationConfig)

  return computed<AppMenuItemExtension[]>(() => {
    // No operator-configured jitsi-admin instance means there is nothing to link to.
    // Never fall back to a public jitsi-admin instance, see DECISIONS.md (D4).
    if (!url) {
      return []
    }

    return [
      {
        id: `app.${appId}.menuItem`,
        type: 'appMenuItem',
        label: () => $gettext('Start video call'),
        color: color || '#33B5B5',
        icon: icon || 'vidicon-line',
        priority: priority ?? 30,
        // No `path` is set on purpose: the call always opens in a new browser tab
        // instead of an oCIS-nested iframe, see DECISIONS.md (D1).
        url
      }
    ]
  })
}
