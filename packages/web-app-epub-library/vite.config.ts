import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-epub-library',
  server: {
    port: 9731
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'epub-library.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
