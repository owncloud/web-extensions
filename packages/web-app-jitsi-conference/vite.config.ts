import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-jitsi-conference',
  server: {
    port: 9742
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'jitsi-conference.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
