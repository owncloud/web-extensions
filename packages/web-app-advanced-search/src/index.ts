/**
 * oCIS Advanced Search Extension
 *
 * A standalone advanced search app with comprehensive filter support
 * including photo EXIF metadata fields.
 * Accessible from the app switcher menu.
 */

import {
  defineWebApplication,
  AppMenuItemExtension
} from '@ownclouders/web-pkg'
import { RouteRecordRaw } from 'vue-router'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import AdvancedSearchView from './views/AdvancedSearchView.vue'
import translations from '../l10n/translations.json'

const appId = 'advanced-search'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const appInfo = {
      id: appId,
      name: $gettext('Advanced Search'),
      icon: 'search',
      color: '#0066cc'
    }

    const routes: RouteRecordRaw[] = [
      {
        path: '/',
        redirect: { name: `${appId}-main` }
      },
      {
        path: '/search',
        name: `${appId}-main`,
        component: AdvancedSearchView,
        meta: {
          authContext: 'user',
          title: $gettext('Advanced Search')
        }
      },
      {
        path: '/search/:queryId',
        name: `${appId}-saved`,
        component: AdvancedSearchView,
        props: true,
        meta: {
          authContext: 'user',
          title: $gettext('Saved Search')
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
        priority: 25, // After Files, before Photos
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
