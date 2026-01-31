import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-advanced-search',
  server: {
    port: 9727
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'advanced-search.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
