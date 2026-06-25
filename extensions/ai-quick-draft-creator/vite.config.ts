import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'ai-quick-draft-creator',
  server: {
    port: 9731, // Increment this port number for each new extension.
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
