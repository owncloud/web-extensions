# E2E Tests for oCIS Advanced Search

End-to-end tests using Playwright to verify the Advanced Search extension works correctly in oCIS.

## Prerequisites

- Node.js 18+
- pnpm
- Chromium (installed via apt or playwright)

## Running Tests

```bash
# Set credentials
export OCIS_PASSWORD='your-password'
export OCIS_USER='admin'  # optional, defaults to 'admin'
export BASE_URL_OCIS='https://cloud.faure.ca'  # optional

# Run all tests
pnpm test:e2e

# Run with visible browser
pnpm test:e2e:headed

# Run with Playwright UI
pnpm test:e2e:ui

# Debug mode
pnpm test:e2e:debug
```

Note: `OCIS_URL` is also supported as an alias for `BASE_URL_OCIS`.

## Authentication

Tests use cached authentication to avoid re-logging in for each test:

1. First run performs OIDC login via browser using the shared `LoginPage`
2. Session state saved to `tests/e2e/.auth/user.json`
3. Subsequent runs (within 10 minutes) reuse the cached session

To force re-authentication, delete the auth file:
```bash
rm packages/web-app-advanced-search/tests/e2e/.auth/user.json
```

## Test Structure

- `fixtures.ts` - Test fixtures with authenticated context and helper functions
- `global-setup.ts` - Authenticates once and saves session state
- `advanced-search.spec.ts` - All advanced search tests

## Test Coverage

- **Advanced Search App**: Loading, basic UI elements
- **Search Functionality**: Text search, Enter key, results/empty states
- **Filter Panel**: Standard filters, Photo/EXIF filters, KQL input
- **View Modes**: List/grid/table switching
- **Active Filters**: Filter chips, Clear All
- **Saved Searches**: Panel open/close, content display
- **Save Search Dialog**: Open, cancel, form input
- **API Integration**: Request tracking, error handling
- **Responsive**: Mobile viewport support

## Test Reports

- HTML report: `playwright-report/index.html`
- Screenshots on failure: `test-results/`
- Videos on failure: `test-results/`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL_OCIS` | Base URL for oCIS | `https://cloud.faure.ca` |
| `OCIS_URL` | Alias for BASE_URL_OCIS | `https://cloud.faure.ca` |
| `OCIS_USER` | oCIS username | `admin` |
| `OCIS_PASSWORD` | oCIS password | (required) |
| `AUTH_CACHE_MINUTES` | Auth file cache duration | `10` |

## Shared Infrastructure

These tests leverage the monorepo's shared support infrastructure:
- `support/pages/loginPage.ts` - Login page object
- `support/helpers/authHelper.ts` - Authentication helpers
- `support/helpers/actorHelper.ts` - Browser context management

## Writing New Tests

Import the custom fixtures to get authenticated context:

```typescript
import { test, expect, navigateToAdvancedSearch, performSearch } from './fixtures'

test('my test', async ({ page }) => {
  await navigateToAdvancedSearch(page)
  await performSearch(page, 'test query')
  // ... test code
})
```

## CI/CD

For CI environments, ensure:
1. System dependencies are installed
2. `OCIS_PASSWORD` is set as a secret
3. Tests run with `pnpm test:e2e`
