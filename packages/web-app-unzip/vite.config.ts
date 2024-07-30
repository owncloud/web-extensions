import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-unzip',
  server: {
    port: 9727
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'unzip.js'
      }
    }
  }
})
