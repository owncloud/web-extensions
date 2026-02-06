/**
 * oCIS Photo Add-on
 *
 * A standalone Photos app that displays photos grouped by date.
 * Accessible from the app switcher menu.
 */

import {
  defineWebApplication,
  AppMenuItemExtension
} from '@ownclouders/web-pkg'
import { RouteRecordRaw } from 'vue-router'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import PhotosView from './views/PhotosView.vue'
import translations from '../l10n/translations.json'

const appId = 'photo-addon'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const appInfo = {
      id: appId,
      name: $gettext('Photos'),
      icon: 'image',
      color: '#339900'
    }

    const routes: RouteRecordRaw[] = [
      {
        path: '/',
        redirect: { name: `${appId}-all` }
      },
      {
        path: '/all',
        name: `${appId}-all`,
        component: PhotosView,
        meta: {
          authContext: 'user',
          title: 'All Photos'
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
