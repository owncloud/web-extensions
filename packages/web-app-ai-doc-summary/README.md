# AI Document Summarizer Sidebar

Adds a **Summary** sidebar panel and a **Summarize** context-menu action for
supported document types. On demand it downloads the file, extracts its text,
and sends it to an admin-configured, OpenAI-compatible LLM endpoint to produce
a short overview and a list of key points.

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
spawn required). Plain-text files are fetched via WebDAV and truncated to
12 000 characters before being sent to the LLM.

## Extension Points

| ID | Type |
|----|------|
| `global.files.sidebar` | `sidebarPanel` — "Summary" tab, visible for single supported files |
| `global.files.context-actions` | `action` — "Summarize" entry that opens the Summary sidebar tab |

## Configuration

### Web App Config

Admins set the proxy endpoint and model in the oCIS Web app config:

```yaml
llm:
  endpoint: "https://your-ocis.example.com/ai-llm-proxy/v1"
  model: "llama3.1:70b"
```

The panel reads `applicationConfig.llm` at startup. If `endpoint` or `model`
is missing the panel renders the unconfigured placeholder immediately, without
making any network requests.

### `ai-llm-proxy` Sidecar

The sidecar is configured entirely via environment variables — the LLM API key
stays server-side and never reaches the browser:

| Variable | Required | Description |
|----------|----------|-------------|
| `OCIS_URL` | yes | oCIS base URL, used to discover the OIDC userinfo endpoint |
| `LLM_ENDPOINT` | yes | LLM base URL (OpenAI-compatible, e.g. `http://localhost:11434/v1`) |
| `LLM_API_KEY` | no | API key forwarded to the LLM in `Authorization: Bearer` |
| `PORT` | no | Listening port, default `3030` |
| `NODE_TLS_REJECT_UNAUTHORIZED` | no | Set to `0` for dev stacks with self-signed certs |

In the dev docker-compose stack the sidecar is exposed at
`https://host.docker.internal:9200/ai-llm-proxy/v1` via Traefik.
Set `AI_LLM_ENDPOINT` and `AI_LLM_API_KEY` in a `.env` file or as shell
variables before running `docker-compose up`.

## Capability Probing

When the panel first mounts it probes the endpoint for four capabilities:
structured JSON output (`response_format`), tool/function calling, streaming,
and the model's context window. Probe results are cached per
`endpoint::model` pair for the lifetime of the browser session.

The probing is best-effort — every individual probe failure degrades silently
to a conservative default and never blocks the summary request.

## Summary Output

The LLM is prompted to return a JSON object with two fields:

- **overview** — a 2–3 sentence paragraph describing the document
- **keyPoints** — an array of 3–4 takeaway strings rendered as a bullet list

The panel auto-triggers a summary when it mounts and exposes a **Regenerate**
button to re-run on demand.

## States

| State | Shown when |
|-------|-----------|
| Unconfigured | `llm.endpoint` or `llm.model` missing from app config |
| Connecting | Capability probe in progress |
| Summarizing | LLM request in flight |
| Result | Overview + key-points rendered |
| Error | Endpoint unreachable, auth failure, rate-limit, or malformed response |

Errors are shown only inside the panel and include admin-actionable guidance
(e.g. "Check the API key in admin settings").
