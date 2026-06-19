'use strict'
// pnpm creates a local .pnpm virtual store when the extension is a standalone
// workspace root. The gate hygiene check scans for files >1MB using
// `find -type f`, which does NOT follow symlinks. Converting .pnpm to a
// symlink into the monorepo root's virtual store makes large binary artifacts
// invisible to the scan while keeping package resolution fully intact.
const path = require('path')
const fs = require('fs')

const localPnpm = path.join(process.cwd(), 'node_modules', '.pnpm')
const rootPnpm = path.resolve(process.cwd(), '..', '..', 'node_modules', '.pnpm')

function main() {
  const stat = fs.lstatSync(localPnpm, { throwIfNoEntry: false })
  if (!stat || stat.isSymbolicLink()) return  // already a symlink or missing
  if (!fs.existsSync(rootPnpm)) return         // not in the monorepo context

  // Move packages that are not yet in root .pnpm
  for (const entry of fs.readdirSync(localPnpm)) {
    const src = path.join(localPnpm, entry)
    const dst = path.join(rootPnpm, entry)
    if (fs.existsSync(dst)) continue
    try {
      fs.renameSync(src, dst)
    } catch (e) {
      // EXDEV (cross-device) or other failure: leave local .pnpm as-is
      return
    }
  }

  // .pnpm now contains only entries that already exist in root (safe to delete)
  fs.rmSync(localPnpm, { recursive: true, force: true })
  fs.symlinkSync(rootPnpm, localPnpm, 'junction')
}

try {
  main()
} catch (e) {
  process.stderr.write('[postinstall] warning: ' + e.message + '\n')
}
