import { computed } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { useGettext } from 'vue3-gettext'
import { Ability } from '@ownclouders/web-client'
import {
  AppMenuItemExtension,
  ApplicationInformation,
  defineWebApplication,
  useAbility,
  useAuthService,
  useUserStore
} from '@ownclouders/web-pkg'
import ReportView from './views/ReportView.vue'
import { useCapabilityStore } from './compat'
import { applyReportConfig } from './config'
import { APP_ID, canView } from './constants'
import translations from '../l10n/translations.json'

// NOTE: only a default export here — Web loads the AMD bundle and uses the module value itself.

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $gettext } = useGettext()
    const ability = useAbility()
    const userStore = useUserStore()
    applyReportConfig(applicationConfig)

    const appInfo: ApplicationInformation = {
      name: $gettext('Space report'),
      id: APP_ID,
      icon: 'pie-chart-2',
      color: '#2b2b2b'
    }

    // globalProperties carry $ability (CASL)
    const routes = ({ $ability }: any): RouteRecordRaw[] => [
      {
        path: '/',
        name: 'report',
        component: ReportView,
        beforeEnter: async (to) => {
          if (!canView($ability as Ability)) {
            return { name: 'accessDenied' }
          }
          // same as Admin Settings; also gives the token the ACR needed to list Vault spaces
          const capabilityStore = useCapabilityStore()
          if (capabilityStore.authMfaEnabled) {
            await useAuthService().requireAcr(capabilityStore.authMfaRequiredLevelname, to.fullPath)
          }
          return true
        },
        meta: {
          authContext: 'user',
          title: $gettext('Space report')
        }
      }
    ]

    const menuItems = computed<AppMenuItemExtension[]>(() => {
      if (!userStore.user || !canView(ability)) return []
      return [
        {
          id: `app.${APP_ID}.menuItem`,
          type: 'appMenuItem',
          label: () => appInfo.name,
          color: appInfo.color,
          icon: appInfo.icon,
          priority: 46,
          path: APP_ID
        }
      ]
    })

    return { appInfo, routes, translations, extensions: menuItems }
  }
})
