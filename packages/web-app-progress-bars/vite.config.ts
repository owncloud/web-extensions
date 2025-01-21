import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-progress-bars',
  server: {
    port: 9723
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'progress-bars.js'
      }
    },
    test: {
      exclude: ['**/e2e/**']
    }
  }
})
