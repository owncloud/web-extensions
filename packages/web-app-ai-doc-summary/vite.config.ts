import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-ai-doc-summary',
  server: {
    port: 9729
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'ai-doc-summary.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
