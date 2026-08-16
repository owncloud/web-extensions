# DECISIONS.md — jitsi-admin oCIS Web Extension

Status after Phase 0 archaeology (`ARCHAEOLOGY.md`). D1–D4 are now all resolved (see below); Phase 1
has been implemented as `packages/web-app-jitsi-conference`. Phase 2 ("call all Space members") and
Phase 3 ("call all recipients of a file/folder") have also been implemented — see their sections
below. Phase 4 remains out of scope.

---

## D1 — Iframe feasibility of the live call itself

**Status: Resolved — by design, not by empirical smoke test.** Sign-off: don't nest the live call in
an iframe at all; open jitsi-admin top-level in a new browser tab instead.

What archaeology found (`ARCHAEOLOGY.md` §1.3):
- jitsi-admin's own dashboard/scheduling pages have no built-in `X-Frame-Options`/CSP
  `frame-ancestors` — nothing in its own source blocks framing them.
- jitsi-admin is itself an **embedder**: it puts the live Jitsi Meet room in an iframe via the
  official Jitsi Meet IFrame API (`external_api.js` / `JitsiMeetExternalAPI`), or points a LiveKit
  "meetling" frontend at a JWT-authenticated URL.
- Framing jitsi-admin inside our own iframe would therefore **nest our extension's iframe around
  jitsi-admin's own internal Jitsi/LiveKit iframe** — two layers deep, not one — and the only
  documented framing guidance found (a 2022-vintage wiki page, Jitsi-only, silent on LiveKit) shows
  H2-invent's own recommendation is to widen `frame-ancestors` to *specific named domains*, never to
  arbitrary third parties. WebRTC camera/mic access additionally requires a matching
  `allow="camera *; microphone *"` attribute on **every** nested iframe in the chain, including one
  we don't control (jitsi-admin's own internal frame).

**Resolution:** rather than resolve that risk empirically, we removed it by construction.
`web-app-jitsi-conference`'s "Start video call" menu item has no `path` and only a `url` — following
the `web-app-external-sites` `target: 'external'` convention already established in this repo, it
opens jitsi-admin in a new top-level browser tab, never inside an oCIS iframe. jitsi-admin then runs
its own (already-proven, single-layer) Jitsi Meet IFrame API / LiveKit embedding exactly as every
existing jitsi-admin installation does today — no additional nesting is introduced, so there is
nothing new to verify. A true embedded-iframe experience remains a possible future enhancement, but
only for operators who have independently verified their jitsi-admin + Jitsi/LiveKit deployment
permits nested `frame-ancestors`; it is not the default and not required for Phase 1.

---

## D2 — Identity mapping: rely entirely on a valid OIDC session

**Status: Decided by the mission brief, and confirmed feasible by archaeology, with one residual UX
risk to accept rather than solve.**

- jitsi-admin supports OIDC login against Keycloak, not just LDAP
  (`src/Controller/LoginControllerKeycloak.php`, `src/Security/KeycloakAuthenticator.php`,
  `stevenmaguire/oauth2-keycloak` + `knpuniversity/oauth2-client-bundle` in `composer.json`) — this
  confirms the brief's premise.
- It is a classic Authorization Code flow with a full-page redirect to Keycloak and back
  (session/cookie-based, not silent token exchange). If the same browser already has an active
  Keycloak SSO session (the same IdP oCIS uses), the redirect *may* complete without a visible
  credential prompt, but it will still be a **visible navigation inside the iframe** on first load —
  the brief explicitly accepts this as an OK Phase 1 UX, and archaeology found nothing to suggest a
  silent, invisible SSO check is possible here. **No hidden token-passing will be built**, per the
  brief's own instruction.
- Client-registration requirement for admins: jitsi-admin needs a registered Keycloak OIDC client
  (redirect URI, client ID/secret, `keycloakId` claim mapping) — document this as an admin
  deployment step in the Phase 1 README; not implementable in this repo (it's Keycloak-side config).
- **Residual, unresolved risk (flagged, not solved)**: a full-page OAuth redirect *inside a
  third-party iframe* interacts with third-party-cookie restrictions in some browsers (Safari ITP,
  Chrome's phase-out of unpartitioned third-party cookies). Whether jitsi-admin's Keycloak session
  cookie survives that context is a **browser-compatibility risk to test empirically**, not
  something resolvable by reading source. This is a Phase 1 empirical-testing item, not a Phase 0
  blocker — flagged so it isn't silently assumed to work.

## D3 — Static-app boundary / sidecar necessity

**Status: Resolved by archaeology for Phase 1 (no sidecar needed) and for Phase 2/3 (a sidecar will
be needed) — no further sign-off required now, decision recorded for future phases.**

- Phase 1 needs no room-provisioning automation (manual "start a meeting" via jitsi-admin's own UI,
  D2's OIDC login) — **no sidecar needed for Phase 1**, matching the confirmed static-app pattern.
- For Phase 2/3 (call all Space members / call all file recipients): archaeology confirms
  jitsi-admin's `/api/v1/*` room-creation and invite API authenticates callers against a **static,
  per-registered-server `apiKey`** (`ARCHAEOLOGY.md` §1.1/§1.2), not a forwarded end-user OIDC bearer
  token, and the project's own documentation says the API is meant for backend-server-to-backend-
  server use only. This means the browser **cannot** call jitsi-admin's room-provisioning API
  directly as the authenticated end user — that credential is a service secret, and per D2 it must
  never be exposed to the browser. **Conclusion: Phase 2/3 will require a sidecar**, following the
  `ai-llm-proxy` precedent already in this repo (`packages/ai-llm-proxy/src/index.ts`): validate the
  end user's oCIS OIDC bearer token server-side against oCIS's OIDC userinfo endpoint
  (`validateOcisToken()`), enforce the mandatory `Origin` header check against `OCIS_URL` (per
  `CLAUDE.md`'s security requirement, which applies to any new LLM- or non-LLM-calling proxy
  equally), and only then call jitsi-admin's `/api/v1/room`/`/api/v1/user` server-to-server with the
  jitsi-admin `Server.apiKey` that only the sidecar holds. This is recorded now as a decision for
  Phase 2/3 and is explicitly **out of scope for the Phase 1 implementation that follows this
  document**.

## D4 — Data sovereignty

**Status: Confirmed as a requirement; documentation obligation for Phase 1 README, no open
question.**

- `manifest.json`'s `url` config must be operator-set with **no default pointing at a public
  instance** (`jitsi-admin.de` or any public Jitsi) — same precedent as draw-io's `url` config
  (`ARCHAEOLOGY.md` §2.1), except unlike draw-io (which ships a working public default,
  `https://embed.diagrams.net`), the jitsi-conference extension's manifest should ship with an
  **empty/placeholder `url`**, since there is no acceptable public default here.
- Self-hosting footprint (confirmed, `ARCHAEOLOGY.md` §1.4) is heavier than draw-io's: jitsi-admin
  app + MariaDB + Keycloak + Traefik + websocket container, **plus** a separately deployed Jitsi
  Meet or LiveKit media server not included in jitsi-admin's own compose files at all. State this
  explicitly in the Phase 1 README so BayLfSt/EOSC/ByCS Drive operators understand the full
  self-hosting scope before adopting the extension, not just the jitsi-admin piece.

---

## Additional items surfaced during archaeology (not part of D1–D4, but relevant)

- **jitsi-admin's license is not fully confirmed** (`LICENSE` file vs. `composer.json`'s
  `"proprietary"` field, `ARCHAEOLOGY.md` §1.2). **Accepted as fine for a web-extension** — this
  extension only links out to an operator-run jitsi-admin instance and ships no jitsi-admin code of
  its own, so the license of jitsi-admin itself does not attach to this repo. No further action.
- **The `drawio.yml`-style deployment manifest question is resolved: nothing needs to leave
  `owncloud/web-extensions`.** Rather than authoring a separate manifest in the now-merged
  `owncloud/ocis` repo, `web-app-jitsi-conference` is wired into this repo the same way
  `web-app-external-sites` is: a `dist/` volume mount in `docker-compose.yml` plus a
  `tests/config/manifest.json` override mounted over it for local dev/CI. No CSP change was needed
  — the "Start video call" link opens a new tab rather than an iframe or a cross-origin fetch, so
  the default `frame-ancestors`/`connect-src` in `dev/docker/csp.yaml` already cover it. A separate
  `owncloud/ocis` deployment-example PR remains a possible future addition for production
  `ocis_full` deployments, but is not required to ship Phase 1.
- `docs/starting_guide.md` still references a `.drone.star` file that no longer exists in this repo
  (CI is now GitHub Actions, `.github/workflows/test.yml`) — a stale doc, not a blocker, flagged so
  Phase 1 doesn't waste time looking for it.

---

## Phase 1 status

Implemented as `packages/web-app-jitsi-conference` (see its `README.md` for user-facing
configuration and design-decision documentation). Not yet added to the `.github/workflows/test.yml`
`test` matrix or given an e2e test, per the brief's explicit "Playwright e2e can wait for Phase 1
completion sign-off — don't gold-plate" — that job runs `test:e2e` unconditionally for every matrix
entry, so adding this package before an e2e test exists would break CI. Unit tests, build, lint, and
type-checking all pass locally.

---

## Phase 2 — "Call all Space members"

### Extension point (verified, not assumed)

The original brief flagged this as an open question: "likely `global.spaces.actions` or a
spaces-context-menu equivalent — verify the actual extension point name during Phase 0, don't
assume." A dedicated research pass against `owncloud/ocis`'s `web/` source (the merged frontend, see
D3/ARCHAEOLOGY.md §2.5) found:

- **The Spaces overview list's context menu is not third-party extensible at all.**
  `web/packages/web-app-files/src/components/Spaces/SpaceContextActions.vue` is hardcoded to
  built-in `useSpaceActions*` composables (rename, delete, disable, show members, etc.) and never
  calls `useExtensionRegistry`/`requestExtensions`. There is no `global.spaces.*` extension point —
  the grep-based absence found in the original archaeology (`ARCHAEOLOGY.md` §3, implicitly) was
  correct, not a search-tooling gap.
- **The generic, extensible `global.files.context-actions`/`global.files.sidebar` points (from
  `web-pkg`'s `ContextActions.vue`/`FileSideBar.vue`) are used for file/folder rows
  (`GenericSpace.vue`, `GenericTrash.vue`, `AppBar.vue`), not for Space rows in `Projects.vue`.**
- **`global.files.sidebar` is the one extensible point that does reach a Space**: `Projects.vue`
  (the Spaces list view) renders its details sidebar via the shared `FileSideBar` component, whose
  `requestExtensions<SidebarPanelExtension<SpaceResource, Resource, Resource>>({ id:
  'global.files.sidebar', ... })` call is generic over `SpaceResource` — the same point
  `ai-doc-summary`/`chat-with-file` already use for their file-detail panels, just gated by
  `isProjectSpaceResource(items[0])` instead of a file-extension check.

**Resolution:** Phase 2 is implemented as a `sidebarPanel` extension on `global.files.sidebar`
(`packages/web-app-jitsi-conference/src/extensions.ts`), not a context-menu `action` — because no
context-menu extension point for Spaces exists to register one against.

### Member listing (LibreGraph, confirmed locally)

No external research was needed here: the locally-installed `@ownclouders/web-client@12.5.0`
package's shipped type declarations confirm `SpaceResource.members: Record<string, SpaceMember>`
(`SpaceMember = { grantedTo: SharePointIdentitySet, permissions, roleId }`) is already present on
any Space resource obtained through the normal Files/Spaces app — no extra Graph call is needed to
list members. `SharePointIdentitySet.user`/`.group` distinguishes individual-user grants from group
grants; only the former can be resolved to an invitable email (via `GraphUsers.getUser(id, {
select: ['mail'] })`), so **group grants are skipped** — expanding a group to its members' emails is
explicitly out of scope for this feature (matches the brief's own precedent of scoping Phase 3's OCM
handling out for a follow-up rather than silently attempting it).

### Notification mechanism (resolved without needing oCIS's notification API)

The brief asked for "notifies members (oCIS notification/SSE surface, or plain in-app link)".
`@ownclouders/web-client`'s SSE module only exposes a `MESSAGE_TYPE.NOTIFICATION` enum for
*receiving* system-generated events (share created, space member added, etc.) — there is no
client-exposed API for a user to *create* an arbitrary notification targeted at another user, and
whether oCIS's backend notification/userlog service even allows that (as opposed to only
system-triggered notifications) was never confirmed. This was resolved without needing to answer
that question: Phase 0's archaeology already established that jitsi-admin's own
`RoomAddService::createUserFromUserUid()` sends invitation emails itself when a participant is added
to a room (`ARCHAEOLOGY.md` §1.1). The `jitsi-admin-proxy` sidecar simply calls jitsi-admin's own
`/api/v1/user` endpoint per resolved member — jitsi-admin does the notifying, oCIS's notification
surface is never touched.

### Sidecar (`packages/jitsi-admin-proxy`)

New package, structured identically to `packages/ai-llm-proxy` (mandatory `Origin` check against
`OCIS_URL`, oCIS OIDC bearer-token validation against `/userinfo`, per-user rate limiting). It is the
only place the jitsi-admin `Server.apiKey` service credential lives, per D3.

**Caveat, stated plainly rather than papered over:** the exact request/response field names used
when calling jitsi-admin's `/api/v1/room` (`name`/`email`/`server`/`start`/`duration`) and
`/api/v1/user` (`room`/`email`) are a best-effort reconstruction from Phase 0's source-reading of
H2-invent/jitsi-admin's Symfony controllers — this has **not** been exercised against a live
jitsi-admin instance, which wasn't available in this environment. The sidecar is built to fail
cleanly (a clear error surfaced to the panel) rather than crash if these assumptions are wrong, and
the two functions making these calls (`createJitsiAdminRoom`/`inviteJitsiAdminParticipant`) are kept
small and isolated specifically so they're easy to correct once verified against a real deployment.
See `packages/jitsi-admin-proxy/README.md`.

### Not implemented (at the time Phase 2 shipped)

Phase 3 (call all recipients of a file/folder) and Phase 4 (Collabora-plus-call layout) remained
explicitly out of scope, per the original brief. Phase 3 has since been implemented — see below;
Phase 4 remains out of scope.

---

## Phase 3 — "Call all recipients of a file/folder"

### Extension point and UI (reused, not duplicated)

The same `global.files.sidebar` `sidebarPanel` extension point Phase 2 uses for Spaces already
covers regular files/folders — `web-pkg`'s generic `FileSideBar`/`ContextActions` components render
it for any `Resource`, not just `SpaceResource` (§Phase 2 above). Rather than a second, separate
extension point, `packages/web-app-jitsi-conference/src/extensions.ts` now registers a **second**
`sidebarPanel` extension on the same point, gated by `!isSpaceResource(items[0])` instead of
`isProjectSpaceResource(items[0])` — the two panels are mutually exclusive by construction (a
selection is either a Space or it isn't) and share the same "Video call" title, icon, and
`jitsiAdminProxy` config gate.

**A real bug this surfaced during testing, worth recording:** `isSpaceResource` checks
`resource.type === 'space'`, not `resource.driveType` (which is what `isProjectSpaceResource`
checks). A test mock built with only `{ driveType: 'project' }` and no `type` field passes
`isProjectSpaceResource` but fails `isSpaceResource` — confirmed by reading `@ownclouders/web-client`'s
actual bundled implementation (`dist/*.cjs`), not just its type declarations, since the two guards
check different fields entirely. Real `SpaceResource` objects built via `buildSpace()` always set
both fields, so this was a test-mock gap, not a production bug — but it's a sharp edge worth flagging
for anyone else mocking a `SpaceResource` in this codebase.

### Recipient resolution (LibreGraph, confirmed locally)

`GraphPermissions.listPermissions(driveId, itemId)` (already present in the locally-installed
`@ownclouders/web-client@12.5.0` types) returns a resource's shares. Each `CollaboratorShare` carries
a numeric `shareType` and a `sharedWith: Identity`; the package also exports a `ShareTypes` class
(`ShareTypes.user`/`.group`/`.link`/`.guest`/`.remote`, each with a stable `.value`) so filtering
never needs a magic number. Only shares with `shareType === ShareTypes.user.value` are resolved to an
invitable email (another `GraphUsers.getUser(id, { select: ['mail'] })` call per recipient, same as
Phase 2) — **group shares, public links, guest shares, and `ShareTypes.remote` (federated/OCM) shares
are all skipped**, exactly matching the brief's own guidance to scope Phase 3 to same-instance
individual recipients first and flag OCM as a follow-up rather than attempt it silently.

### Shared plumbing, not duplicated logic

The room-provisioning/error-handling core (proxy call, bearer header, timeout/error classification,
invited/skipped/failed reporting) was extracted out of `useSpaceCall` into a new
`useJitsiCall(proxyConfig, roomName, resolveParticipants)` composable once there were two real call
sites; `useSpaceCall` and the new `useFileCall` are now both thin wrappers supplying only how to name
the room and how to resolve participants. `useSpaceCall`'s existing tests were re-run unchanged after
the extraction to confirm it stayed behavior-preserving.

### Sidecar

No changes needed — `jitsi-admin-proxy` already accepts an arbitrary `roomName` +
`participants[]` list; Phase 3 is a new caller of the same endpoint, not a new API surface.

### Not implemented

Phase 4 (Collabora-plus-call layout) remains out of scope, per the original brief.
