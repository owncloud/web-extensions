# AI Smart Collections Nav Item

An ownCloud Infinite Scale (oCIS) extension that adds a **Collections** entry to the
global app switcher. It lists the current user's most recently modified files across
all their accessible spaces, sends file names and short text excerpts to an
admin-configured, OpenAI-compatible LLM endpoint, and renders the LLM's clustering
response as clickable collection cards (e.g. "Invoices", "Contracts", "Meeting notes").
Clicking a card shows the filtered list of files in that theme.

Nothing is moved, renamed, or tagged server-side — collections are a **read-only,
derived view** recomputed each time the page loads. No LLM provider is bundled and no
API keys are embedded in the browser (BYO-LLM, operator-controlled endpoint).

Requests flow **browser → `ai-llm-proxy` sidecar → LLM**. The sidecar validates the
user's oCIS bearer token and forwards the request to the configured LLM with the API
key injected server-side. The API key never reaches the browser.

## Note on placement

The original spec asked for a Files-app left-nav entry via the `app.files.navItems`
(`sidebarNav`-typed) extension point. A live gate run confirmed the installed
`@ownclouders/web-pkg` (12.4.2) does not render that extension point at all — the
Files app's sidebar only lists its four built-in items. The extension is registered
as an `appMenuItem` instead (global app switcher), the same proven pattern used by
`draw-io` and `group-management`. This is a placement change from the original spec,
not a missing feature.

## Features

- Fetches recent files across **all** of the user's accessible spaces via one WebDAV
  `REPORT` (KQL) request per space, merges and sorts by modification date, and caps
  the result to the 100 most recent files
- Fetches capped text excerpts (≤ 1 MB, plain-text-like extensions only — `.txt`,
  `.md`, `.csv`, `.tsv`, `.json`, `.yaml`/`.yml`, `.log`, `.rtf`) to give the LLM more
  than just file names to cluster on
- One-time per-session consent dialog before any file name or excerpt is sent to the
  LLM; declining skips the AI call entirely with no network request made
- Structured `{fileId, collection}` clustering via `response_format: json_object`,
  with a lenient line-based fallback (`fileId: collection label`) when the LLM
  ignores structured output
- Large file sets are split into batches of 30 files, processed sequentially (not in
  parallel, to stay within any per-user rate limit the proxy enforces), and merged
  client-side by file ID — collection labels are reconciled by exact string match
  only (no cross-batch re-clustering; e.g. "Invoices" and "Invoice" from different
  batches are **not** unified)
- Loading, empty, error, and consent-declined states, each with a retry/continue path

## Extension Point

| ID | Type |
|----|------|
| `app.ai-smart-collections-nav.menuItem` | `appMenuItem` — "Collections" entry in the global app switcher |

## Configuration

### Web App Config

Admins set the proxy endpoint and model in the oCIS Web app config. The key **must**
match the Docker mount target directory (`ai-smart-collections-nav`), not the
package name:

```yaml
ai-smart-collections-nav:
  config:
    llm:
      endpoint: 'https://your-ocis.example.com/ai-llm-proxy/v1'
      model: 'llama3.2'
```

The view reads `applicationConfig.llm` at startup. If `endpoint` or `model` is
missing, or the endpoint isn't same-origin, the "Collections" view surfaces an
admin-actionable error and makes no LLM call — there is no non-AI fallback for
clustering itself (unlike the recent-files listing, which always works).

### `ai-llm-proxy` Sidecar

The sidecar is configured entirely via environment variables — the LLM API key
stays server-side and never reaches the browser:

| Variable | Required | Description |
|----------|----------|--------------|
| `OCIS_URL` | yes | oCIS base URL, used to validate OIDC bearer tokens |
| `LLM_ENDPOINT` | yes | LLM base URL (OpenAI-compatible, e.g. `http://localhost:11434/v1`) |
| `LLM_API_KEY` | no | API key forwarded to the LLM in `Authorization: Bearer` |
| `PORT` | no | Listening port, default `3030` |
| `NODE_TLS_REJECT_UNAUTHORIZED` | no | Set to `0` for dev stacks with self-signed certs |

In the dev docker-compose stack the sidecar is exposed at
`https://host.docker.internal:9200/ai-llm-proxy/v1` via Traefik.

## Output Format

The LLM is prompted to return a JSON object of the shape
`{ "assignments": [{ "fileId": string, "collection": string }, ...] }` (a bare
top-level array is also accepted). When the LLM ignores `response_format` and
returns plain text, each line is parsed leniently as `fileId: collection label`
(`fileId - collection` is also tolerated); malformed or blank lines are skipped
rather than failing the whole batch.

## States

| State | Shown when |
|-------|-----------|
| Loading | Recent-files listing or LLM clustering request in flight |
| Consent prompt | First clustering attempt this session, LLM configured and same-origin |
| Consent declined | User cancelled the consent prompt — no data was sent, "Group my files" retry available |
| Collection grid | Clustering succeeded — one card per inferred collection |
| Collection file list | A collection card was clicked — filtered file list with a back action |
| Empty | No recent files found, or no collections could be inferred |
| Error | Recent-files listing failed, LLM not configured/cross-origin, or the LLM request failed — includes a Retry action |

## Development

```bash
# Install dependencies (from repo root)
pnpm install

# Build the extension
pnpm -F web-app-ai-smart-collections-nav build

# Type check
pnpm -F web-app-ai-smart-collections-nav check:types

# Unit tests
pnpm -F web-app-ai-smart-collections-nav test:unit

# E2E tests (requires a running oCIS instance — see root README for setup)
pnpm -F web-app-ai-smart-collections-nav test:e2e
```

See the root `README.md` for how to run a local oCIS development environment with
the extension loaded.
