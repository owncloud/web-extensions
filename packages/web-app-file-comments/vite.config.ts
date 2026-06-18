import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-file-comments',
  server: {
    port: 9730
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'file-comments.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
