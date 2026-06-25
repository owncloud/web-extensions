# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install                  # Install all dependencies
pnpm build                    # Build all extensions
pnpm build:w                  # Build all extensions in watch mode (development)
pnpm lint                     # Run ESLint across all packages
pnpm check:types              # Run TypeScript checks across all packages
pnpm test:unit                # Run all unit tests
pnpm test:e2e                 # Run all Playwright E2E tests
```

**Per-package (replace `<name>` with package name, e.g. `draw-io`, `advanced-search`):**
```bash
pnpm --filter <name> build
pnpm --filter <name> test:unit
pnpm --filter <name> test:e2e
pnpm --filter <name> check:types
```

**Local development environment:**
```bash
pnpm build && docker compose up -d   # Start full oCIS stack with all extensions mounted
docker compose down --remove-orphans # Stop
docker compose pull                   # Update non-extension images
```

Access the dev environment at `https://host.docker.internal:9200` (login: `admin`/`admin`). Requires `127.0.1.1 host.docker.internal` in `/etc/hosts`.

**Translations:**
```bash
make l10n-read    # Extract gettext strings and create .pot template
make l10n-write   # Generate translations.json from .po files
make l10n-push    # Push source strings to Transifex
make l10n-pull    # Pull translations from Transifex
```

## Architecture

This is a **pnpm monorepo** (`pnpm-workspace.yaml`) of independent ownCloud Web extensions. Each extension in `packages/web-app-*` is a standalone Vue 3 + TypeScript app that integrates into the oCIS (ownCloud Infinite Scale) platform.

### Extension anatomy

Every `web-app-*` package follows the same pattern:

- **`src/index.ts`** — entry point; calls `defineWebApplication()` from `@ownclouders/web-pkg` and returns `{ appInfo, routes, translations, extensions }`
- **`vite.config.ts`** — uses `defineConfig` from `@ownclouders/extension-sdk` (a Vite wrapper)
- **`l10n/translations.json`** — compiled translation strings consumed by the app
- **`tests/unit/`** — Vitest unit tests using `@ownclouders/web-test-helpers`
- **`tests/e2e/`** — Playwright tests; each package has a `playwright.config.ts` that extends the root `playwright.config.ts`

### Extension registration

Extensions register capabilities via the `extensions` array returned from `defineWebApplication`. The key extension types are:

| Type | Purpose | Example |
|------|---------|---------|
| `AppWrapperRoute` | File editor (opens a file in the app) | draw-io, json-viewer |
| `sidebarPanel` | Adds a panel to the file detail sidebar | ai-doc-summary, chat-with-file |
| `action` | Context menu / file action | ai-doc-summary's "Summarize" action |
| `appMenuItem` | Entry in the global app switcher | draw-io |

### Key dependencies

- **`@ownclouders/web-pkg`** — core Web SDK: `defineWebApplication`, stores (Pinia), composables, routing helpers, design system components (`oc-*`)
- **`@ownclouders/web-client`** — typed WebDAV/API client, `Resource` types
- **`@ownclouders/extension-sdk`** — Vite `defineConfig` wrapper for extension builds
- **`@ownclouders/web-test-helpers`** — `mount()` + `defaultPlugins()` for Vitest
- **`vue3-gettext`** — i18n; use `$gettext`/`$pgettext`/`$ngettext` in templates and `useGettext()` in setup

### AI extensions

`packages/web-app-ai-doc-summary` and `packages/web-app-chat-with-file` use the sidebar extension pattern to add AI-powered panels. They communicate with an LLM through `packages/ai-llm-proxy`, which is a plain Node.js HTTP server (not a Vue app) that validates oCIS OIDC tokens and proxies requests to a configured LLM endpoint. The proxy is configured entirely via environment variables (`LLM_ENDPOINT`, `LLM_API_KEY`, `OCIS_URL`, etc.).

**Security requirement — origin validation:** Any code path that calls the LLM proxy (or any LLM endpoint) **must** validate the `Origin` header of incoming requests against `OCIS_URL` and reject requests whose origin does not match. CORS headers alone are browser-enforced and insufficient — the proxy must perform an explicit server-side origin check and return `403` for unexpected origins. Never skip this check when adding new LLM-calling code.

### Design system

All UI must use the ownCloud Design System components from `@ownclouders/web-pkg`. Do not use custom SVG icons when an `oc-icon` equivalent exists. Available icons: `packages/design-system/src/assets/icons` in the `owncloud/web` repo.

### Translations

All user-facing strings must be wrapped with `$gettext()`, `$pgettext()`, or `$ngettext()` (for count-aware plurals). The `gettext.config.cjs` at the repo root configures extraction. Translation files live in each package's `l10n/` directory. Translations are managed via Transifex and synced automatically — do not edit `.po` files or `translations.json` by hand.

### Docker Compose / CSP

The `docker-compose.yml` mounts each extension's `dist/` directory into the oCIS container. When adding a new extension, add its `dist/` mount and update `dev/docker/csp.yaml` if it needs additional CSP directives.

### App configuration (`ocis.apps.yaml`)

`dev/docker/ocis.apps.yaml` and `support/actions/ocis.apps.yaml` supply per-app config (e.g. LLM endpoint, companion URL) to oCIS. The **key for each entry must match the mount target directory**, not the package directory name or the app's internal `applicationId`.

These two files use different conventions because their mounts differ:
- **`dev/docker/ocis.apps.yaml`** (used by `docker-compose.yml`) — mounts strip the `web-app-` prefix (e.g. `./packages/web-app-chat-with-file/dist:/web/apps/chat-with-file`), so the key is `chat-with-file`.
- **`support/actions/ocis.apps.yaml`** (used by CI at `.github/workflows/test.yml`) — the workflow mounts using `${{matrix.app}}` verbatim as the target directory (e.g. `/apps/web-app-chat-with-file`), so the key is `web-app-chat-with-file`.

## Adding a New Extension

1. Create `packages/web-app-<name>/` following the structure of an existing extension
2. Add the `dist/` volume mount in `docker-compose.yml`
3. Provide an `l10n/` directory with the same structure as other extensions
4. Run `pnpm install` from the repo root after creating `package.json`

## Git Workflow

All commits **must** be PGP/GPG signed and carry a DCO sign-off:

```bash
git commit -S -s -m "feat(web-app-foo): add bar feature"
```

Use a rebase workflow — never create merge commits. PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/) format (enforced by CI).

## Releasing

Releases use per-app signed tags on the merge commit: `{app-name}-v{version}` (e.g. `draw-io-v0.4.1`). Each tag independently triggers CI to build, package, and publish that extension. Push tags one at a time — pushing all at once does not reliably trigger the release workflow. See `docs/RELEASE_WORKFLOW.md` for the full process.
