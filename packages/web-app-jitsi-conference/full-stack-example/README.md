# jitsi-conference full-stack example

A complete, self-contained Docker Compose stack for exercising this PR end to end: oCIS, Keycloak
(shared identity provider for both oCIS and jitsi-admin, per [`DECISIONS.md`](../../../DECISIONS.md)
D2), [H2-invent/jitsi-admin](https://github.com/H2-invent/jitsi-admin) (its own MariaDB + websocket
hub), [LiveKit](https://livekit.io) as the meeting backend jitsi-admin schedules rooms on, LiveKit's
official demo frontend so you can actually join a call in a browser, and Mailpit to catch the emails
Keycloak/jitsi-admin send.

This is deliberately **separate** from the repo's root `docker-compose.yml` (used by every other
package + CI). That file's oCIS service uses plain basic auth on a single host with path-prefix
routing; jitsi-admin needs its own vhost (for OAuth redirect URIs) and Keycloak/OIDC, neither of
which fit the shared file without changing it for everyone else. Run this one standalone instead.

## Prerequisites

- Docker with Compose v2
- The extension itself built: from the repo root, `pnpm --filter jitsi-conference build` (this
  stack mounts `../dist` directly rather than rebuilding it)

## Setup

1. Add these to `/etc/hosts` (all pointing at `127.0.0.1`):

   ```
   127.0.0.1 ocis.owncloud.test keycloak.owncloud.test jitsi.owncloud.test livekit.owncloud.test meet.owncloud.test
   ```

2. Copy `.env.example` to `.env` and fill in every secret it lists (each has a generation command
   in a comment above it). Leave `JITSI_ADMIN_API_KEY`/`JITSI_ADMIN_SERVER` blank for now - see
   step 4.

3. Bring the stack up:

   ```
   docker compose up -d
   ```

   First boot takes a few minutes (Keycloak importing both realms, jitsi-admin running its
   migrations, LiveKit Meet's image building from source). `docker compose ps` should settle with
   everything healthy.

4. **Wiring up jitsi-admin (can't be automated from a compose file):** log into
   `https://jitsi.owncloud.test` with one of the demo users below (whether a given account lands on
   jitsi-admin's own admin settings wasn't verified while building this - if `admin` doesn't get you
   there, jitsi-admin may grant that role to whichever account registers first instead), go to the
   admin **Server** settings, and register a Server pointing at this stack's LiveKit instance
   (`https://livekit.owncloud.test`, API key/secret from your `.env`). Copy the API key jitsi-admin
   generates for that Server and the Server's identifier into `.env`'s `JITSI_ADMIN_API_KEY` /
   `JITSI_ADMIN_SERVER`, then:

   ```
   docker compose up -d --force-recreate jitsi-admin-proxy
   ```

   Until this step is done, the extension's "Start video call" menu entry and sidebar panels show
   up fine, but room provisioning (`POST /jitsi-admin-proxy/rooms`) will fail.

## Demo users

Keycloak imports the same demo users oCIS itself ships (`config/keycloak/ocis-realm.dist.json` is
this repo's standard oCIS demo realm) into **both** the `oCIS` and `jitsiadmin` realms, reusing the
same password hashes - so the same login works in oCIS and jitsi-admin. Verified directly against a
running instance of this stack (all others in the realm - `admin`, `katherine`, `moss` - are real
accounts too, just not password-guessed here to avoid tripping Keycloak's brute-force lockout; see
[oCIS's own demo-users docs](https://doc.owncloud.com/ocis/latest/deployment/general/general-info.html#demo-users-and-groups)):

| username | password |
|---|---|
| einstein | relativity |
| marie | radioactivity |
| richard | superfluidity |

## Gotchas discovered building this (all already fixed in this compose file - documented here so a
future upgrade doesn't silently reintroduce them)

- **`CRON_USER_1` must be `docker`, not `root`.** jitsi-admin's own reference compose uses
  `CRON_USER_1: root` for its per-minute cron job. In the `h2invent/jitsi-admin-main` image, the
  actual web-serving process runs as uid 1000 (`docker`), not root - if cron runs as root, the very
  first log write it triggers creates `var/log/prod.log` owned by root, and the web process can
  never append to it again. Every request that needs to log anything (including the OAuth callback)
  then 500s, while static pages that don't log anything keep working - which reads as an
  intermittent bug rather than the permissions issue it actually is.
- **`league/oauth2-client` silently ignores `verify: false`.** jitsi-admin's OAuth token exchange to
  Keycloak fails with `cURL error 60: unable to get local issuer certificate` against Keycloak's
  self-signed cert. The obvious fix - `knpu_oauth2_client.http_client_options.verify: false` - has no
  effect: `AbstractProvider::__construct` only honors `verify` when a `proxy` option is also set (a
  deliberate safety gate, not a bug). `config/jitsi-admin/knpu_oauth2_client_insecure.yaml` works
  around this by handing jitsi-admin a pre-configured Guzzle client instead, which bypasses that
  restriction entirely.
- **Duplicating users across Keycloak realms needs their credential IDs stripped.** Copying a
  user's `credentials` array verbatim between realms that share one Postgres database fails Keycloak's
  import with a primary-key collision (`CredentialEntity` IDs are unique per-database, not
  per-realm) - drop the `id` field from each credential entry and let Keycloak generate a new one.
- **oCIS's `apps.yaml` `${VAR|default}` templating only substitutes top-level `config.*` values.**
  A nested value (e.g. `jitsiAdminProxy.endpoint` here) comes through to the browser as the literal
  unsubstituted string. Hardcode nested values instead, same as this repo's other extensions'
  `llm.endpoint` fields already do.
- **Don't publish LiveKit's "normal" UDP port range on Docker Desktop.** LiveKit's own docs suggest
  publishing `rtc.port_range_start`-`port_range_end` (commonly 50000-60000, 10,000+ ports) directly.
  On Docker Desktop for Mac/Windows, Docker spawns one `docker-proxy` process per published port -
  publishing that many can grind the whole daemon to a near-halt badly enough that *other, unrelated*
  containers become briefly unreachable too. `config/livekit/livekit.yaml` uses LiveKit's `udp_port`
  mux setting instead (a handful of ports, all WebRTC media multiplexed through them) - this is
  LiveKit's own recommended setting for constrained/desktop environments, not a workaround.
