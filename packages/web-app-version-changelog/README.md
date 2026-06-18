# AI Version Changelog Sidebar

[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

An ownCloud Infinite Scale (oCIS) sidebar panel extension that generates human-readable changelog
entries for each file version. When a user selects a file with version history, the "Changelog"
panel appears alongside the standard file history. Each version row has a **Generate** button
that diffs the two version blobs on-demand and sends the diff to a configured BYO-LLM endpoint
to produce a concise description of what changed.

## Features

- On-demand changelog generation per version pair (no backend service required)
- LLM output is a short casual prose summary ("Added the budget forecast for Q3…"), rendered in the user's UI language
- Session-scoped cache — the same version pair is never sent to the LLM twice
- Per-row error state with Retry button
- Graceful degradation when no LLM endpoint is configured (version list still visible, Generate button disabled)
- Binary file detection — shows a clear message instead of sending binary diffs
- Registered on the `global.files.sidebar` extension point

## Configuration

Add an `llm` block to your oCIS web configuration:

```yaml
web:
  config:
    options:
      apps:
        - web-app-version-changelog
      llm:
        endpoint: "https://your-ocis.example.com/ai-llm-proxy/v1"
        model: "llama3.1:70b"
```

The endpoint must be OpenAI-compatible (`POST /chat/completions`). The Bearer token from the
current user session is forwarded as the `Authorization` header, so endpoint-level auth is
handled by the proxy you configure in oCIS.

## Known Limitations (v1)

- Text-based files only (`.txt`, `.md`, etc.). Binary files (images, Office documents, PDFs)
  show a "Binary files are not supported" notice — no diff is generated.
- The diff is truncated to 8 000 characters before being sent to the LLM; very large version
  diffs will be summarised from a partial view of the changes.

## Development

```bash
# Install dependencies (from repo root)
pnpm install

# Build the extension
pnpm -F web-app-version-changelog build

# Type check
pnpm -F web-app-version-changelog check:types

# Unit tests
pnpm -F web-app-version-changelog test:unit

# E2E tests (requires a running OCIS instance — see root README for setup)
pnpm -F web-app-version-changelog test:e2e
```

See the root `README.md` for how to run a local OCIS development environment with the extension
loaded.
