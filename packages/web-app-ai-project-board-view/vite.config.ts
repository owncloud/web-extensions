import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'ai-project-board-view',
  server: {
    port: 9734,
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
