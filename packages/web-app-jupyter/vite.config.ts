import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-jupyter',
  server: {
    port: 9735
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'jupyter.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
