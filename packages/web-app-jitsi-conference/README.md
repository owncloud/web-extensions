# web-app-jitsi-conference

Adds a "Start video call" entry to the ownCloud Web app menu that opens a self-hosted
[H2-invent/jitsi-admin](https://github.com/H2-invent/jitsi-admin) instance in a new browser tab, so
users can start or join a Jitsi Meet / LiveKit video call alongside oCIS.

## Configuration

```
"config": {
  "url": "https://jitsi-admin.example.com"
}
```

- `url` _(string, required)_ — the base URL of your self-hosted jitsi-admin instance. There is
  **no default**: this extension intentionally ships unconfigured and adds no menu item at all
  until an operator sets a `url`. It must never be pointed at a public instance (e.g.
  `jitsi-admin.de`) for any deployment with data-sovereignty requirements — see "Self-hosting" below.
- `color` _(string, optional)_ — Hex color code for the menu item icon background.
- `icon` _(string, optional)_ — name of a [Remix Icon](https://remixicon.com/) for the menu item.
  Defaults to `vidicon-line`.
- `priority` _(number, optional)_ — order of the menu item. Defaults to `30`.

Please refer to [the Web app docs](https://owncloud.dev/services/web/#application-configuration)
if you want to learn how to configure a Web app.

## Design decisions

This extension deliberately opens jitsi-admin in a **new browser tab** rather than embedding it in
an iframe. jitsi-admin embeds the live Jitsi Meet room itself (via the official Jitsi Meet IFrame
API) or a separate LiveKit front-end; nesting jitsi-admin inside an oCIS iframe would therefore nest
the live call two iframe layers deep, which depends on `frame-ancestors` permissions at both layers
and on WebRTC camera/microphone permission-policy propagating correctly through a doubly-nested
frame — none of which is guaranteed by jitsi-admin out of the box. Opening jitsi-admin top-level
avoids that risk entirely: the call then runs exactly the way every existing jitsi-admin
installation already runs it, with no additional nesting introduced by oCIS.

## Identity

This extension relies entirely on jitsi-admin's own OIDC login against the same identity provider
(Keycloak) that oCIS uses — there is no service-account bridge, no separate jitsi-admin credential,
and oCIS never mints or forwards a token to jitsi-admin on the user's behalf. Concretely, this means:

- jitsi-admin must be configured as an OIDC relying party against the same Keycloak instance as
  oCIS (redirect URI, client ID/secret, and a claim mapping that populates jitsi-admin's
  `keycloakId` user field) — this is an admin deployment step, not something this extension
  configures.
- The first time a user opens the "Start video call" tab, jitsi-admin will redirect through
  Keycloak's login flow. If the browser already has an active Keycloak SSO session, this may
  complete without a credential prompt, but it will still be a visible page navigation — there is
  no hidden or silent token exchange.

Automating room creation for a Space's members or a file's recipients (calling jitsi-admin's
`/api/v1/room` and `/api/v1/user` APIs) is out of scope for this extension: those endpoints
authenticate with a static, per-server API key rather than a forwarded end-user token, so any such
automation would need a small server-side component holding that key — not implemented here.

## Self-hosting

jitsi-admin's own Docker Compose stack (jitsi-admin, MariaDB, Keycloak, Traefik, a websocket
container) does **not** include a Jitsi Meet or LiveKit media server — that must be deployed and
registered into jitsi-admin separately. Plan for both when self-hosting this extension's backend,
particularly for deployments with EU/data-sovereignty requirements where neither jitsi-admin nor the
underlying media server may be a public instance.
