import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-chat-with-file',
  server: {
    port: 9730
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'index.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
