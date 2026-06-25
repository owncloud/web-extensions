# AI CSV / Spreadsheet Insights Sidebar

Adds an **Insights** sidebar panel and an **Insights** context-menu action for
CSV and TSV files. On demand it downloads the file via WebDAV, parses it
client-side (headers plus up to the first 200 rows), and sends a compact
structured preview to an admin-configured, OpenAI-compatible LLM endpoint. The
panel renders detected column types, value ranges for numeric columns, and
2–3 natural-language observations about the data.

No LLM provider is bundled and no API keys are embedded in the browser —
the endpoint is fully operator-controlled (BYO-LLM).

Requests flow **browser → `ai-llm-proxy` sidecar → LLM**. The sidecar
lives in `packages/ai-llm-proxy`, validates the user's oCIS bearer token
against the oCIS OIDC userinfo endpoint, and forwards the request to the
configured LLM with the LLM API key injected server-side. The API key
never reaches the browser.

## Supported File Types

CSV (`.csv`), TSV (`.tsv`)

Files are fetched via WebDAV and parsed client-side with a lightweight
RFC-4180 state machine. The parser handles quoted fields (including embedded
newlines and commas), Windows line endings, and single-column files. At most
30 columns and 5 sample values per column are sent to the LLM, capping prompt
size regardless of file width.

## Extension Points

| ID | Type |
|----|------|
| `global.files.sidebar` | `sidebarPanel` — "Insights" tab, visible for single supported files |
| `global.files.context-actions` | `action` — "Insights" entry that opens the Insights sidebar tab |

Both extension points are hidden entirely when no LLM endpoint is configured,
so users on unconfigured deployments never see empty or broken UI.

## Configuration

### Web App Config

Admins set the proxy endpoint and model in the oCIS Web app config:

```yaml
ai-data-insights-sidebar:
  config:
    llm:
      endpoint: "https://your-ocis.example.com/ai-llm-proxy/v1"
      model: "llama3.1:70b"
```

The panel reads `applicationConfig.llm` at startup. If `endpoint` or `model`
is absent both the sidebar panel and the context-menu action are hidden.

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

## Insights Output

The LLM is prompted to return a JSON object with three fields:

- **columnTypes** — an array of `{ column, type }` objects confirming the
  detected type (`number`, `date`, `boolean`, or `string`) for each column
- **ranges** — an array of `{ column, min, max }` objects for numeric and date
  columns
- **observations** — an array of 2–3 plain natural-language observations about
  the data

The panel renders this as a column-type table with range annotations and a
bullet list of observations. Observations are returned in the user's preferred
oCIS language (via the `preferredLanguage` profile setting).

## Panel States

| State | Shown when |
|-------|-----------|
| Idle | Panel mounted, no analysis started yet — shows "Analyze" button |
| Analyzing | LLM request in flight — shows "Analyzing…" placeholder |
| Result | Column-type table, ranges, and observations rendered — shows "Re-analyze" button |
| Error | Endpoint unreachable, auth failure, rate-limit, cross-origin block, or malformed response |

Errors are shown only inside the panel and include admin-actionable guidance.

## Security

- The extension enforces a same-origin check on the configured LLM endpoint
  before attaching the user's oCIS bearer token. Cross-origin endpoints are
  rejected with an in-panel error message.
- No API key is ever stored in or passed through extension config — the key
  lives exclusively in the `ai-llm-proxy` server environment.
