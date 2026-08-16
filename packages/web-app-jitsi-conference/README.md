# web-app-jitsi-conference

Adds a "Start video call" entry to the ownCloud Web app menu that opens a self-hosted
[H2-invent/jitsi-admin](https://github.com/H2-invent/jitsi-admin) instance in a new browser tab, so
users can start or join a Jitsi Meet / LiveKit video call alongside oCIS. It also adds a "Video call"
panel to the details sidebar — for a Space, it creates a jitsi-admin room and invites the Space's
individual members by email in one click (see "Calling all Space members" below); for a regular file
or folder, it does the same for that item's individual share recipients (see "Calling all recipients
of a file or folder" below).

## Configuration

```
"config": {
  "url": "https://jitsi-admin.example.com",
  "jitsiAdminProxy": {
    "endpoint": "https://ocis.example.com/jitsi-admin-proxy/rooms"
  }
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
- `jitsiAdminProxy.endpoint` _(string, optional)_ — URL of the `jitsi-admin-proxy` sidecar (see
  `../jitsi-admin-proxy/README.md`). Only when this is set does the "Video call" Space sidebar panel
  (and the room-provisioning feature it drives) appear at all — there is no default here either.

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

## Calling all Space members

Opening a Space's details sidebar shows a "Video call" panel (a `sidebarPanel` extension on
`global.files.sidebar` — the Spaces overview's own right-click context menu is not third-party
extensible, so this is the closest available extension point) with a "Call all members" button.
Clicking it:

1. Resolves the Space's **individual user members** to email addresses via the LibreGraph
   `/users/{id}` endpoint. **Members granted access through a group are skipped** — resolving a
   group to its individual members' emails is out of scope for this feature; the panel reports how
   many members were skipped this way.
2. Calls the `jitsi-admin-proxy` sidecar (see `../jitsi-admin-proxy/README.md`) to create a room in
   jitsi-admin (owned by the calling user) and invite each resolved member by email. jitsi-admin
   sends the invitation emails itself — this extension never talks to any oCIS notification API, and
   doesn't need to.
3. Lets the initiating user open jitsi-admin (the same `url` as the "Start video call" menu item, in
   a new tab, per the design decision above) to actually start the room they just created.

This requires jitsi-admin's room-provisioning API (`/api/v1/room`, `/api/v1/user`), which
authenticates with a static, per-server API key rather than a forwarded end-user token — hence the
separate `jitsi-admin-proxy` sidecar, which is the only part of this feature that holds that key.
Without `jitsiAdminProxy.endpoint` configured, the panel doesn't appear at all.

## Calling all recipients of a file or folder

Opening the details sidebar for a regular file or folder (anything that isn't a Space) shows the
same "Video call" panel with a "Call all recipients" button. Clicking it:

1. Reads the item's share list via the LibreGraph `/permissions` endpoint and resolves only its
   **direct, same-instance individual-user shares** to email addresses (another `/users/{id}`
   lookup per recipient, same as the Space flow). **Group shares, public links, guest shares, and
   federated/OCM shares are all skipped** — expanding a group's membership, and reaching a
   federated recipient with no shared IdP, are both out of scope for this feature (the latter is
   exactly the "OCM is a harder case" caveat this feature was designed around from the start). The
   panel reports how many recipients were skipped this way.
2. Calls the same `jitsi-admin-proxy` sidecar as the Space flow to create a room and invite each
   resolved recipient by email.
3. Lets the initiating user open jitsi-admin in a new tab, same as everywhere else in this
   extension.

This reuses the same `jitsiAdminProxy.endpoint` configuration and the same sidecar as "Calling all
Space members" above — there is nothing extra to configure for this to also work on files/folders.

## Self-hosting

jitsi-admin's own Docker Compose stack (jitsi-admin, MariaDB, Keycloak, Traefik, a websocket
container) does **not** include a Jitsi Meet or LiveKit media server — that must be deployed and
registered into jitsi-admin separately. Plan for both when self-hosting this extension's backend,
particularly for deployments with EU/data-sovereignty requirements where neither jitsi-admin nor the
underlying media server may be a public instance.
