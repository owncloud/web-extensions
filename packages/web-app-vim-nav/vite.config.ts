import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-vim-nav',
  server: { port: 9741 },
  build: { rollupOptions: { output: { entryFileNames: 'vim-nav.js' } } },
  test: { exclude: ['**/e2e/**'] }
})
