import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-importer',
  server: {
    port: 9728
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'importer.js'
      }
    }
  }
})
