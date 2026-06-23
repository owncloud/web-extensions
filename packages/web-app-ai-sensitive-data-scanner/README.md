# AI Sensitive Data Scanner (Batch)

Adds a **Scan for sensitive data** batch action to the files list. Select one
or more files, click the action, and a results modal opens. Each supported file
is fetched, its text is extracted, and it is sent to an admin-configured,
OpenAI-compatible LLM endpoint. Findings are reported per file with redacted
excerpts, categorised as PII, credentials, or confidential text.

No LLM provider is bundled and no API keys are embedded in the browser —
the endpoint is fully operator-controlled (BYO-LLM).

Requests flow **browser → `ai-llm-proxy` sidecar → LLM**. The sidecar
lives in `packages/ai-llm-proxy`, validates the user's oCIS bearer token
against the oCIS OIDC userinfo endpoint, and forwards the request to the
configured LLM with the LLM API key injected server-side. The API key
never reaches the browser.

## Supported File Types

TXT, MD, PDF

PDF text is extracted client-side with PDF.js (fake-worker mode, no Worker
spawn required). Plain-text files are fetched via WebDAV and truncated to
12 000 characters before being sent to the LLM.

Files of unsupported types that are part of the selection are silently
skipped and shown as "skipped" in the results modal.

## Extension Points

| ID | Type |
|----|------|
| `global.files.batch-actions` | `action` — "Scan for sensitive data" entry in the batch-actions bar, visible when at least one selected file is a supported type |

## Configuration

### Web App Config

Admins set the proxy endpoint and model in the oCIS Web app config:

```yaml
ai-sensitive-data-scanner:
  config:
    llm:
      endpoint: "https://your-ocis.example.com/ai-llm-proxy/v1"
      model: "llama3.2"
```

The extension reads `applicationConfig.llm` at startup. If `endpoint` or
`model` is missing the modal renders the unconfigured placeholder
immediately, without making any network requests.

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

## Scan Output

Files are scanned sequentially. For each file the LLM is asked to identify:

- **PII** — names, email addresses, phone numbers, Social Security Numbers,
  dates of birth, passport numbers, postal addresses
- **Credentials** — passwords, API keys, tokens, private keys, secrets,
  connection strings, certificates
- **Confidential** — unreleased financial figures, proprietary
  specifications, internal legal communications

When the model supports structured JSON output (`response_format:
json_object`), findings are returned as a categorised list with redacted
excerpts. When the model returns plain text, a narrative summary is shown
instead.

A **Re-scan** button is shown after all files are processed, allowing the
user to re-run the scan on demand.

## States

| State | Shown when |
|-------|-----------|
| Unconfigured | `llm.endpoint` or `llm.model` missing from app config |
| Scanning (initial) | First scan in progress with no results yet |
| Per-file: Waiting | File is queued behind an earlier file being scanned |
| Per-file: Scanning | LLM request for this file is in flight |
| Per-file: Findings | Structured findings list with category icons and redacted excerpts |
| Per-file: Narrative | Plain-text model response (structured output not supported) |
| Per-file: Clean | Scan completed and no sensitive data was found |
| Per-file: Skipped | File type is not supported (not TXT, MD, or PDF) |
| Per-file: Error | Endpoint unreachable, auth failure, rate-limit, timeout, or malformed response |
