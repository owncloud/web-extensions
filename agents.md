# agents.md — web-extensions

## Repository Overview

A collection of supplementary ownCloud Web extensions maintained outside the main web repository. Includes extensions for draw.io, JSON viewing, file casting, advanced search, photo enhancements, file importing, progress bars, external sites and ZIP extraction.

- **Classification:** oCIS
- **Activity Status:** Active
- **License:** AGPL-3.0
- **Language:** Vue.js, TypeScript

## Architecture & Key Paths

- `packages/` — Monorepo containing individual extensions:
  - `packages/web-app-advanced-search/` — Advanced search extension
  - `packages/web-app-cast/` — File casting extension
  - `packages/web-app-draw-io/` — Draw.io diagram integration
  - `packages/web-app-external-sites/` — External site embedding
  - `packages/web-app-importer/` — File import extension
  - `packages/web-app-json-viewer/` — JSON file viewer
  - `packages/web-app-photo-addon/` — Photo enhancement features
  - `packages/web-app-progress-bars/` — Progress bar extension
  - `packages/web-app-unzip/` — ZIP extraction extension
- `docs/` — Documentation (starting guide, release workflow)
- `docker/` — Docker build files
- `dev/` — Development environment configuration
- `support/` — Support scripts
- `Makefile` — Build orchestration
- `package.json` — Root package with scripts
- `pnpm-workspace.yaml` — pnpm monorepo workspace configuration
- `playwright.config.ts` — Playwright e2e test configuration
- `eslint.config.js` — ESLint configuration

## Development Conventions

- pnpm monorepo with workspace packages
- Prettier for code formatting
- Vite for building individual extensions
- Playwright for e2e testing
- GitHub Actions CI
- Each extension is independently versioned and releasable
- Release workflow documented in `docs/RELEASE_WORKFLOW.md`

## Build & Test Commands

```bash
pnpm install                # Install dependencies
pnpm build                  # Build all extensions
pnpm test:unit               # Run unit tests
pnpm test:e2e                # Run E2E tests
pnpm lint                   # Run ESLint
```

## Important Constraints

- **AGPL-3.0 copyleft license:** The OSPO Apache 2.0 migration requires auditing this copyleft license.
- **Monorepo structure:** Each extension in `packages/` can be built and released independently.
- **oCIS dependency:** Extensions require oCIS and ownCloud Web to function.
- **Docker image:** Published as `owncloud/web-extensions` on Docker Hub.
- **External dependencies:** Some extensions (draw.io, external sites) embed or connect to third-party services.


## OSPO Policy Constraints

### GitHub Actions
- **Only** use actions owned by `owncloud`, created by GitHub (`actions/*`), verified on the GitHub Marketplace, or verified by the ownCloud Maintainers.
- Pin all actions to their full commit SHA (not tags): `uses: actions/checkout@<SHA> # vX.Y.Z`
- Never introduce actions from unverified third parties.

### Dependency Management
- Dependabot is configured for automated dependency updates.
- Review and merge Dependabot PRs as part of regular maintenance.
- Do not introduce new dependencies without discussion in an issue first.

### Git Workflow
- **Rebase policy**: Always rebase; never create merge commits. Use `git pull --rebase` and `git rebase` before pushing.
- **Signed commits**: All commits **must** be PGP/GPG signed (`git commit -S -s`).
- **DCO sign-off**: Every commit needs a `Signed-off-by` line (`git commit -s`).
- **Conventional Commits & Squash Merge**: Use the [Conventional Commits](https://www.conventionalcommits.org/) format where the repository enforces it. Many repos use squash merge, where the PR title becomes the commit message on the default branch — apply Conventional Commits format to PR titles as well. A reusable GitHub Actions workflow enforces this.

## Context for AI Agents

- This is a pnpm monorepo containing multiple independent web extensions.
- Each extension in `packages/` has its own `package.json`, source code and build config.
- The `docs/starting_guide.md` explains how to add new extensions to the repository.
- Docker images bundle all extensions together for deployment.
- Extensions register with the oCIS Web runtime via the extension system API.
- Development environment uses Docker Compose with an oCIS backend.
