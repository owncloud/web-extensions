import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-external-sites',
  server: {
    port: 9725
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'external-sites.js'
      }
    }
  }
})
