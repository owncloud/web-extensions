import { defineConfig } from '@playwright/test'
import baseConfig from '../../playwright.config'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...baseConfig,
  testDir: './tests/e2e',
  use: {
    ...baseConfig.use,
    // Trace mode is forced via `--trace` on the gate's own invocation
    // (gate/run-gate.sh) instead of here, so it doesn't ship in every
    // extension's committed config.
    //
    // Full video/screenshot capture only during the gate's CI run (CI=true
    // is set by gate/run-gate.sh) for demo-media generation; local
    // `pnpm test:e2e` stays lightweight.
    screenshot: process.env.CI ? 'on' : 'only-on-failure',
    video: process.env.CI ? 'on' : 'off'
  }
})
