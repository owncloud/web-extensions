# web-app-favorites

Adds favorites for files, folders, project spaces, and received shares in ownCloud Web.

## What it does

- Adds a `Favorites` control in the file details right sidebar.
- Adds a left navigation entry `Favorites` that opens `/files/favorites`.
- Supports add/remove favorite from both sidebar and favorites view.

## Storage model

- Favorites are stored in the personal space hidden folder `/.favorites`.
- Each favorite is stored as one `.url` file.
- File content format:

```ini
[InternetShortcut]
URL=<internal-link>
```

## Local development

From repository root:

```bash
pnpm install
pnpm --filter web-app-favorites build
pnpm --filter web-app-favorites test:unit
```

## Assumptions and link mapping

- Internal links are generated as `/files/<driveAliasAndItem>` with `?fileId=<id>` for files when an id is available.
- Mapping inputs:
  - file/folder: `driveAlias + path`
  - project space root: `driveAlias + /`
  - received share: `driveAlias + path` (as provided by the selected resource object)
- Sidebar placement below `Tags` is implemented by assigning panel id/order metadata intended to follow tags in the sidebar panel ordering.
