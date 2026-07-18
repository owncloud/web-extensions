# EPUB Library

[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](../../LICENSE)

An ownCloud Infinite Scale (oCIS) full-app extension for browsing EPUB files as a visual
bookshelf. It discovers books across all accessible spaces, reads metadata and cover images
directly from each EPUB, and opens books with ownCloud's built-in EPUB reader.

The extension does not upload book data to an external metadata service. EPUB contents,
metadata extraction, cover rendering, and library organization remain in the browser and
oCIS.

## Features

- Discover EPUB files across personal and project spaces
- Display embedded cover art, title, author, description, publisher, language, subjects, and
  publication date
- Search by title, author, publisher, or subject
- Sort by recently added, title, or author
- Filter by collection, author, subject, language, space, and reading status
- Organize books with favorites and custom shelves
- Mark books as Unread, Reading, or Finished
- Switch between grid and list layouts
- Continue from the exact position saved by ownCloud's EPUB reader
- Show approximate whole-book progress and automatically mark completed books as Finished
- Open the containing folder in Files, download the EPUB, or copy its private link
- Cache extracted metadata and cover images for faster subsequent loads
- Keyboard-accessible book cards, controls, filters, and details dialog

## Requirements

- ownCloud Infinite Scale with ownCloud Web
- The built-in `epub-reader` Web app enabled
- Browser support for IndexedDB and local storage

## Usage

1. Upload EPUB files through the standard Files app.
2. Open **EPUB Library** from the application switcher.
3. Select a cover to open the book immediately.
4. Select the information button on a book to view metadata, reading status, shelves, and file
   actions.
5. Use the Collection filter to view favorites or an individual shelf.

The library shows books from every accessible space. Book Details displays the space name and
full path so identical books stored in different spaces can be distinguished.

## How It Works

The app combines an oCIS WebDAV search with a recursive WebDAV scan. Search provides efficient
discovery for indexed books, while the scan makes newly uploaded EPUB files visible before
indexing completes. Results from both sources are deduplicated by file ID.

EPUB metadata and cover images are extracted client-side from the archive with ZIP.js. Extracted
metadata is cached in IndexedDB and invalidated when the file's ETag, modification date, or size
changes.

### Continue Reading

ownCloud's EPUB reader stores an exact EPUB CFI for each book in browser local storage. The
library uses the same resource-specific key to detect whether a book has been opened. Opening
the book delegates to the built-in reader, which restores that exact position.

The reader does not always calculate a usable whole-book percentage. When necessary, the
library estimates progress from the saved spine section, the page within that section, and the
number of sections in the EPUB. The displayed percentage is therefore approximate; the resume
position itself remains exact.

## Local Library Data

The following preferences are stored in browser local storage:

- Favorites
- Custom shelves and shelf membership
- Reading-status labels
- Grid or list layout preference

These preferences do not modify EPUB files and currently do not synchronize between browsers
or devices. Metadata and cover caches are stored separately in IndexedDB. Clearing site data
removes both the local preferences and cached metadata.

## Development

Run commands from the repository root:

```bash
# Install dependencies
pnpm install

# Production build
pnpm --filter web-app-epub-library build

# Type check
pnpm --filter web-app-epub-library check:types

# Lint
pnpm exec eslint 'packages/web-app-epub-library/**/*.{ts,vue}' --max-warnings=0

# Unit tests
pnpm --filter web-app-epub-library test:unit --watch=false
```

The root `docker-compose.yml` mounts the production bundle from
`packages/web-app-epub-library/dist` into the local Web extensions development stack.

## License

Apache-2.0 — see the repository [LICENSE](../../LICENSE) file for details.
