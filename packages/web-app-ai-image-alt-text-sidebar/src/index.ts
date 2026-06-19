import { defineWebApplication } from '@ownclouders/web-pkg'
import { computed } from 'vue'

const APP_ID = 'ai-image-alt-text'

export default defineWebApplication({
  setup() {
    return {
      appInfo: {
        name: 'AI Image Alt-Text',
        id: APP_ID
      },
      extensions: computed(() => [])
    }
  }
})
