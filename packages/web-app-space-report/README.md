# Space Report

A status report of all spaces for admins, in the oCIS Web UI.

- **Counts**
  - personal spaces
  - project spaces, including how many are disabled
- **Storage**
  - total used and total quota assigned
  - spaces without a quota (unlimited)
  - average and median usage per personal space
- **Alerts**
  - spaces at or above a fill threshold (default 90 %)
  - spaces at or over their quota
- **Orphaned spaces** (Admin role only), with the storage they hold:
  - personal spaces whose owner no longer exists in the user backend (e.g. deleted in LDAP/Keycloak)
  - project spaces without any member
  - project spaces whose members are all deleted users, deleted groups or empty groups
  - also listed, but not counted as orphaned: projects without a manager, personal spaces of disabled accounts
- **Top lists**
  - largest spaces
  - fullest spaces, measured against their quota
- **Table** of every space: type, name, owner, used, quota, % full, last modified. It is sortable and searchable.
- **Exports**, generated in the browser:
  - **Markdown**: overview, key figures, top lists, orphaned spaces and the full space list as tables, e.g. for a wiki or ticket.
  - **CSV**: the rows currently shown in the table (respects filter/search).
  - **Print**: the page itself, laid out for paper. Use the browser's "Save as PDF" to get a PDF.
  - **Save to my files**: stores the Markdown report in your personal space, in the folder `Space reports` (configurable, created if missing). File names carry date and time; existing files are never overwritten.

  Markdown always covers all spaces, regardless of the table filter.

Tested against oCIS Web **12.5.0** (oCIS 8.x).

## Access

- **Who sees it:** users with the `Drives.List.all` permission. It appears in the app switcher as **Space report**.
- **Personal spaces of other users:** oCIS only lists them for accounts with full user-management permission, i.e. the Admin role. For other roles, the page shows a hint that the numbers are incomplete.
- **MFA:** if MFA is enabled, opening the page requires it, the same as Admin Settings.
- **Vault spaces** are not part of the report. They are served under a separate `/vault` route, which Web's Graph client does not address.

## Data source

All calls go through Web's Graph client (`clientService.graphAuthenticated` from `@ownclouders/web-client`) and are read-only. Spaces come from the "all drives" endpoint, the same one Admin Settings uses:

```
GET /graph/v1beta1/drives?$filter=driveType eq personal
GET /graph/v1beta1/drives?$filter=driveType eq project
```

- The orphan check additionally reads `GET /graph/v1.0/users` and `GET /graph/v1.0/groups?$expand=members`. oCIS reads these without paging, so an LDAP size limit can cut the lists short. Every owner or member missing from a list is therefore confirmed with a direct lookup (`/users/{id}`, `/groups/{id}`). Only a 404 counts as "gone"; lookup errors are reported as "not verified" and never counted as orphaned. At most 500 lookups per run (8 in parallel).
- Usage and quota come from `quota.used` and `quota.total` of each space, as reported by oCIS.
- These are space quotas, not raw bytes on the storage backend. Trash and versions count only as far as oCIS includes them in `quota.used`.
- Every refresh is a live query. Nothing is stored unless you use "Save to my files".

## Configuration

Optional, in `apps.yaml` (key = app folder name, `space-report`):

```yaml
space-report:
  config:
    thresholdPercent: 90 # "almost full" from this fill level
    topN: 10 # entries in the top lists
    saveFolder: Space reports # folder in the personal space for "Save to my files" ("" = root)
```

No CSP changes are needed: the extension only calls oCIS itself.

## Deployment

- **Docker / ocis_full:** use the image `owncloud/web-extensions:space-report-<version>` like the other extensions.
- **Kubernetes (oCIS Helm chart):** copy the app into the web pod's `apps` volume with an init container:

```yaml
services:
  web:
    config:
      externalApps:
        space-report:
          config:
            thresholdPercent: 90
    additionalInitContainers:
      - name: space-report
        image: owncloud/web-extensions:space-report-0.1.0
        command: ['cp', '-R', '/var/lib/nginx/html/space-report/', '/apps']
        volumeMounts:
          - name: apps
            mountPath: /apps
```

## Development

```bash
pnpm install
pnpm --filter space-report build:w      # watch build
docker compose up -d                     # repo root; https://host.docker.internal:9200, admin/admin
pnpm --filter space-report test:unit
pnpm --filter space-report test:e2e
pnpm --filter space-report check:types
```

To get a real orphan locally, delete a user directly in oCIS' built-in LDAP (IDM) rather than in Admin Settings, because deleting through oCIS also removes the personal space.

| File                       | Purpose                                   |
| -------------------------- | ----------------------------------------- |
| `src/report.ts`            | Normalising, aggregation, formatting, CSV |
| `src/orphans.ts`           | Orphan analysis                           |
| `src/export.ts`            | Report content model + Markdown           |
| `src/save.ts`              | Saving into the personal space (WebDAV)   |
| `src/api.ts`               | Graph calls via web-client                |
| `src/views/ReportView.vue` | The page                                  |
