import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-photo-addon',
  server: {
    port: 9728
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'photo-addon.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
