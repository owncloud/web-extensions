# E2e tests

## Structure
```plaintext
web-extensions/
├── packages/
│   ├── web-app-.../        // Tests for the specific web application
│   │   ├── tests/
│   │   │   ├── e2e/        // e2e tests for the application
│   │   │   ├── unit/       // unit tests for the application
├── support/                // Supporting files for tests (helpers, page objects, etc.)
│   ├── helpers/            // Helper functions and utilities
│   │   ├── authHelper.ts   
│   │   ├── ...             
│   ├── pages/              // Page Object Model (POM) files
│   │   ├── loginPage.ts    
│   │   ├── ...             
├── playwright.config.js     // Playwright configuration file
```

## Playwright Test Configuration
This Playwright configuration defines multiple projects for testing web applications in different browsers. Each project is assigned its own set of browsers, and the configuration includes settings for parallel test execution, retries, and reporting.

### Available Test Projects

 - **chrome**: Run e2e tests using the Chrome browser.
 - **firefox**: Run e2e tests using the Firefox browser.
 - **webKit**: Run e2e tests using the Safari WebKit browser.


## Running Tests
## Using Playwright Extension for VSCode
[Install Playwright Extension for VSCode](vscode:extension/ms-playwright.playwright)


## Using the Console (CLI)

### running all tests
```shell
$ pnpm test:e2e
```

### running all tests using chrome
```shell
$ pnpm test:e2e --project="chrome"
```

### to see browser please disable headless Mode
```shell
$ pnpm test:e2e --project="chrome" packages/web-app-draw-io --headed
```

### running specific test
```shell
$ pnpm test:e2e --project="chrome" packages/web-app-draw-io/tests/e2e/createDrawIo.spec.ts
```
