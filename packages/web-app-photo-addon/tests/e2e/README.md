# E2E Tests for Photo Addon

End-to-end tests for the oCIS Photo Addon using Playwright.

## Prerequisites

### System Dependencies

Chromium requires system libraries. Install them with:

```bash
# Ubuntu/Debian
sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libasound2 libpango-1.0-0 libcairo2

# Or use Playwright's built-in installer (requires sudo)
npx playwright install-deps chromium
```

### Environment Variables

Set the following environment variables before running tests:

```bash
export BASE_URL_OCIS="https://cloud.faure.ca"  # Optional, defaults to cloud.faure.ca
export OCIS_USER="admin"                        # Optional, defaults to admin
export OCIS_PASSWORD="your-password"            # Required
```

Note: `OCIS_URL` is also supported as an alias for `BASE_URL_OCIS`.

## Running Tests

From the monorepo root:

```bash
# Run all E2E tests (headless)
pnpm test:e2e

# Run with browser UI visible
pnpm test:e2e:headed

# Run with Playwright UI (interactive)
pnpm test:e2e:ui

# Debug mode (step through tests)
pnpm test:e2e:debug
```

## Test Structure

- `fixtures.ts` - Test fixtures with authenticated context and helper functions
- `global-setup.ts` - Authenticates once and saves session state
- `photo-gallery.spec.ts` - Photo gallery loading and display tests
- `lightbox.spec.ts` - Lightbox viewer functionality tests
- `map-view.spec.ts` - Map view and marker tests

## Authentication

Tests use cached authentication to avoid re-logging in for each test:

1. First run performs OIDC login via browser using the shared `LoginPage`
2. Session state saved to `tests/e2e/.auth/user.json`
3. Subsequent runs (within 10 minutes) reuse the cached session

To force re-authentication, delete the auth file:

```bash
rm packages/web-app-photo-addon/tests/e2e/.auth/user.json
```

## Test Coverage

### Photo Gallery
- App loading and title display
- Photo grid or empty state
- View switcher controls
- Date grouping headers
- Grouping mode switching (Day/Week/Month/Year)
- Thumbnail loading
- Infinite scroll

### Lightbox Viewer
- Opening/closing lightbox
- Keyboard navigation (arrows, Escape)
- Full-size image display
- Navigation buttons
- EXIF metadata panel
- Download button
- GPS location link

### Map View
- Map toggle button
- Leaflet map integration
- Tile loading
- Zoom controls
- Photo markers
- Marker clusters
- Marker interaction (hover, click)

## Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

Reports and artifacts are stored in:
- HTML report: `playwright-report/index.html`
- Screenshots on failure: `test-results/`
- Videos on failure: `test-results/`

## Shared Infrastructure

These tests leverage the monorepo's shared support infrastructure:
- `support/pages/loginPage.ts` - Login page object
- `support/helpers/authHelper.ts` - Authentication helpers
- `support/helpers/actorHelper.ts` - Browser context management

## Writing New Tests

Import the custom fixtures to get authenticated context:

```typescript
import { test, expect, navigateToPhotoView, waitForPhotosLoaded } from './fixtures'

test('my test', async ({ page }) => {
  await navigateToPhotoView(page)
  await waitForPhotosLoaded(page)
  // ... test code
})
```

## CI/CD

For CI environments, ensure:
1. System dependencies are installed
2. `OCIS_PASSWORD` is set as a secret
3. Tests run with `pnpm test:e2e`
