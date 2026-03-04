import { defineWebApplication, Extension } from '@ownclouders/web-pkg'
import { computed, markRaw } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { useGettext } from 'vue3-gettext'
import FavoritesSidebarPanel from './components/FavoritesSidebarPanel.vue'
import FavoritesView from './views/FavoritesView.vue'
import translations from '../l10n/translations.json'

const appId = 'favorites'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const routes: RouteRecordRaw[] = [
      {
        path: '/',
        redirect: '/files/favorites'
      },
      {
        path: '/files/favorites',
        name: appId,
        component: FavoritesView,
        meta: {
          authContext: 'user',
          title: $gettext('Favorites')
        }
      }
    ]

    const navItem = {
      id: 'favorites',
      name: 'favorites',
      icon: 'star',
      label: () => $gettext('Favorites'),
      path: '/files/favorites',
      priority: 35
    }

    const extensions = computed<Extension[]>(() => [
      {
        id: 'com.github.owncloud.web.favorites.sidebar-panel',
        type: 'sidebarPanel',
        extensionPointIds: ['app.files.sidebar'],
        panel: {
          id: 'tags-favorites',
          title: $gettext('Favorites'),
          icon: 'star',
          component: markRaw(FavoritesSidebarPanel),
          order: 210,
          sortOrder: 210
        }
      } as Extension,
      {
        id: 'com.github.owncloud.web.favorites.nav-item',
        type: 'sidebarNav',
        extensionPointIds: ['app.files.navItems'],
        action: navItem,
        navItem
      } as Extension
    ])

    return {
      appInfo: {
        id: appId,
        name: $gettext('Favorites')
      },
      routes,
      extensions,
      translations
    }
  }
})
