import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'ai-data-insights-sidebar',
  server: {
    port: 9733,
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
      },
    },
  },
  test: {
    exclude: ['**/e2e/**'],
  },
})
