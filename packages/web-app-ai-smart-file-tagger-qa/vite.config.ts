import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'ai-smart-file-tagger-qa',
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
