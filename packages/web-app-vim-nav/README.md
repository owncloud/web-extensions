# Vim Nav

[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](../../LICENSE)

A Vim-style keyboard navigation extension for ownCloud Infinite Scale.

## Features

- **Vim navigation**: `j`/`k` to move up and down the file list
- **Visual mode**: `v` to enter multi-select mode, extend selection with `j`/`k`/`G`/`gg`
- **Quick open**: `l` to open a file or navigate into a folder
- **Clipboard**: `y` copy, `x` cut, `p` paste
- **Delete**: `dd` to delete selected items
- **Download**: `dw` to download selected items
- **Duplicate**: `yy` to duplicate selected items
- **Create**: `nd` new folder, `nf` new plain file, `nm` new Markdown file, `ns` new space
- **Go to**: `gp` personal files, `gs` shared with me, `gd` trash, `go` projects/spaces
- **Trash**: `d` delete permanently, `r` restore, `e` empty trash bin
- **Search**: `/` to focus the search bar
- **Shortcuts help**: `?` to open a keyboard shortcuts reference dialog

## Keyboard Shortcuts

Press `?` at any time to open the full shortcuts reference dialog.

| Key | Action |
|-----|--------|
| `j` | Move down |
| `k` | Move up |
| `G` | Jump to last |
| `gg` | Jump to first |
| `l` | Open selected |
| `v` | Toggle visual (multi-select) mode |
| `y` | Copy |
| `x` | Cut |
| `p` | Paste |
| `dd` | Delete |
| `yy` | Duplicate |
| `dw` | Download |
| `nd` | New folder |
| `nf` | New plain file |
| `nm` | New Markdown file |
| `ns` | New space |
| `gp` | Go to personal files |
| `gs` | Go to shared with me |
| `gd` | Go to trash |
| `go` | Go to projects |
| `d` | Delete permanently (trash only) |
| `r` | Restore (trash only) |
| `e` | Empty trash bin (trash only) |
| `/` | Focus search |
| `?` | Show keyboard shortcuts |

## Installation

### From Release

1. Download the latest release ZIP from the [Releases page](https://github.com/owncloud/web-extensions/releases)
2. Extract to your oCIS web apps directory:
   ```bash
   unzip vim-nav-x.x.x.zip -d /path/to/ocis/apps/
   ```
3. Refresh your browser

### Using Docker

```yaml
services:
  vim-nav-init:
    image: owncloud/web-extensions:vim-nav-latest
    user: root
    volumes:
      - ocis-apps:/apps
    entrypoint:
      - /bin/sh
    command: ["-c", "cp -R /var/lib/nginx/html/vim-nav/ /apps"]
```

## Development

```bash
# Install dependencies
pnpm install

# Development build (watch mode)
pnpm build:w

# Production build
pnpm build

# Type check
pnpm check:types

# Run tests
pnpm test:unit
```

## License

Apache-2.0 - see [LICENSE](../../LICENSE) file for details.
