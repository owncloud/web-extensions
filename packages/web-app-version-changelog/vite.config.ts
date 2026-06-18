import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-version-changelog',
  server: {
    port: 9731
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
