# File Comments

Adds a **Comments** sidebar panel and context-menu action for files and folders
the current user can edit. Collaborators can add Markdown comments and authors
can edit or delete their own comments.

## Storage

Comments are custom WebDAV properties on the file or folder itself in the
`urn:owncloud:file-comments` namespace:

- `count` is a monotonic high-water allocator for sequence numbers; it only
  ever grows, so a deleted comment's slot is never reused.
- `index` is the comma-separated list of sequence numbers that are currently
  live. Reads use it to fetch only existing comments, and deletions drop an
  entry from it (leaving `count` untouched).
- `comment-000001`, `comment-000002`, ... store one Markdown document each.
- YAML front matter records the schema version, author and timestamps.

Keeping the live `index` separate from the all-time `count` means a file with a
long add/delete history neither bloats the read request nor locks out new
comments once the high-water mark is large; the number of *live* comments is
bounded instead.

oCIS persists arbitrary WebDAV properties in the resource's existing
MessagePack metadata. Because the metadata belongs to the stable resource node,
comments follow resource renames and moves. The extension never reads or writes an
internal `.mpk` file directly.

Writes use a short WebDAV `LOCK` (retried briefly on contention) around sequence
allocation and `PROPPATCH` to avoid collisions between collaborators.

## Permissions

The panel and action are only registered for files with update permission.
Read-only users therefore cannot view comments through the Web UI. oCIS does
not currently provide property-level read ACLs, so a read-only user who knows
the private namespace can still request these DAV properties directly. This UI
restriction must not be treated as a confidentiality boundary.

The server enforces write permission for `PROPPATCH`. Edit and delete controls
are shown only for the comment author, but author ownership is not yet enforced
server-side against direct DAV requests.

## Markdown Safety

Markdown is rendered with `marked` and sanitized with DOMPurify before it is
inserted into the page. Mentions, notifications and email are intentionally out
of scope for this first version.

## Extension Points

| ID | Type |
|----|------|
| `global.files.sidebar` | `sidebarPanel` - Comments tab for one writable file or folder |
| `global.files.context-actions` | `action` - opens the Comments tab |
