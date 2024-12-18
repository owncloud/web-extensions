import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-image-editor',
  server: {
    port: 9728
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'image-editor.js'
      }
    }
  }
})
