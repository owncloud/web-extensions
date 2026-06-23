import { defineWebApplication } from '@ownclouders/web-pkg'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'

const APP_ID = 'ai-sensitive-data-scanner'

export default defineWebApplication({
  setup() {
    const { $pgettext } = useGettext()

    const extensions = computed(() => [])

    return {
      appInfo: {
        name: $pgettext('AI Sensitive Data Scanner extension name', 'AI Sensitive Data Scanner'),
        id: APP_ID
      },
      extensions
    }
  }
})
