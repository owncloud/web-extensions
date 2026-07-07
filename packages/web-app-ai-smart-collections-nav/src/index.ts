import { defineWebApplication } from '@ownclouders/web-pkg'
import type { AppMenuItemExtension } from '@ownclouders/web-pkg'
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

    // The spec's originally requested location — a Files-app-left-nav "Collections" entry
    // via the app.files.navItems/sidebarNav extension point — was tried first, then dropped:
    // a live gate run confirmed the installed web-pkg (12.4.2) never renders it (the
    // extension point id doesn't appear anywhere in its bundle, and the Files app's real
    // sidebar nav lists only its four built-in items). Registering it *alongside* an
    // appMenuItem also caused the appMenuItem itself to stop appearing in the Application
    // Switcher in a live gate run — every other extension in this repo that registers an
    // appMenuItem returns a single-type extensions array, so this follows that exact,
    // proven shape (draw-io/group-management) instead of mixing extension types.
    const extensions = computed<AppMenuItemExtension[]>(() => [
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
