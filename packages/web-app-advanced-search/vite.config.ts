import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-advanced-search',
  server: {
    port: 9727
  },
  build: {
    rollupOptions: {
      external: [
        '@ownclouders/design-system',
        '@ownclouders/design-system/components'
      ],
      output: {
        entryFileNames: 'advanced-search.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
