# ARCHAEOLOGY.md — jitsi-admin oCIS Web Extension (Phase 0)

Every claim below is cited. Where a claim could not be verified from public sources, it is marked
**not confirmed** rather than assumed. This document only covers Phase 0 (archaeology); no Phase 1
code has been written. See `DECISIONS.md` for the D1–D4 sign-off status this archaeology produced.

Research method note: this session's GitHub tooling is scoped to `owncloud/web-extensions` only, so
all `H2-invent/jitsi-admin` findings come from public `WebFetch`/`WebSearch` against GitHub's web UI,
raw file URLs, and the repo's GitHub Wiki — not the GitHub API/clone. Citations are the exact URLs
fetched.

---

## 1. jitsi-admin surface

### 1.1 REST/API surface

**There is no `CHANGELOG.md`** in the repo (404 confirmed at
`raw.githubusercontent.com/H2-invent/jitsi-admin/master/CHANGELOG.md`). The changelog function is
served by `RELEASE_NOTE.md`. The entry the prompt asked about is real: version 1.3 contains
**"Add Api to change Server of Room to use auto provisioner"**, alongside "add @ servername to jwt
roomname claim" and "Add user preferences (dark/light mode, language, timezone) to JWT."
(`raw.githubusercontent.com/H2-invent/jitsi-admin/master/RELEASE_NOTE.md`)

A real, documented API exists under `/api/v1/*`, implemented in `src/Controller/api/`:
`APIRoomController.php`, `APIUserController.php`, `ApiMoveRoomToOtherServerController.php`,
`ServerAPIController.php`, `APILicenseController.php`, `ApiThemeController.php`,
`ApiTranscriptionController.php`, `CallerController.php`, `CalloutAPIController.php`,
`ConferenceMapperController.php`, `EventSyncApiController.php`
(`github.com/H2-invent/jitsi-admin/tree/master/src/Controller/api`). Confirmed capabilities:

| Capability | Finding |
|---|---|
| (a) Create room programmatically | **Yes.** `POST /api/v1/room` (`APIRoomController.php`), payload `email`, `keycloakId`, `server`, `start`, `duration`, `name`. Also `PUT`/`DELETE /api/v1/room`, `POST /api/v1/room/move` (`ApiMoveRoomToOtherServerController.php`). |
| (b) Joinable meeting URL | **Indirectly.** No endpoint returns a raw Jitsi/LiveKit URL string; `src/Service/JoinUrlGeneratorService.php` builds a link back into jitsi-admin's own `join_index`/`join_index_uid` routes — jitsi-admin always mediates the join, it doesn't hand out a bare conference URL. |
| (c) JWT scoped to room + participant | **Yes**, the most solid part of the API. `src/Service/RoomService.php::genereateJwtPayload()` builds a JWT (`aud`=jitsi_admin, `iss`=AppId, `sub`=server URL, `room`, `context.user.name`, moderator flag, avatar; for LiveKit, `context.user.identity = "meetling_" + slug(userName) + "_" + randomSuffix`). Signed HS256 with the registered `Server`'s app secret (`JWT::encode(..., $room->getServer()->getAppSecret(), 'HS256')`); LiveKit goes through a separate encrypted-secret path. No `exp` claim was visible in the fetched excerpt. |
| (d) Invite by email/username | **Yes.** `POST`/`DELETE /api/v1/user` (`APIUserController.php`). `src/Service/RoomAddService.php::createUserFromUserUid()` resolves email-or-username, optionally auto-creates a user from an email when `strict_allow_user_creation` is set, and sends invite mail via Twig templates (e.g. `email/repeaterNew.html.twig`). |

**API auth is a static per-server credential, not a user token.** `src/Helper/BearerTokenAuthHelper.php`
only regex-parses `Bearer <token>` — it does no validation. Every controller above then checks that
token string against the **`apiKey` field of a `Server` entity** in the database (the Jitsi/LiveKit
server record the admin registered), not a user identity. The Wiki's own `API-Endpoints` page states
outright (German, `raw.githubusercontent.com/wiki/H2-invent/jitsi-admin/API-Endpoints.md`): *"Es
sollten nur Zugriffe von einem Backend-Server auf den Jitsi-Admin durchgeführt werden"* — "only
backend-server-to-backend-server access should be performed against jitsi-admin." `config/packages/security.yaml`
corroborates: `/api/` sits under `PUBLIC_ACCESS` in `access_control` — there is no Symfony firewall
guarding it, auth is entirely ad hoc inside each controller.

**This directly answers half of D3**: the API is designed for server-to-server calls with a
pre-shared key, never for a browser calling it directly as an authenticated end user.

### 1.2 Auth model

`composer.json` (`raw.githubusercontent.com/H2-invent/jitsi-admin/master/composer.json`) confirms
OIDC client packages: `stevenmaguire/oauth2-keycloak`, `knpuniversity/oauth2-client-bundle`
(config: `config/packages/knpu_oauth2_client.yaml`), plus `symfony/ldap` (LDAP is also supported,
separately) and `symfony/security-bundle`.

- `LICENSE` note: `composer.json`'s `license` field reads `"proprietary"`, which conflicts with the
  brief's premise of AGPLv3. **Not confirmed** — this needs a direct read of the repo's root
  `LICENSE` file before any legal reliance on AGPLv3; a WebFetch content-safety guardrail in the
  research tooling prevented a clean raw-text fetch of that file in this pass (see note at the top
  of this document — a tooling limitation, not a repo property).

**OIDC end-user login — confirmed, Keycloak-based:**
- `src/Controller/LoginControllerKeycloak.php` exposes `/login`, `/register`,
  `/login/keycloak_edit`, `/login/keycloak_password`; `/login` starts an Authorization Code flow
  with scopes `['email','openid','profile']`, with optional `kc_idp_hint` for multi-tenant IdP
  federation.
- `src/Security/KeycloakAuthenticator.php` handles the callback route `connect_keycloak_check` —
  a classic three-legged OAuth2 authenticator that stores `id_token` in the **PHP session**
  (`$request->getSession()->set('id_token', ...)`), i.e. cookie-based, not a stateless bearer flow.
- `config/packages/security.yaml`: a single "main" firewall using
  `custom_authenticators: App\Security\KeycloakAuthenticator`, Doctrine user provider keyed on
  `keycloakId`. No separate stateless API firewall exists.
- Wiki page `Organize-Jitsi-Servers-via-keycloak-groups` documents Keycloak-group-based access
  control as a first-class, supported pattern, and the shipped `docker-compose.yml` includes a
  `keycloak-ja` service by default (§1.4) — Keycloak/OIDC is core to the project, not bolted on.

**Does the API accept a forwarded end-user OIDC bearer token? No — not found, and the evidence
points the other way.** Every `/api/v1/*` controller validates against the static `Server.apiKey`
(§1.1); `KeycloakAuthenticator.php` only fires on the interactive `connect_keycloak_check` route and
never inspects the `Authorization` header on API requests. No stateless OIDC resource-server guard
(e.g. a JWKS-validating bundle wired to `/api/`) was found anywhere in `config/packages/` or
`src/Security/`.

**Conclusion, feeding directly into D2/D3:** end-user OIDC identity (session-based, Keycloak login)
and the API's Bearer-token scheme (a pre-provisioned per-Jitsi/LiveKit-server key) are two separate,
non-interoperating mechanisms in this codebase as far as public source shows. A user's own oCIS/
Keycloak access token cannot be handed to jitsi-admin's `/api/v1/*` and expected to authenticate as
that user — the payload identifies the user by `email`/`keycloakId` fields, but the *caller* must
already hold the Server API key.

### 1.3 Iframe embeddability / framing headers

**(a) jitsi-admin's own dashboard/scheduling pages — no built-in anti-framing.** No
`X-Frame-Options` or CSP `frame-ancestors` was found anywhere in the app: not in
`traefik/traefik.toml` (confirmed: only `logLevel` + access-log config, no headers middleware —
`raw.githubusercontent.com/H2-invent/jitsi-admin/master/traefik/traefik.toml`); not in
`config/packages/` (only `nelmio_cors.yaml` exists — no `nelmio_security.yaml` or CSP bundle,
per the directory listing at `github.com/H2-invent/jitsi-admin/tree/master/config/packages`); not
in `src/EventListener/` (`CorsHeaderListener.php` sets only `Access-Control-Allow-Origin: *`;
`github.com/H2-invent/jitsi-admin/tree/master/src/EventListener`). `nelmio_cors.yaml` allows
GET/OPTIONS/POST/PUT/PATCH/DELETE with `Content-Type`/`Authorization` headers, origin from a
`CORS_ALLOW_ORIGIN` env var — **CORS is not a framing control**, and there is no framing hardening
to rely on. The official install guide (`installDocker.md`) states outright: *"The installation is
not production ready. So you have to apply your own security rules."* **Practical read**: jitsi-admin
itself won't refuse to be framed out of the box, but nothing guarantees an operator's reverse proxy
won't add restrictive headers either — this is left entirely to the deployer, undocumented.

**(b) The actual Jitsi Meet / LiveKit conference room — a different story, and the harder problem.**
There is a dedicated wiki page for exactly this:
**"Add jitsi admin to an allowed frame ancestor"**
(`github.com/H2-invent/jitsi-admin/wiki/Add-jitsi-admin-to-an-allowed-frame-ancestor`). It targets
hardening the **separate Jitsi Meet host** (e.g. `meet.domain.org`), and its recommended Nginx
config sets a CSP with `frame-ancestors` explicitly limited to the jitsi-admin domain, the meet
domain itself, and `file://`. This confirms a stock Jitsi Meet install may **not** permit arbitrary
third-party framing by default, and H2-invent's own guidance is to widen `frame-ancestors` to name
specific allowed domains — never to allow arbitrary origins. **To embed the live call itself inside
an oCIS web extension, the operator would additionally need to widen this `frame-ancestors` list to
include the oCIS origin on the Jitsi Meet server** — this is not supported out of the box. This wiki
page was **last edited March 2022**, predates jitsi-admin's LiveKit-first pivot, and says nothing
about LiveKit — **its currency for 2026 is not confirmed**.

**How jitsi-admin embeds the conference itself:** `templates/start/index.html.twig` loads
`https://{{ room.server.url }}/external_api.js` and instantiates
`new JitsiMeetExternalAPI(...)` with `parentNode: document.querySelector('#jitsiWindow')` — i.e.
jitsi-admin uses the **official Jitsi Meet IFrame API**, not a bare `<iframe src>`, for classic
Jitsi. For LiveKit, the same template instead builds a JWT-authenticated URL of the form
`{{ room.server.livekitMiddlewareUrl ?: LIVEKIT_BASE_URL }}/meetling/room/...`, pointing at a
**separate LiveKit front-end/middleware ("meetling")**, distinct from the raw LiveKit media server
(`assets/js/livekit/`, `onlyConferenceLivekit.js`, `moderatorIframe.js`, `multiframe.js`, `join.js`
under `github.com/H2-invent/jitsi-admin/tree/master/assets/js`). **Not confirmed**: how "meetling"
itself sets (or doesn't set) its own framing headers — its full source was not located inside this
repo and may live in a separate H2-invent project.

**Implication for D1**: jitsi-admin is architected as an *embedder* (it wraps Jitsi/LiveKit via the
official IFrame API / a JWT URL), not as something designed to be embedded by third parties. Putting
jitsi-admin inside an oCIS iframe means **nesting two iframe layers** (oCIS → jitsi-admin page →
jitsi-admin's own internal Jitsi Meet IFrame API frame, or LiveKit "meetling" frame). This requires
permissive framing at *both* layers — jitsi-admin's own reverse proxy (undocumented, operator's
responsibility) and the underlying conference server's `frame-ancestors` (documented but narrow,
Jitsi-only, stale). Additionally — not addressed by any source found, and worth flagging as a
concrete engineering risk beyond framing — **WebRTC camera/mic permission delegation must propagate
through every iframe layer** (each nested `<iframe>` needs a matching
`allow="camera *; microphone *; display-capture *"` Permissions-Policy attribute); we control the
outermost frame, but not the markup of jitsi-admin's own internal Jitsi/LiveKit frame, so this cannot
be fully verified from source and needs an empirical test against a live deployment.

### 1.4 Self-hosting requirements

Three compose manifests exist at repo root: `docker-compose.yml`, `docker-compose.cluster.yml`,
`docker-compose.test.yml`.

**`docker-compose.yml`** (base stack):

| Service | Image | Role |
|---|---|---|
| `traefik-ja` | `traefik:v2.5` | Reverse proxy (80/443) |
| `websocket-ja` | `h2invent/jitsi-admin-websocket:latest` | Confirms the "jitsi-admin-websocket" container the brief asked about — real-time signaling (lobby/notifications) |
| `app-ja` | `h2invent/jitsi-admin-main:latest` | Main Symfony app |
| `app-queu` | same image, queue-worker mode | Async Symfony Messenger consumer |
| `db-ja` | `mariadb:latest` | Database |
| `keycloak-ja` | `quay.io/keycloak/keycloak:26.1.0` | Bundled OIDC IdP |

**`docker-compose.cluster.yml`** adds `whiteboard-ja` (collaborative whiteboard) and `etherpad`
(collaborative notes), and pins Keycloak to `22.0.3` — a version-drift discrepancy vs. the base
compose file's `26.1.0`, worth noting.

**No Jitsi Meet or LiveKit media server ships in either compose file.** jitsi-admin is purely a
control-plane/admin app; the media server is deployed and registered separately (URL + API
key/app-secret) as a `Server` entity. The Wiki's `Livekit-Server` page documents a **systemd-based**
(not Docker) LiveKit deployment: binary on `127.0.0.1:7880`, Redis on `127.0.0.1:6379`, Caddy as
TLS-terminating proxy, RTC media on UDP `7882–7892`/TCP `7881` — architecturally decoupled from the
jitsi-admin app stack.

**Data sovereignty read (feeds D4)**: self-hosting jitsi-admin means standing up Symfony app +
MariaDB + Keycloak + Traefik + websocket container, **plus** a separately-deployed Jitsi Meet or
LiveKit media server (Docker or systemd) that is not part of jitsi-admin's own compose files at all.
This is a materially heavier self-hosting footprint than draw-io's (a single public or self-hosted
`embed.diagrams.net`-compatible URL, §2.1).

---

## 2. oCIS extension precedents (this repo, `owncloud/web-extensions`)

### 2.1 `packages/web-app-draw-io`

Canonical "iframe editor with operator-configured base URL" pattern:
- `public/manifest.json` (`packages/web-app-draw-io/public/manifest.json`) supplies `entrypoint` and
  a `config` object: `{ "url": "https://embed.diagrams.net", "theme": "minimal" }` — a public default
  URL, overridable per deployment.
- `src/App.vue` (`packages/web-app-draw-io/src/App.vue`) reads `applicationConfig` for `url`/`theme`,
  builds an iframe `src` via query params (`embed`, `chrome`, `proto=json`, `ui=<theme>`), and
  communicates bidirectionally with the iframe via `postMessage`/`window.addEventListener('message')`,
  **checking `event.origin` against the configured `url` before trusting a message** — the
  established pattern for any cross-origin iframe messaging in this repo.
- `src/index.ts` registers an `AppWrapperRoute` (file-editor pattern) plus an `appMenuItem` extension
  (`type: 'appMenuItem'`) with `handler: () => openEmptyEditor(...)`.
- `tests/unit/App.spec.ts` is a one-assertion smoke test: the iframe `src` starts with the configured
  `url`.

### 2.2 `packages/web-app-external-sites`

Canonical "arbitrary external URL, new tab or iframe" pattern:
- `src/types.ts` defines a Zod schema: each site has `name`, `target: 'embedded' | 'external'`,
  `url`, plus optional `color`/`icon`/`priority`.
- `src/index.ts`: for `target: 'embedded'` sites, registers a route rendering `App.vue` (a plain
  `<iframe :src="url">`, no postMessage handling at all — simpler than draw-io because there's no
  bidirectional protocol to speak); for `target: 'external'`, the `appMenuItem` extension gets a
  bare `url` instead of a `path`, which (per web-pkg's menu-item contract) opens a new tab/window
  instead of routing internally.
- `README.md` explicitly calls out the CORS/CSP boundary: *"the target server needs to allow being
  embedded via its CORS settings. The server running oCIS ... needs to allow embedding the target via
  its CSP rules ... If embedded doesn't work ... you need to use `external` instead."* — this repo's
  own precedent for exactly the D1 framing risk identified in §1.3.

### 2.3 `docs/starting_guide.md` conventions

- New extensions go in `packages/web-app-<name>`, added to the `test` matrix (see §2.5) and to the
  `docker-compose.yml` volume mounts.
- CSP changes go in `dev/docker/csp.yaml`.
- README required; l10n via `gettext`/`vue3-gettext`; theming (light/dark) must be supported;
  tests required.
- **Discrepancy vs. this document's own text**: `starting_guide.md` still instructs contributors to
  "Add the new web-extension to the `APPS` variable in the `.drone.star` file" — **no `.drone.star`
  file exists in this repo**; CI is GitHub Actions (`.github/workflows/test.yml`), and the
  equivalent step today is adding the package name to the `test` job's `matrix.app` list (§2.5). This
  is a stale line in the guide, not a Phase-0 blocker, but worth a heads-up rather than following it
  literally.

### 2.4 `dev/docker/csp.yaml`

Current directives relevant to this work (`dev/docker/csp.yaml`):
```
frame-src: "'self'", 'blob:', 'https://embed.diagrams.net/', 'https://owncloud.dev/'
connect-src: "'self'", 'blob:', 'https://raw.githubusercontent.com/owncloud/awesome-ocis/', 'https://*.tile.openstreetmap.org'
frame-ancestors: "'self'"
media-src: "'self'"
```
The photo-addon's OpenStreetMap tile entries (commented `# Photo-addon: ...`) are the precedent for
adding a scoped, commented third-party domain to `connect-src`/`img-src`. A jitsi-conference
extension would need analogous additions: `frame-src` for the jitsi-admin domain (and, per §1.3, the
conference/`meet`/LiveKit domain if the live call is ever framed directly), `connect-src` for the
jitsi-admin domain plus a `wss://` entry for the websocket container (§1.4) and for LiveKit's own
signaling websocket, and `media-src`/camera-mic permissions are governed by the iframe's
`allow` attribute (HTML), not CSP — CSP has no camera/microphone directive.

### 2.5 Deployment manifest pattern (`drawio.yml`) — path discrepancy, resolved

**The path in the task brief, `deployments/examples/ocis_full/web_extensions/drawio.yml`, does not
exist in `owncloud/web-extensions`** — confirmed by listing the repo root (no `deployments/`
directory at all). `docs/starting_guide.md` explains why: the `ocis_full` deployment example is
maintained in a *separate* repository and only linked from here. Historically that was
`owncloud/ocis`, but **`owncloud/web` was merged into `owncloud/ocis` on 2026-07-14** (ownCloud's own
announcement, "ownCloud Web and oCIS Are Now One Codebase. All Apache-2.0." —
`owncloud.com/blogs/owncloud-web-and-ocis-are-now-one-codebase/`; the `owncloud/web` repo is now
archived and its frontend lives under `web/` inside `owncloud/ocis`). Fetching
`github.com/owncloud/ocis/tree/master/deployments/examples/ocis_full/web_extensions` confirms the
file exists there today, alongside `advanced-search.yml`, `externalsites.yml`, `importer.yml`,
`jsonviewer.yml`, `photo-addon.yml`, `progressbars.yml`, `unzip.yml`, and an `extensions.yml`.
`drawio.yml`'s content (fetched from
`raw.githubusercontent.com/owncloud/ocis/master/deployments/examples/ocis_full/web_extensions/drawio.yml`)
is an init-container pattern:
- A `drawio-init` service using image `owncloud/web-extensions:draw-io-0.4.1` (the per-app release
  tag scheme from this repo's own `CLAUDE.md`), running as root, copying files from
  `/var/lib/nginx/html/draw-io/` into a shared `ocis-apps` volume.
- The main `ocis` service mounts the same `ocis-apps` volume at `/apps` and depends on `drawio-init`
  via `service_completed_successfully`.

**Action item for Phase 1** (not done now, per Phase-0 scope): a `jitsi-conference.yml` counterpart
would need to be authored in `owncloud/ocis` (a repository this session's GitHub tooling cannot
write to — it is scoped to `owncloud/web-extensions` only), not in this repository. This is a
process/repo-boundary fact to confirm with the maintainers before Phase 1, not something to route
around.

---

## 3. oCIS identity/data surfaces for later phases (read only, not implemented)

### 3.1 LibreGraph drive members / driveItem permissions (Phase 2/3)

Not implemented or exercised in this pass — this repo contains no LibreGraph client code to read
directly (extensions call `@ownclouders/web-client`, which wraps these APIs, but the wrapper's
source lives in the now-merged `owncloud/ocis` `web/` tree, out of this session's GitHub scope).
Public search corroborates the general shape (Microsoft Graph-compatible driveItem/permissions
model — LibreGraph mirrors it): a drive's members/permissions and a `driveItem`'s sharing recipients
are both reachable via `.../permissions` sub-resources analogous to Microsoft Graph's
`GET /drives/{drive-id}/items/{item-id}/permissions`. **Not independently verified against
ownCloud's actual LibreGraph OpenAPI spec in this pass** — flagged as a Phase 2/3 prerequisite read,
not a Phase 0/1 blocker.

### 3.2 `web-app-external` / `useAppProviderService` / collaboration service (Phase 4)

**No `web-app-external` package exists in `owncloud/web-extensions`** (the 25 packages in
`packages/` are listed in §2.5; none is named `web-app-external`), and no `useAppProviderService` or
`collaboration` service reference exists anywhere in this repo (a repo-wide grep for both terms
turned up nothing beyond an unrelated use of the word "collaboration" in `README.md`'s OSPO
paragraph). This component lives in the Web frontend proper, which — per §2.5 — now lives inside
`owncloud/ocis` under `web/`, a repository outside this session's GitHub scope. Public search
confirms the general shape (an "app provider" service integrates WOPI-style document editors —
Collabora, OnlyOffice — into an iframe, with a `Host_PostmessageReady` handshake and
`PutRelativeFile` support for save-as flows), but the exact `useAppProviderService` composable
contract was **not independently verified** in this pass. This is a Phase 4 prerequisite read, to be
done directly against `owncloud/ocis` (`web/`) when that phase starts.

---

## 4. Summary of open / unresolved items carried into `DECISIONS.md`

1. jitsi-admin's true license (`LICENSE` file vs. `composer.json`'s `"proprietary"` field) —
   unresolved, needs a direct fetch.
2. Whether nested iframe framing (oCIS → jitsi-admin → Jitsi/LiveKit) actually works against a live
   deployment — the 2022-vintage, Jitsi-only wiki guidance is the only documentation found, LiveKit's
   "meetling" frontend's framing behavior is undocumented, and WebRTC permission-policy propagation
   through jitsi-admin's own internal iframe cannot be verified from source. **This is D1 and it is
   not resolved by archaeology alone — see `DECISIONS.md`.**
3. The `jitsi-conference.yml` deployment manifest belongs in `owncloud/ocis`, not this repo — a
   process fact, not a blocker, but it means Phase 1's deployment-manifest deliverable needs a
   separate PR against a different, currently out-of-scope repository.
