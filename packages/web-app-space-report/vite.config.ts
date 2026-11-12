import { defineConfig } from '@ownclouders/extension-sdk'

export default defineConfig({
  name: 'web-app-space-report',
  server: {
    port: 9733
  },
  build: {
    rollupOptions: {
      // jsPDF loads these lazily only for doc.html()/SVG, which we don't use; keep them out
      external: [
        'vue',
        'luxon',
        'pinia',
        'vue3-gettext',
        '@ownclouders/web-client',
        '@ownclouders/web-client/graph',
        '@ownclouders/web-client/graph/generated',
        '@ownclouders/web-client/ocs',
        '@ownclouders/web-client/sse',
        '@ownclouders/web-client/webdav',
        '@ownclouders/web-pkg',
        'web-client',
        'web-pkg',
        'html2canvas',
        'dompurify',
        'canvg'
      ],
      output: {
        // one file: Web loads extensions via requirejs, lazy chunks would need extra path config
        inlineDynamicImports: true,
        entryFileNames: 'space-report.js'
      }
    }
  },
  test: {
    environment: 'happy-dom',
    exclude: ['**/e2e/**']
  }
})
