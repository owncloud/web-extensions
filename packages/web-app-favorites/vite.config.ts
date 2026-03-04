import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-favorites',
  server: {
    port: 9731
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'favorites.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
