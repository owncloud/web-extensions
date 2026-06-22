# Group Management

[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

An ownCloud Infinite Scale (oCIS) full-app extension for managing groups and their members from
a single, focused screen. It registers an app-menu entry ("Group Management") and a route, and
talks exclusively to the public LibreGraph API through the oCIS web client.

The view is a two-pane layout: a searchable list of groups on the left, and a detail panel on the
right showing the selected group's members with controls to add and remove them.

## Features

- List groups (server-side search by name)
- Create a group
- Rename a group
- Delete a group (with confirmation)
- View a group's members
- Add users to a group via a searchable user picker (server-side user search)
- Remove a user from a group (with confirmation)
- Read-only groups (`groupTypes: ["ReadOnly"]`) are clearly marked and their mutate actions are disabled
- Success and failure feedback through the standard oCIS message toasts
- Bulk member adds report per-user success/failure (one network call per user, settled independently)

## Scope: what oCIS supports

This extension is deliberately scoped to what the oCIS / LibreGraph backend actually models for
groups. Two capabilities that a "complete" MS-Graph-style group manager might expect are **not**
available in oCIS and are therefore intentionally absent here:

- **Nested groups.** A group's members are always users (`Group.members` is `User[]`). LibreGraph
  has no group-in-group relationship and the web client's `addMember` only accepts a user
  reference, so there is no group tree, no parent/child groups, and no circular-dependency
  handling — none of it would have anything to call.
- **Group description.** oCIS groups expose only `id`, `displayName` and `groupTypes`. The
  MS-Graph `description` field is not persisted by the backend, so the create/edit form does not
  offer it.

If oCIS gains these capabilities, the extension can be extended to match.

## How it works

- Built with `defineWebApplication` from `@ownclouders/web-pkg`; registers an `appMenuItem`
  extension and a route rendering `GroupsView.vue`.
- All group/member operations go through `clientService.graphAuthenticated.groups` / `.users`.
- Dialogs use the imperative oCIS modal service (`useModals().dispatchModal`): simple
  confirmations for delete/remove, and custom-component modals (`GroupFormModal`,
  `AddMembersModal`) for forms.
- The group list is a lightweight projection; selecting a group fetches the full group
  (with members) on demand.

## Development

```bash
# from the monorepo root
pnpm --filter ./packages/web-app-group-management build      # production build -> dist/group-management.js
pnpm --filter ./packages/web-app-group-management test:unit  # unit tests (Vitest)
pnpm --filter ./packages/web-app-group-management check:types
```

To run it in the local dev stack, build it and bring up the root `docker-compose.yml` (the app's
`dist` is mounted at `/web/apps/group-management`), then open the "Group Management" entry from the
application switcher.
