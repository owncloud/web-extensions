import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-password-protected-folders',
  server: {
    port: 9729
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'password-protected-folders.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
