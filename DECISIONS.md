# DECISIONS.md — jitsi-admin oCIS Web Extension

Status after Phase 0 archaeology (`ARCHAEOLOGY.md`). Per the mission brief: Phase 1 implementation
does not start until D1–D3 are either resolved or explicitly signed off with a known residual risk.
**This document recommends holding Phase 1 pending a sign-off on D1** — see below.

---

## D1 — Iframe feasibility of the live call itself

**Status: NOT resolved by archaeology. Requires either a live-deployment smoke test or explicit
user sign-off to proceed on an unverified assumption.**

What archaeology found (`ARCHAEOLOGY.md` §1.3):
- jitsi-admin's own dashboard/scheduling pages have no built-in `X-Frame-Options`/CSP
  `frame-ancestors` — nothing in its own source blocks framing them. Good news for the *outer*
  frame.
- jitsi-admin is itself an **embedder**: it puts the live Jitsi Meet room in an iframe via the
  official Jitsi Meet IFrame API (`external_api.js` / `JitsiMeetExternalAPI`), or points a LiveKit
  "meetling" frontend at a JWT-authenticated URL. We would not need to write our own IFrame API
  integration — jitsi-admin already does that internally.
- But that means our extension's iframe would **nest inside** jitsi-admin's own internal
  Jitsi/LiveKit iframe — two layers deep, not one. The only documented framing guidance found (a
  2022-vintage wiki page, Jitsi-only, silent on LiveKit) shows H2-invent's own recommendation is to
  widen `frame-ancestors` to *specific named domains*, never to arbitrary third parties. Whether an
  operator's Jitsi Meet/LiveKit deployment permits our oCIS origin in that list is a runtime,
  per-deployment configuration fact, not something guaranteed by the software.
- Independently of framing headers, WebRTC camera/mic access requires a matching
  `allow="camera *; microphone *"` Permissions-Policy attribute on **every** nested iframe in the
  chain. We control our own outer iframe's `allow` attribute; we do not control the markup of
  jitsi-admin's internal Jitsi/LiveKit iframe. Whether that inner iframe propagates permissions
  correctly through a nested-once-more context cannot be determined from source alone.

**Recommendation:** Phase 1 should implement the bare-iframe-of-jitsi-admin approach (no custom
Jitsi Meet IFrame API code on our side — matches the `web-app-draw-io`/`web-app-external-sites`
precedent architecturally), **but this must be verified empirically against a real jitsi-admin +
Jitsi/LiveKit deployment before Phase 1 is considered done**, not just built and merged on faith. If
that smoke test shows the live call cannot be framed (camera/mic blocked, or the conference host
refuses `frame-ancestors`), the fallback is **not** a small fix — it would mean writing a direct
integration against the Jitsi Meet IFrame API (or LiveKit client SDK) ourselves, bypassing
jitsi-admin's own room-page shell entirely, which is a materially larger, different scope than
Phase 1 as briefed. **Open question for the user/maintainers: do you have (or can you stand up) a
test jitsi-admin + Jitsi/LiveKit deployment to validate this against before Phase 1 code is written,
or should Phase 1 proceed on the bare-iframe assumption with this risk explicitly accepted and
tested at the e2e stage?**

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
  `"proprietary"` field, `ARCHAEOLOGY.md` §1.2) — recommend resolving before any legal/compliance
  sign-off, independent of the technical decisions above.
- **The Phase 1 deployment-manifest deliverable (`jitsi-conference.yml`, mirroring `drawio.yml`)
  belongs in `owncloud/ocis`, not `owncloud/web-extensions`** (`ARCHAEOLOGY.md` §2.5) —
  `owncloud/web` was merged into `owncloud/ocis` on 2026-07-14 and is now archived, and the
  `deployments/examples/ocis_full` tree lives under the merged repo. This session's GitHub tooling
  is scoped to `owncloud/web-extensions` only, so that half of Phase 1 cannot be delivered as a PR
  from this session without either widened repo scope or a separate follow-up in `owncloud/ocis`.
- `docs/starting_guide.md` still references a `.drone.star` file that no longer exists in this repo
  (CI is now GitHub Actions, `.github/workflows/test.yml`) — a stale doc, not a blocker, flagged so
  Phase 1 doesn't waste time looking for it.

---

## Recommendation

Hold Phase 1 code for a decision on **D1** specifically: either (a) the user/maintainers confirm a
live jitsi-admin + Jitsi/LiveKit test deployment exists or can be stood up to validate nested-iframe
framing and WebRTC permission propagation before Phase 1 lands, or (b) the user explicitly accepts
building Phase 1 on the bare-iframe assumption with validation deferred to Phase 1's own e2e-testing
step (i.e., "build it, and we'll find out together whether the live call frames correctly"). D2–D4
have clear, actionable answers above and do not block starting Phase 1 work once D1 is settled.
