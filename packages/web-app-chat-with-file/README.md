# Chat with File

Adds a **Chat** sidebar panel and a **Chat with file** context-menu action for
supported document types. Once opened, the panel lets users have a
back-and-forth conversation about the file's content — or ask the LLM to
rewrite the file in place.

No LLM provider is bundled and no API keys are embedded in the browser —
the endpoint is fully operator-controlled (BYO-LLM).

Requests flow **browser → `ai-llm-proxy` sidecar → LLM**. The sidecar
lives in `packages/ai-llm-proxy`, validates the user's oCIS bearer token
against the oCIS OIDC userinfo endpoint, and forwards the request to the
configured LLM with the LLM API key injected server-side. The API key
never reaches the browser.

## Supported File Types

PDF, TXT, MD

PDF text is extracted client-side with PDF.js (fake-worker mode, no Worker
spawn required). Plain-text files are fetched via WebDAV.

For **chat mode**, file content is truncated to 12 000 characters before being
sent to the LLM. For **edit mode**, files larger than 12 000 characters are
rejected with an error rather than silently truncated — truncating would cause
the model's rewrite to overwrite the unseen tail of the file.

## Features

| Feature | Detail |
|---------|--------|
| **Chat mode** | Conversational Q&A about the file; full message history kept per file |
| **Edit mode** | Ask the LLM to rewrite the file; preview a line-level diff before saving |
| **Apply / Discard** | Review proposed changes and apply them with a single click, or discard |
| **Session cache** | Chat history survives panel close/reopen within the same browser session |
| **ETag concurrency** | Writes use the file's ETag so concurrent edits are caught and reported |

## Extension Points

| ID | Type |
|----|------|
| `global.files.sidebar` | `sidebarPanel` — "Chat" tab, visible for single supported files |
| `global.files.context-actions` | `action` — "Chat with file" entry that opens the Chat sidebar tab |

## Configuration

### Web App Config

Admins set the proxy endpoint and model in the oCIS Web app config:

```yaml
chat-with-file:
  config:
    llm:
      endpoint: "https://your-ocis.example.com/ai-llm-proxy/v1"
      model: "llama3.2"
```

The panel reads `applicationConfig.llm` at startup. If `endpoint` or `model`
is missing the panel renders the unconfigured placeholder immediately, without
making any network requests.

**The endpoint must be on the same origin as the ownCloud Web frontend.**
The panel attaches the user's oCIS bearer token to every LLM request; sending
that token to a third-party host would be a credential leak. If the configured
endpoint has a different origin, the panel shows an error and makes no request.
Point `endpoint` at the `ai-llm-proxy` sidecar path served through Traefik
(e.g. `https://your-ocis.example.com/ai-llm-proxy/v1`), never directly at the
LLM.

### `ai-llm-proxy` Sidecar

The sidecar is configured entirely via environment variables — the LLM API key
stays server-side and never reaches the browser:

| Variable | Required | Description |
|----------|----------|-------------|
| `OCIS_URL` | yes | oCIS base URL, used to discover the OIDC userinfo endpoint |
| `LLM_ENDPOINT` | yes | LLM base URL (OpenAI-compatible, e.g. `http://localhost:11434/v1`) |
| `LLM_API_KEY` | no | API key forwarded to the LLM in `Authorization: Bearer` |
| `LLM_MODEL` | no | When set, overrides the `model` field the browser sends; recommended to lock the model the operator has provisioned |
| `LLM_MAX_TOKENS` | no | Hard ceiling on `max_tokens` forwarded to the LLM (default `4096`) |
| `MAX_BODY_BYTES` | no | Maximum request body the proxy will buffer in bytes (default `131072` = 128 KiB) |
| `RATE_LIMIT_RPM` | no | Maximum LLM requests per authenticated user per rolling minute (default `20`) |
| `PORT` | no | Listening port, default `3030` |
| `NODE_TLS_REJECT_UNAUTHORIZED` | no | Set to `0` for dev stacks with self-signed certs |

In the dev docker-compose stack the sidecar is exposed at
`https://host.docker.internal:9200/ai-llm-proxy/v1` via Traefik.
Set `AI_LLM_ENDPOINT` and `AI_LLM_API_KEY` in a `.env` file or as shell
variables before running `docker-compose up`.

## Modes

### Chat

Maintains a full conversation history for the current file. Each turn sends
the entire history to the LLM so previous context is always available. History
is cached in memory per file ID and survives panel navigations within the
browser session.

### Edit

Sends a single-turn instruction to the LLM with a system prompt that asks it
to return the complete updated file content and nothing else. The response is
never written automatically — the user sees a unified diff first and must click
**Apply to file** to save. Edit mode is only available for text files (`.txt`,
`.md`); it is disabled for PDFs.

## States

| State | Shown when |
|-------|-----------|
| Unconfigured | `llm.endpoint` or `llm.model` missing from app config |
| Empty / placeholder | LLM ready, no messages yet |
| Loading | LLM request in flight ("Thinking…") |
| Edit proposal | LLM returned a rewrite; diff + Apply/Discard buttons visible |
| Applying | File write in progress |
| Error | Endpoint unreachable, auth failure, rate-limit, concurrent edit conflict, timeout, cross-origin endpoint, file too large for edit, or LLM response cut off mid-edit |

Errors are shown as a banner above the input and include user-actionable
guidance. A failed send rolls back the optimistic user message so the user can
retry without duplicate entries in the history.

## Development

```sh
# install dependencies (from the repo root)
pnpm install

# build the extension (watch mode for local dev)
pnpm --filter web-app-chat-with-file build:w

# type-check
pnpm --filter web-app-chat-with-file check:types

# lint
pnpm --filter web-app-chat-with-file lint

# unit tests
pnpm --filter web-app-chat-with-file test:unit
```

The dev server runs on port **9730** and is served by the docker-compose stack
defined in the repo root.

## LLM Compatibility

The extension uses the OpenAI-compatible `/chat/completions` endpoint. Any
self-hosted or cloud model that speaks that API works — Ollama, llama.cpp,
vLLM, OpenAI, Azure OpenAI, etc. Responses are expected to carry
`choices[0].message.content`.

## License

Apache-2.0
