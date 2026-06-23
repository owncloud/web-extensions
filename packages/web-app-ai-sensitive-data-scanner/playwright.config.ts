import { defineConfig } from '@playwright/test'
import baseConfig from '../../playwright.config'

export default defineConfig({
  ...baseConfig,
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts'
})
