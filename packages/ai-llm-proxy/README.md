# ai-llm-proxy

A minimal Node.js sidecar that lets the AI extensions in this repo (`ai-doc-summary`,
`chat-with-file`, `ai-quick-draft-creator`, and the other `web-app-ai-*` packages) talk
to an admin-configured, OpenAI-compatible LLM without ever exposing the LLM's API key to
the browser, and without letting arbitrary clients call the LLM through oCIS's identity.

It is **not** a general-purpose LLM API gateway. It proxies exactly one request shape and
enforces two checks before doing so. Both are covered below because a misconfigured
deployment fails in ways that look like a broken extension rather than a config problem.

## Request flow

```
browser (oCIS Web) → ai-llm-proxy → LLM
```

1. The browser sends `POST /v1/chat/completions` with the user's oCIS OIDC access token
   in `Authorization: Bearer <token>`.
2. The proxy checks the request's `Origin` header against `OCIS_URL` (see
   [Same-origin requirement](#same-origin-requirement)).
3. The proxy validates the token against the oCIS OIDC `userinfo` endpoint and rate-limits
   the request per user.
4. The proxy sanitizes the body (drops any field the LLM call doesn't need, clamps
   `max_tokens`) and forwards it to `${LLM_ENDPOINT}/chat/completions`, injecting
   `LLM_API_KEY` server-side if one is configured.

## Supported route

The proxy implements exactly one endpoint:

```
POST /v1/chat/completions
```

Every other method or path — including a models-list endpoint such as `GET /v1/models`,
which many OpenAI-compatible clients probe by convention — returns `404 {"error":"Not found"}`.
This is intentional: the proxy is scoped to the one call the extensions make, not a full
OpenAI API pass-through. If you're testing connectivity by hand, use `POST /v1/chat/completions`
with a valid oCIS bearer token, not a models-list request.

## Same-origin requirement

The proxy only trusts requests whose `Origin` header matches `OCIS_URL`. A request with a
different `Origin` gets `403 {"error":"Origin not allowed"}`; a request with no `Origin`
header (never true for a browser call) is let through to token validation. CORS response
headers are sent for browser convenience but are **not** the enforcement mechanism — the
origin check happens server-side and is what actually blocks a foreign caller.

The practical consequence: **`ai-llm-proxy` must be reverse-proxied under the same origin
as your oCIS instance** (same scheme, host, and port), reachable under some path prefix.
It cannot be exposed on its own host:port (e.g. `http://127.0.0.1:3030`) and pointed at
directly from the extension's `llm.endpoint` config — the browser's `Origin` for that
request would be the oCIS origin, not `127.0.0.1:3030`, and would still be checked against
`OCIS_URL` regardless of where the proxy itself is bound. If you're fronting it with your
own reverse proxy (not the bundled Traefik stack), that reverse proxy must be the thing
serving your oCIS origin — a separate host or port in front of the proxy doesn't change
what origin the browser sends.

In the bundled dev `docker-compose.yml`, Traefik mounts the proxy under `/ai-llm-proxy` on
the same origin as oCIS and strips the prefix before forwarding:

```yaml
traefik.http.routers.ai-llm-proxy.rule: Host(`host.docker.internal`) && PathPrefix(`/ai-llm-proxy`)
traefik.http.middlewares.ai-llm-proxy-strip.stripPrefix.prefixes: /ai-llm-proxy
```

so `https://host.docker.internal:9200/ai-llm-proxy/v1/chat/completions` is what the browser
calls, and the proxy itself only ever sees `/v1/chat/completions`.

A generic nginx equivalent, assuming nginx is already the reverse proxy serving your oCIS
origin (adjust upstream host/port to match your deployment):

```nginx
location /ai-llm-proxy/ {
    proxy_pass http://ai-llm-proxy:3030/;
    proxy_set_header Host $host;
}
```

Then set the extensions' `llm.endpoint` app config to
`https://your-ocis.example.com/ai-llm-proxy/v1` — never a bare `host:port`.

## Configuration

All configuration is via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OCIS_URL` | yes | — | Base URL of your oCIS instance. Used both to discover the OIDC `userinfo` endpoint and to derive the allowed request origin. The proxy refuses to start without it. |
| `LLM_ENDPOINT` | yes | — | Base URL of the OpenAI-compatible LLM (e.g. `http://localhost:11434/v1` for Ollama, or your `llama.cpp` server's base URL). The proxy calls `${LLM_ENDPOINT}/chat/completions`. The proxy refuses to start without it. |
| `LLM_API_KEY` | no | *(empty)* | API key forwarded to the LLM as `Authorization: Bearer <key>`. Omit for keyless local endpoints (e.g. `llama.cpp`, Ollama). |
| `LLM_MODEL` | no | *(empty)* | When set, overrides whatever `model` the client requested — use to pin all traffic to one model regardless of extension config. |
| `LLM_MAX_TOKENS` | no | `4096` | Hard ceiling on `max_tokens` forwarded to the LLM; a client-requested value above this is clamped down. |
| `LLM_TIMEOUT_MS` | no | `60000` | Timeout for the outbound LLM request, in milliseconds. |
| `MAX_BODY_BYTES` | no | `6291456` (6 MiB) | Maximum request body size the proxy will buffer, e.g. to cover a base64-encoded image. |
| `RATE_LIMIT_RPM` | no | `20` | Maximum requests per user per rolling 60-second window. |
| `PORT` | no | `3030` | Listening port. |
| `NODE_TLS_REJECT_UNAUTHORIZED` | no | *(unset)* | Set to `0` to accept self-signed certs when calling `OCIS_URL` — dev stacks only, never in production. |

## Troubleshooting

| Response | Cause |
|----------|-------|
| `404 {"error":"Not found"}` | Wrong method/path. Only `POST /v1/chat/completions` exists — there is no models-list or other route. |
| `403 {"error":"Origin not allowed"}` | The request's `Origin` doesn't match `OCIS_URL`. The proxy (or your reverse proxy in front of it) isn't mounted on the same origin as oCIS. See [Same-origin requirement](#same-origin-requirement). |
| `401 {"error":"Missing Authorization header"}` / `401 {"error":"Invalid or expired oCIS token"}` | No bearer token was sent, or it failed validation against oCIS's `userinfo` endpoint. |
| `429 {"error":"Rate limit exceeded. Please slow down."}` | The calling user exceeded `RATE_LIMIT_RPM` requests in the last 60 seconds. |
| `502 {"error":"Could not reach oCIS to validate token"}` | The proxy couldn't reach `OCIS_URL`'s OIDC discovery/`userinfo` endpoint. |
| `502 {"error":"Could not reach LLM endpoint"}` | The proxy couldn't reach `LLM_ENDPOINT`. Check the URL is reachable from *inside* the proxy's container/network, not just from your host. |
| `413 {"error":"Request body too large"}` | Request exceeded `MAX_BODY_BYTES`. |

## Development

```bash
pnpm --filter ai-llm-proxy build      # tsc -> dist/
pnpm --filter ai-llm-proxy test:unit  # vitest
pnpm --filter ai-llm-proxy dev        # node --watch dist/index.js
```

The server only starts when run directly (`NODE_ENV !== 'test'`); `handleRequest` and its
helpers are exported individually so unit tests can exercise them without binding a port.
