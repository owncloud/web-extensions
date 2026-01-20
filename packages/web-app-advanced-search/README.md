# web-app-advanced-search

An advanced search extension for ownCloud Infinite Scale with comprehensive filter support, including photo EXIF metadata search.

## Features

- **Advanced Filter Panel**: Filter by file name, type, size, date modified, media type, tags, and full-text content
- **Photo/EXIF Metadata Filters**: Search by camera make, camera model, date taken, ISO, aperture (f-number), and focal length
- **Visual Filter Chips**: Active filters displayed as removable chips for easy management
- **KQL Query Builder**: Direct KQL input with "Apply to Filters" to parse and populate filter fields
- **Multiple View Modes**: List, grid, and table views for search results
- **Saved Searches**: Save and load search queries for quick access
- **Search Statistics Panel**: View index status, space information, and server details

## Requirements

- oCIS v7.x or later
- For photo metadata search: oCIS with photo metadata indexing enabled (see [owncloud/ocis#11912](https://github.com/owncloud/ocis/pull/11912))

## Installation

### From Release

1. Download the latest release ZIP from the [Releases page](https://github.com/owncloud/web-extensions/releases)
2. Extract to your oCIS web apps directory:
   ```bash
   unzip advanced-search-x.x.x.zip -d /path/to/ocis/apps/
   ```
3. Refresh your browser

### Using Docker

Use the official Docker image:

```yaml
services:
  advanced-search-init:
    image: owncloud/web-extensions:advanced-search-latest
    user: root
    volumes:
      - ocis-apps:/apps
    entrypoint:
      - /bin/sh
    command: ["-c", "cp -R /var/lib/nginx/html/advanced-search/ /apps"]
```

## Usage

1. Access "Advanced Search" from the app switcher menu
2. Enter a search term or use the filter panel
3. Click the "Advanced" button to expand filter options
4. Apply filters and click "Search"
5. View results in list, grid, or table mode
6. Right-click items for context menu actions (download, open in files, copy link, delete)

### Photo Filter Examples

Search for photos taken with a specific camera:
- Camera Make: `Canon`
- Camera Model: `EOS R5`

Search for photos by date range:
- Date Taken: `2024-01-01` to `2024-12-31`

Search for photos with specific settings:
- ISO: `100` to `800`
- Aperture: `1.4` to `2.8`
- Focal Length: `24mm` to `70mm`

### KQL Query Examples

```
# Basic text search
name:vacation*

# Media type filter
mediatype:image/*

# Date range
photo.takendatetime>=2024-01-01 AND photo.takendatetime<=2024-12-31

# Camera filter
photo.cameramake:Canon AND photo.cameramodel:*R5*

# Combined query
photo.cameramake:Canon AND photo.takendatetime>=2024-01-01 AND mediatype:image/*
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

AGPL-3.0 - see [LICENSE](../../LICENSE) file for details.
