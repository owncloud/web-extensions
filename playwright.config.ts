import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  // testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: process.env.BASE_URL_OCIS ?? process.env.OCIS_URL ?? 'https://host.docker.internal:9200',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    headless: true
  },

  /* Configure projects for major browsers */
  projects: [
    // Photo Addon E2E tests
    {
      name: 'photo-addon',
      testMatch: '**/*.spec.ts',
      testDir: './packages/web-app-photo-addon/tests/e2e',
      use: { ...devices['Desktop Chrome'], ignoreHTTPSErrors: true }
    },

    // Advanced Search E2E tests
    //{
    //  name: 'advanced-search',
    //  testMatch: '**/*.spec.ts',
    //  testDir: './packages/web-app-advanced-search/tests/e2e',
    //  use: { ...devices['Desktop Chrome'], ignoreHTTPSErrors: true }
    //},

    // Generic browser tests (for other packages)
    {
      name: 'chrome',
      testMatch: '**/e2e/*.spec.ts',
      testIgnore: ['**/packages/web-app-photo-addon/**'],
      //testIgnore: ['**/packages/web-app-photo-addon/**', '**/packages/web-app-advanced-search/**'],
      use: { ...devices['Desktop Chrome'], channel: 'chrome', ignoreHTTPSErrors: true }
    },
    {
      name: 'firefox',
      testMatch: '**/e2e/*.spec.ts',
      testIgnore: ['**/packages/web-app-photo-addon/**'],
      //testIgnore: ['**/packages/web-app-photo-addon/**', '**/packages/web-app-advanced-search/**'],
      use: { ...devices['Desktop Firefox'], browserName: 'firefox', ignoreHTTPSErrors: true }
    },
    {
      name: 'webkit',
      testMatch: '**/e2e/*.spec.ts',
      testIgnore: ['**/packages/web-app-photo-addon/**'],
      //testIgnore: ['**/packages/web-app-photo-addon/**', '**/packages/web-app-advanced-search/**'],
      use: { ...devices['Desktop Safari'], browserName: 'webkit', ignoreHTTPSErrors: true }
    }

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ]
})
