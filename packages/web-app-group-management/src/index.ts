import { defineWebApplication, AppMenuItemExtension } from '@ownclouders/web-pkg'
import { RouteRecordRaw } from 'vue-router'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import GroupsView from './views/GroupsView.vue'
import translations from '../l10n/translations.json'

const appId = 'group-management'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const appInfo = {
      id: appId,
      name: $gettext('Group Management'),
      icon: 'group-2',
      color: '#0D856F'
    }

    const routes: RouteRecordRaw[] = [
      {
        path: '/',
        redirect: { name: `${appId}-overview` }
      },
      {
        path: '/overview',
        name: `${appId}-overview`,
        component: GroupsView,
        meta: {
          authContext: 'user',
          title: $gettext('Groups')
        }
      }
    ]

    const menuItems = computed<AppMenuItemExtension[]>(() => [
      {
        id: `app.${appId}.menuItem`,
        type: 'appMenuItem',
        label: () => appInfo.name,
        color: appInfo.color,
        icon: appInfo.icon,
        priority: 30,
        path: `/${appId}`
      }
    ])

    return {
      appInfo,
      routes,
      extensions: menuItems,
      translations
    }
  }
})
