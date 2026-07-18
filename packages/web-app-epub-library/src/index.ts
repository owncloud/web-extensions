import { AppMenuItemExtension, defineWebApplication } from '@ownclouders/web-pkg'
import { computed } from 'vue'
import { RouteRecordRaw } from 'vue-router'
import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'
import LibraryView from './views/LibraryView.vue'

const applicationId = 'epub-library'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()
    const appInfo = {
      id: applicationId,
      name: $gettext('Library'),
      icon: 'book',
      color: '#4f46e5'
    }

    const routes: RouteRecordRaw[] = [
      {
        name: applicationId,
        path: '/',
        component: LibraryView,
        meta: {
          authContext: 'user',
          title: $gettext('Library')
        }
      }
    ]

    const menuItems = computed<AppMenuItemExtension[]>(() => [
      {
        id: `app.${applicationId}.menuItem`,
        type: 'appMenuItem',
        label: () => appInfo.name,
        color: appInfo.color,
        icon: appInfo.icon,
        priority: 35,
        path: `/${applicationId}`
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
