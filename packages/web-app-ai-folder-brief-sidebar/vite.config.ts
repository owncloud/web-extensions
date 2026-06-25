import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-ai-folder-brief-sidebar',
  server: {
    port: 9733
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'ai-folder-brief-sidebar.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**'],
    pool: 'forks'
  }
})
