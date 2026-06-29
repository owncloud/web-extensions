# web-app-ai-quick-draft-creator

Adds a **"Draft from description"** entry to the oCIS Files upload menu. A modal lets the user describe the document they need; an LLM generates a well-structured draft and saves it as a new file in the current folder.

**Extension point:** `app.files.upload-menu`

## What it does

1. The user clicks the upload menu in Files and selects **Draft from description**.
2. A modal prompts for a document description and an output format (Markdown or plain text).
3. The extension calls the `ai-llm-proxy` (same-origin) which validates the user's oCIS OIDC token and proxies the request to the configured LLM.
4. The generated draft is written to the current folder via WebDAV. Filenames include a timestamp suffix (`slug-YYYY-MM-DD-HH-mm-ss.ext`) so same-day drafts never overwrite each other.
5. The menu item is hidden automatically when no LLM endpoint is configured.

## Security model

- **The browser never sees the provider API key.** The `ai-llm-proxy` holds `LLM_API_KEY` server-side.
- The client authenticates to the proxy using the user's oCIS OIDC bearer token (`Authorization: Bearer <accessToken>`).
- The proxy validates the token against `OCIS_URL` before forwarding any request.
- `useLLM.ts` enforces a same-origin check on the endpoint URL at call time and refuses to send credentials to a cross-origin host.

## Configuration

Add the following to `ocis.apps.yaml` (key must match the mount directory):

```yaml
ai-quick-draft-creator:
  config:
    llm:
      endpoint: 'https://<ocis-host>/ai-llm-proxy/v1'
      model: 'llama3.2'
```

The `ai-llm-proxy` must be configured with:

| Variable | Description |
|----------|-------------|
| `LLM_ENDPOINT` | OpenAI-compatible base URL of your LLM (e.g. Ollama) |
| `LLM_API_KEY` | Provider API key (optional for keyless endpoints) |
| `OCIS_URL` | Used to validate OIDC tokens and enforce origin checks |

## Local development

```bash
# From repo root:
pnpm install
pnpm build && docker compose up -d
```

Access oCIS at `https://host.docker.internal:9200` (admin / admin).
The extension dist is mounted automatically from `docker-compose.yml`.

## Running tests

```bash
pnpm --filter web-app-ai-quick-draft-creator test:unit
pnpm --filter web-app-ai-quick-draft-creator test:e2e
pnpm --filter web-app-ai-quick-draft-creator check:types
```
