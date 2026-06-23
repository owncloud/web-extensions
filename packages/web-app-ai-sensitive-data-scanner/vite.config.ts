import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-ai-sensitive-data-scanner',
  server: {
    port: 9733
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'ai-sensitive-data-scanner.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**'],
    pool: 'forks'
  }
})
