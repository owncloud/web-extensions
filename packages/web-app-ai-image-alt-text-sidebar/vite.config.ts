import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-ai-image-alt-text-sidebar',
  server: {
    port: 9731
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'ai-image-alt-text.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**'],
    pool: 'forks'
  }
})
