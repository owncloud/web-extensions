# AI Folder README Generator

Adds a **Generate README** context-menu action for folders in ownCloud
Infinite Scale (oCIS). On demand it lists the folder's top-level contents via
WebDAV, samples up to 10 short text/Markdown files (capped at 12 000
characters total) for content context, and sends a compact prompt to an
admin-configured, OpenAI-compatible LLM endpoint. The response is rendered
into a structured `README.md` and written back into the folder via WebDAV
`PUT`. If the folder already contains a `README.md`, the user is asked to
confirm before it is overwritten.

No LLM provider is bundled and no API keys are embedded in the browser — the
endpoint is fully operator-controlled (BYO-LLM).

Requests flow **browser → `ai-llm-proxy` sidecar → LLM**. The sidecar lives in
`packages/ai-llm-proxy`, validates the user's oCIS bearer token, and forwards
the request to the configured LLM with the API key injected server-side. The
API key never reaches the browser.

## Extension Point

| ID | Type |
|----|------|
| `global.files.context-actions` | `action` — "Generate README" entry, visible only when a single folder is selected and an LLM endpoint is configured |

The action is hidden entirely when no LLM endpoint is configured, so users on
unconfigured deployments never see a broken or no-op menu entry.

## Configuration

### Web App Config

Admins set the proxy endpoint and model in the oCIS Web app config:

```yaml
ai-folder-readme-generator:
  config:
    llm:
      endpoint: "https://your-ocis.example.com/ai-llm-proxy/v1"
      model: "llama3.1:70b"
```

The key **must** match the Docker mount target directory
(`ai-folder-readme-generator`), not the package name. The action reads
`applicationConfig.llm` at startup. If `endpoint` or `model` is missing, the
context-menu entry is not shown.

### `ai-llm-proxy` Sidecar

The sidecar is configured entirely via environment variables — the LLM API
key stays server-side and never reaches the browser:

| Variable | Required | Description |
|----------|----------|--------------|
| `OCIS_URL` | yes | oCIS base URL, used to validate OIDC bearer tokens |
| `LLM_ENDPOINT` | yes | LLM base URL (OpenAI-compatible, e.g. `http://localhost:11434/v1`) |
| `LLM_API_KEY` | no | API key forwarded to the LLM in `Authorization: Bearer` |
| `PORT` | no | Listening port, default `3030` |
| `NODE_TLS_REJECT_UNAUTHORIZED` | no | Set to `0` for dev stacks with self-signed certs |

In the dev docker-compose stack the sidecar is exposed at
`https://host.docker.internal:9200/ai-llm-proxy/v1` via Traefik. Set
`AI_LLM_ENDPOINT` and `AI_LLM_API_KEY` in a `.env` file or as shell variables
before running `docker compose up`.

## Generation Flow

1. List the folder's top-level children via WebDAV (`depth: 1`).
2. If a `README.md` already exists among the children, show a confirmation
   dialog before continuing — cancelling aborts generation with no write.
3. Sample up to 10 text/Markdown files (`.txt`, `.md`), capped at 12 000
   characters combined, for content context.
4. Send the folder name, top-level listing, and sampled content to the LLM,
   asking for a single JSON object with `headline`, `subheadline`, `purpose`,
   `key_files`, and `usage_notes`.
5. Render the JSON into sectioned Markdown (Tier 1). If the response isn't
   valid JSON, the raw text is written as-is instead (Tier 2).
6. Write the result to `README.md` in the folder via WebDAV `PUT`.

## Output Format

When the LLM returns the requested JSON shape, the rendered `README.md`
contains:

- `# <headline>` — a short title (max 8 words)
- `## <subheadline>` — a one-sentence tagline
- `## Overview` — a 2–4 sentence paragraph describing the folder's purpose
- `## Key Files` — a table of the most important files and short descriptions
- `## Usage` — 2–5 short, practical usage notes as a bulleted list

When the LLM returns plain text instead of JSON, that text is written to
`README.md` unmodified.

## Overwrite Confirmation

Because this extension registers only a context-menu action (no sidebar
panel), the overwrite confirmation dialog (`OverwriteDialog.vue`) is mounted
as a standalone Vue app into a `div` appended to `document.body` and torn
down once the user responds. It installs its own `oc-button` registration and
gettext instance since it does not inherit the host app's plugins.

## Errors

Generation failures (LLM unreachable, timeout, auth failure, rate limiting,
malformed response) surface as an error notification with actionable guidance
(e.g. "Check the endpoint URL in admin settings"). Cancelling the overwrite
dialog is not an error — it silently aborts generation.

## Security

- The extension enforces a same-origin check on the configured LLM endpoint
  before attaching the user's oCIS bearer token. Cross-origin endpoints are
  rejected.
- No API key is ever stored in or passed through extension config — the key
  lives exclusively in the `ai-llm-proxy` server environment.

## Development

```bash
# Install dependencies (from repo root)
pnpm install

# Build the extension
pnpm --filter web-app-ai-folder-readme-generator build

# Type check
pnpm --filter web-app-ai-folder-readme-generator check:types

# Unit tests
pnpm --filter web-app-ai-folder-readme-generator test:unit

# E2E tests (requires a running oCIS instance — see root README for setup)
pnpm --filter web-app-ai-folder-readme-generator test:e2e
```

See the root `README.md` for how to run a local oCIS development environment
with the extension loaded.
