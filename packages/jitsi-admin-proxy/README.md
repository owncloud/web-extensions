# jitsi-admin-proxy

Server-side sidecar for the `jitsi-conference` extension's "Call all Space members" feature (see
`../web-app-jitsi-conference/README.md`). It exists because jitsi-admin's room-provisioning API
(`/api/v1/room`, `/api/v1/user`) authenticates with a static, per-server API key rather than a
forwarded end-user token (see `DECISIONS.md`, D3) — a browser extension cannot hold that key
itself, so this proxy holds it instead and only ever accepts requests from an already-authenticated
oCIS user.

## What it does

1. Rejects any request whose `Origin` header doesn't match `OCIS_URL` (mandatory server-side check
   per `CLAUDE.md` — CORS headers alone are not sufficient).
2. Validates the caller's oCIS OIDC bearer token against oCIS's own `/userinfo` endpoint.
3. Creates a room in jitsi-admin (owned by the calling user's email) and invites each supplied
   participant by email — jitsi-admin sends the invitation emails itself, so this proxy never needs
   to talk to any oCIS notification API.
4. Returns `{ roomCreated, invited, failed }` so the caller can show the user which invites, if any,
   didn't go through.

## Configuration (environment variables)

| Variable | Required | Description |
|---|---|---|
| `OCIS_URL` | yes | Base URL of the oCIS instance; used both for the origin check and OIDC discovery. |
| `JITSI_ADMIN_URL` | yes | Base URL of the jitsi-admin instance. |
| `JITSI_ADMIN_API_KEY` | yes | The registered `Server`'s API key in jitsi-admin — a service credential, never a user token. |
| `JITSI_ADMIN_SERVER` | yes | Identifies which jitsi-admin `Server` (registered Jitsi/LiveKit backend) new rooms are created on. |
| `PORT` | no | Listen port, defaults to `3031`. |
| `ROOM_DURATION_MINUTES` | no | Duration passed to jitsi-admin when creating a room, defaults to `60`. |
| `MAX_PARTICIPANTS` | no | Hard cap on participants per request, defaults to `50`. |
| `RATE_LIMIT_RPM` | no | Requests per user per rolling minute, defaults to `10`. |
| `REQUEST_TIMEOUT_MS` | no | Timeout for the jitsi-admin API calls, defaults to `15000`. |

## A caveat worth reading before deploying this

The exact field names used when calling jitsi-admin's `/api/v1/room` and `/api/v1/user` (`name`,
`email`, `server`, `start`, `duration`, `room`) are a best-effort reconstruction from reading
H2-invent/jitsi-admin's Symfony controller source (see `../../ARCHAEOLOGY.md` §1.1) — this proxy has
not been exercised against a live jitsi-admin instance. Before relying on this in production, verify
the request/response contract against your jitsi-admin version (its Wiki's `API-Endpoints` page is
the best starting point) and adjust `src/index.ts`'s `createJitsiAdminRoom`/
`inviteJitsiAdminParticipant` functions if it doesn't match — they're deliberately kept small and
isolated for exactly this reason.
