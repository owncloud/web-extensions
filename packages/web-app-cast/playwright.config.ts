import { defineConfig, devices } from '@playwright/test'
import baseConfig from '../../playwright.config'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...baseConfig,
  testDir: './tests/e2e',
  projects: [
    {
      name: 'chrome',
      testMatch: '**/e2e/*.spec.ts',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', ignoreHTTPSErrors: true }
    }
  ]
})
