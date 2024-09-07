import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-media-editor',
  server: {
    port: 9728
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'media-editor.js'
      }
    }
  }
})
