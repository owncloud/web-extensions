# AI Folder Brief Sidebar

An ownCloud Infinite Scale (oCIS) sidebar panel extension that generates a short narrative
overview of any folder selected in the file browser. When a user selects exactly one folder,
the **Folder Brief** tab appears in the right sidebar. The extension reads the folder's
direct-child listing (names, types, sizes, and last-modified dates — no file content is
downloaded) and sends it to an admin-configured, OpenAI-compatible LLM endpoint to produce a
concise brief covering the folder's apparent purpose, its main content categories, and recent
activity.

No LLM provider is bundled and no API keys are embedded in the browser — the endpoint is
fully operator-controlled (BYO-LLM).

Requests flow **browser → `ai-llm-proxy` sidecar → LLM**. The sidecar validates the user's
oCIS bearer token and forwards the request to the configured LLM with the API key injected
server-side. The API key never reaches the browser.

## Features

- Auto-generates a folder brief on panel open; a **Regenerate** button re-runs on demand
- Structured output when the LLM supports `response_format`: three labelled sections
  (Summary / Files by type / Recent changes)
- Graceful degradation when no LLM is configured: a static file-type breakdown is computed
  client-side from the listing alone (no network request to the LLM)
- Empty folders are handled cleanly — shows "This folder is empty." without calling the LLM
- Large listings are capped at 8 000 characters before being sent to the LLM
- User's preferred UI language is forwarded to the LLM in the prompt
- Registered on the `global.files.sidebar` extension point with an `isFolder` guard

## Extension Point

| ID | Type |
|----|------|
| `global.files.sidebar` | `sidebarPanel` — "Folder Brief" tab, visible only when a single folder is selected |

## Configuration

### Web App Config

Admins set the proxy endpoint and model in the oCIS Web app config:

```yaml
ai-folder-brief-sidebar:
  config:
    llm:
      endpoint: "https://your-ocis.example.com/ai-llm-proxy/v1"
      model: "llama3.1:70b"
```

The key **must** match the Docker mount target directory (`ai-folder-brief-sidebar`), not the
package name. The panel reads `applicationConfig.llm` at startup. If `endpoint` or `model` is
missing the panel falls back to the static file-type breakdown — no LLM calls are made.

### `ai-llm-proxy` Sidecar

The sidecar is configured entirely via environment variables — the LLM API key stays
server-side and never reaches the browser:

| Variable | Required | Description |
|----------|----------|-------------|
| `OCIS_URL` | yes | oCIS base URL, used to validate OIDC bearer tokens |
| `LLM_ENDPOINT` | yes | LLM base URL (OpenAI-compatible, e.g. `http://localhost:11434/v1`) |
| `LLM_API_KEY` | no | API key forwarded to the LLM in `Authorization: Bearer` |
| `PORT` | no | Listening port, default `3030` |
| `NODE_TLS_REJECT_UNAUTHORIZED` | no | Set to `0` for dev stacks with self-signed certs |

In the dev docker-compose stack the sidecar is exposed at
`https://host.docker.internal:9200/ai-llm-proxy/v1` via Traefik. Set `AI_LLM_ENDPOINT` and
`AI_LLM_API_KEY` in a `.env` file or as shell variables before running `docker compose up`.

## Output Format

The LLM is prompted to return a JSON object with three keys:

- **summary** — a 2–3 sentence paragraph describing the apparent purpose of the folder
- **filesByType** — one sentence grouping files by category (e.g. "Mostly PDFs and spreadsheets")
- **recentChanges** — one sentence about the most recently modified items

When the LLM returns plain text instead of JSON (e.g. a basic text model that ignores
`response_format`), the raw text is placed in **summary** and the other two fields are omitted.

When no LLM is configured, only **summary** is populated (from the client-side breakdown) and
the Regenerate button is hidden.

## States

| State | Shown when |
|-------|-----------|
| Loading | WebDAV listing or LLM request in flight |
| Static brief | No LLM configured — file-type breakdown computed client-side |
| LLM brief | LLM response received and rendered |
| Error | Endpoint unreachable, auth failure, rate-limit, or malformed response |

Errors are shown inside the panel and include admin-actionable guidance (e.g. "Check the
endpoint URL in admin settings").

## Development

```bash
# Install dependencies (from repo root)
pnpm install

# Build the extension
pnpm -F web-app-ai-folder-brief-sidebar build

# Type check
pnpm -F web-app-ai-folder-brief-sidebar check:types

# Unit tests
pnpm -F web-app-ai-folder-brief-sidebar test:unit

# E2E tests (requires a running oCIS instance — see root README for setup)
pnpm -F web-app-ai-folder-brief-sidebar test:e2e
```

See the root `README.md` for how to run a local oCIS development environment with the
extension loaded.
