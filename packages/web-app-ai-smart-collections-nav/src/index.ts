import { defineWebApplication } from '@ownclouders/web-pkg'
import type { AppMenuItemExtension, SidebarNavExtension } from '@ownclouders/web-pkg'
import { RouteRecordRaw } from 'vue-router'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'
import type { LLMConfig } from './composables/useLLM'
import CollectionsView from './views/CollectionsView.vue'

const APP_ID = 'ai-smart-collections-nav'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $gettext } = useGettext()

    const appInfo = {
      id: APP_ID,
      name: $gettext('Collections'),
      icon: 'sparkling-2',
      color: '#0066cc'
    }

    const rawLlm = applicationConfig?.llm as Record<string, unknown> | undefined
    const llmConfig: LLMConfig | null =
      typeof rawLlm?.endpoint === 'string' && typeof rawLlm?.model === 'string'
        ? { endpoint: rawLlm.endpoint, model: rawLlm.model }
        : null

    const routes: RouteRecordRaw[] = [
      {
        path: '/',
        name: `${APP_ID}-main`,
        component: CollectionsView,
        props: () => ({ llmConfig }),
        meta: {
          authContext: 'user',
          title: $gettext('Collections')
        }
      }
    ]

    // Registers a Files-app-left-nav "Collections" entry per the spec's extension_point
    // (app.files.navItems). Confirmed against a live gate run that the installed web-pkg
    // (12.4.2) never renders it — the extension point id doesn't appear anywhere in its
    // bundle, and the Files app's real sidebar nav lists only its four built-in items with
    // no "Collections" entry. Kept for forward-compatibility (harmless no-op today), but an
    // appMenuItem is also registered below as the actual, working entry point — the same
    // proven mechanism draw-io/group-management/advanced-search use.
    const extensions = computed<(SidebarNavExtension | AppMenuItemExtension)[]>(() => [
      {
        id: `${APP_ID}.navItem`,
        type: 'sidebarNav',
        extensionPointIds: ['app.files.navItems'],
        navItem: {
          name: () => appInfo.name,
          icon: appInfo.icon,
          route: { name: `${APP_ID}-main` },
          isVisible: () => llmConfig !== null,
          priority: 30
        }
      },
      {
        id: `app.${APP_ID}.menuItem`,
        type: 'appMenuItem',
        label: () => appInfo.name,
        color: appInfo.color,
        icon: appInfo.icon,
        priority: 30,
        path: `/${APP_ID}`
      }
    ])

    return {
      appInfo,
      routes,
      extensions,
      translations
    }
  }
})
