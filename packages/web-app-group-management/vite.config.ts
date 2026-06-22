import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-group-management',
  server: {
    port: 9732
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'group-management.js'
      }
    }
  },
  test: {
    environment: 'happy-dom',
    exclude: ['**/e2e/**']
  }
})
