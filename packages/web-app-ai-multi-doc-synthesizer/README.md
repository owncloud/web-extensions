# AI Multi-Document Synthesizer

Select 2–10 text documents (`.txt`, `.md`) in ownCloud Web, click **Synthesize** in the batch-action bar, and get an LLM-generated overview of:

- **Shared Themes** — topics appearing across multiple documents
- **Key Differences** — contrasting points between documents
- **Action Items** — concrete actions mentioned or implied

The result can be copied to the clipboard or saved as a new Markdown file (`synthesis-YYYY-MM-DD-HHmmss.md`) in the same folder as the selected files.

## Requirements

- ownCloud Infinite Scale (oCIS) ≥ 5.x
- `ai-llm-proxy` running and accessible (included in the repo's Docker Compose setup)
- An OpenAI-compatible LLM endpoint (e.g. Ollama, OpenAI, any v1-compatible API)

## Configuration

The extension reads its config from oCIS's app configuration system. No API keys are stored in the browser — all LLM calls go through `ai-llm-proxy`, which holds the provider key server-side.

### `dev/docker/ocis.apps.yaml` (local dev)

```yaml
ai-multi-doc-synthesizer:
  config:
    llm:
      endpoint: 'https://host.docker.internal:9200/ai-llm-proxy/v1'
      model: 'llama3.2'
```

### `support/actions/ocis.apps.yaml` (CI / GitHub Actions)

```yaml
web-app-ai-multi-doc-synthesizer:
  config:
    llm:
      endpoint: 'https://localhost:9200/ai-llm-proxy/v1'
      model: 'llama3.2'
```

### Proxy environment variables (`packages/ai-llm-proxy`)

| Variable | Description |
|---|---|
| `LLM_ENDPOINT` | OpenAI-compatible base URL (e.g. `http://host.docker.internal:11434/v1`) |
| `LLM_API_KEY` | Provider API key (optional for keyless endpoints like Ollama) |
| `OCIS_URL` | oCIS URL used for token validation and origin checks |
| `PORT` | Port the proxy listens on (default: `3030`) |

## Running locally

```bash
# From repo root
pnpm install
pnpm --filter web-app-ai-multi-doc-synthesizer build

# Start the full oCIS stack
docker compose up -d
```

Access ownCloud Web at `https://host.docker.internal:9200` (login: `admin`/`admin`).

Requires `127.0.1.1 host.docker.internal` in `/etc/hosts`.

## Supported file types

| Extension | Description |
|---|---|
| `.txt` | Plain text |
| `.md` | Markdown |

Files larger than 10,000 characters are automatically truncated and a warning is shown. When multiple truncated files are detected, a banner notes how many were affected.

## Synthesis tiers

| Combined content | Strategy |
|---|---|
| ≤ 8,000 chars | Single-pass: all documents in one prompt |
| > 8,000 chars | Two-pass: per-file summaries first, then cross-document synthesis |

File fetches and per-file LLM calls are capped at 3 concurrent requests to avoid overloading the proxy.

## Privacy

- All document content is sent only to the admin-configured `ai-llm-proxy` endpoint (same-origin check enforced at runtime)
- No data reaches any third-party service unless the admin has configured a third-party LLM endpoint
- No telemetry, no hardcoded keys
