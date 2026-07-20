# AI Project Space Status Board

An ownCloud Infinite Scale (oCIS) folder-view extension that adds a **Status Board**
view mode to the file list, alongside the built-in "Table" and "Tiles" views. Instead of
a flat grid, files are grouped into three lanes — **Draft**, **In Review**, and **Final**
— so a project/space manager can see deliverable status at a glance without opening every
file.

The board reuses the file listing the file view has already loaded (no extra WebDAV
listing call). For each file it sends the name plus a short content excerpt to an
admin-configured, OpenAI-compatible LLM endpoint, which returns a lane classification per
file.

No LLM provider is bundled and no API keys are embedded in the browser — the endpoint is
fully operator-controlled (BYO-LLM).

Requests flow **browser → `ai-llm-proxy` sidecar → LLM**. The sidecar validates the user's
oCIS bearer token and forwards the request to the configured LLM with the API key injected
server-side. The API key never reaches the browser.

## Features

- Adds a "Status Board" entry to the file view's view-mode switcher
- Classifies every file into Draft / In Review / Final on load; a **Re-run classification**
  button re-classifies on demand
- Batches all files in the current folder into a single LLM call per run (not one call per
  file), bounded to the first 60 files — the rest default to Draft and a banner notes the
  truncation
- Structured output via `response_format: json_object`; falls back to parsing one
  `"<fileId-or-name>: <lane>"` line per file when the LLM returns malformed or non-JSON text
- Per-file content excerpts (first ~2 KB) are fetched for text-like files only; binary files,
  unsupported mime types, and files above the fetch-size cap fall back to filename-only
  classification
- Files with no match in either the structured or line-parsed response default to the Draft
  lane rather than being dropped, so every file is always shown somewhere
- Graceful degradation when no LLM is configured: the board still renders with every file in
  the Draft lane and no network calls are made
- User's preferred UI language is forwarded to the LLM for any explanatory text (lane values
  themselves are always the English wire vocabulary `draft` / `in-review` / `final`)

## Extension Point

| ID | Type |
|----|------|
| `app.files.folder-views.folder` | `folderView` — "Status Board" view mode |

`app.files.folder-views.project-spaces` (the project-spaces *overview*, i.e. the grid of
space tiles) has no files to classify. The file listing inside an opened space — where this
board actually renders — is the generic `app.files.folder-views.folder` extension point, so
the board is registered there.

## Configuration

### Web App Config

Admins set the proxy endpoint and model in the oCIS Web app config. The key **must** match
the Docker mount target directory (`ai-project-board-view`), not the package name:

```yaml
ai-project-board-view:
  config:
    llm:
      endpoint: "https://your-ocis.example.com/ai-llm-proxy/v1"
      model: "llama3.1:70b"
```

The board reads `applicationConfig.llm` at startup. If `endpoint` or `model` is missing, the
Status Board view mode is still available but every file is shown in the Draft lane and no
LLM calls are made.

### `ai-llm-proxy` Sidecar

The sidecar is configured entirely via environment variables — the LLM API key stays
server-side and never reaches the browser:

| Variable | Required | Description |
|----------|----------|--------------|
| `OCIS_URL` | yes | oCIS base URL, used to validate OIDC bearer tokens |
| `LLM_ENDPOINT` | yes | LLM base URL (OpenAI-compatible, e.g. `http://localhost:11434/v1`) |
| `LLM_API_KEY` | no | API key forwarded to the LLM in `Authorization: Bearer` |
| `PORT` | no | Listening port, default `3030` |
| `NODE_TLS_REJECT_UNAUTHORIZED` | no | Set to `0` for dev stacks with self-signed certs |

In the dev docker-compose stack the sidecar is exposed at
`https://host.docker.internal:9200/ai-llm-proxy/v1` via Traefik.

## Classification Output

The LLM is prompted to return a JSON object with one key:

- **classifications** — an array of `{ fileId, lane }` objects, where `fileId` matches a
  file's resource ID verbatim and `lane` is one of `draft`, `in-review`, `final`

When the response is not valid JSON, the raw text is parsed line by line
(`"<fileId-or-name>: <lane>"`, matched against keywords `final`/`approved`/`done`,
`review`/`in-review`, `draft`) instead.

## Board States

| State | Shown when |
|-------|-----------|
| Loading | Classification request in flight — spinner over the lane area |
| Board | Classification complete — three lanes with file cards, "Re-run classification" enabled |
| Empty | The current folder has no files |
| Unconfigured notice | No LLM endpoint configured — all files shown in Draft |
| Error | Endpoint unreachable, auth failure, rate-limit, cross-origin block, or malformed response |
| Truncated notice | More than 60 files in the folder — only the first 60 were classified |

Errors are shown inside the board and include admin-actionable guidance (e.g. "Check the
endpoint URL in admin settings").

## Security

- The extension enforces a same-origin check on the configured LLM endpoint before attaching
  the user's oCIS bearer token. Cross-origin endpoints are rejected with an in-board error
  message instead of being called.
- No API key is ever stored in or passed through extension config — the key lives
  exclusively in the `ai-llm-proxy` server environment.

## Development

```bash
# Install dependencies (from repo root)
pnpm install

# Build the extension
pnpm -F web-app-ai-project-board-view build

# Type check
pnpm -F web-app-ai-project-board-view check:types

# Unit tests
pnpm -F web-app-ai-project-board-view test:unit

# E2E tests (requires a running oCIS instance — see root README for setup)
pnpm -F web-app-ai-project-board-view test:e2e
```

See the root `README.md` for how to run a local oCIS development environment with the
extension loaded.
