import { defineWebApplication } from '@ownclouders/web-pkg'
import type { SidebarNavExtension } from '@ownclouders/web-pkg'
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

    // Contributes a "Collections" entry to the Files app's own left nav (a materially
    // different location than the global app switcher's appMenuItem), so users can browse
    // AI-inferred thematic groups without leaving the Files app's navigation shell.
    const extensions = computed<SidebarNavExtension[]>(() => [
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
