import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-cast',
  server: {
    port: 9722
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'cast.js'
      }
    }
  }
})
