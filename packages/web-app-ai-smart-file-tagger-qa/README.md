# AI Smart File Tagger

Adds a **Suggest tags** context-menu action for single files. Click it, and a
modal opens. The file's text is extracted (or, for unsupported types, just its
name and MIME type are used) and sent to an admin-configured, OpenAI-compatible
LLM endpoint, which returns 3–5 suggested tags. Select the ones you want and
confirm to apply them to the file.

No LLM provider is bundled and no API keys are embedded in the browser —
the endpoint is fully operator-controlled (BYO-LLM).

Requests flow **browser → `ai-llm-proxy` sidecar → LLM**. The sidecar
lives in `packages/ai-llm-proxy`, validates the user's oCIS bearer token
against the oCIS OIDC userinfo endpoint, and forwards the request to the
configured LLM with the LLM API key injected server-side. The API key
never reaches the browser. `useLLM` additionally enforces that
`llm.endpoint` is same-origin with the current page before issuing any
request — a cross-origin endpoint leaves the extension in a `cross-origin`
state and no request is made.

## Supported File Types

- **Content mode** (TXT, MD, PDF) — the file's text is extracted and sent to
  the LLM, truncated to 12 000 characters. PDF text is extracted client-side
  with PDF.js (fake-worker mode, no Worker spawn required).
- **Name-only mode** (everything else) — only the file name and MIME type are
  sent; no file content is downloaded.

## Extension Points

| ID | Type |
|----|------|
| `global.files.context-actions` | `action` — "Suggest tags" entry, visible when exactly one file is selected |

> The original spec targeted `app.files.quick-actions`, but that extension
> point is not exposed by the installed `@ownclouders/web-pkg` version. The
> extension falls back to `global.files.context-actions`, which exposes the
> same `ActionExtension` interface. Revisit once `quick-actions` is available.

## Configuration

### Web App Config

Admins set the proxy endpoint and model in the oCIS Web app config:

```yaml
ai-smart-file-tagger-qa:
  config:
    llm:
      endpoint: "https://your-ocis.example.com/ai-llm-proxy/v1"
      model: "llama3.2"
```

The extension reads `applicationConfig.llm` at startup. If `endpoint` or
`model` is missing, or the endpoint is not same-origin, the modal renders the
unconfigured placeholder immediately, without making any network requests.

### `ai-llm-proxy` Sidecar

The sidecar is configured entirely via environment variables — the LLM API
key stays server-side and never reaches the browser:

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

## Tag Suggestion Output

The LLM is prompted to return a JSON object: `{"tags":[{"name":string,
"confidence":number},...]}`, capped at 5 tags. Each tag name is lower-cased,
trimmed, space-replaced-with-hyphens, and capped at 30 characters before
display.

If the model doesn't support structured JSON output, the raw text response is
split on commas, newlines, or semicolons and normalised the same way —
confidence is shown only when the model returned it.

Confidence is UX-only: it is shown as a percentage badge on each chip during
selection and is discarded once tags are applied — it is not stored as file
metadata.

## Applying Tags

Selected tags are applied via `clientService.graphAuthenticated.tags.assignTags`
(Graph API), which is additive server-side. The extension merges the newly
applied tags into the file's existing `tags` field in the local resources
store rather than overwriting it, since `assignTags` does not return the
updated resource.

## States

| State | Shown when |
|-------|-----------|
| Unconfigured | `llm.endpoint` or `llm.model` missing from app config, or the endpoint is cross-origin |
| Loading | LLM request in flight |
| Ready | Tag suggestions rendered as selectable chips |
| No suggestions | LLM returned no usable tags |
| Error | Endpoint unreachable, timeout, auth failure, rate-limit, or malformed response |

The "Apply tags" confirm button is disabled until at least one chip is
selected.
