// Saving a report into the user's personal space via Web's own WebDAV client.
import type { SpaceResource } from '@ownclouders/web-client'

/** Subset of clientService.webdav used here (keeps this module testable). */
export interface WebDavSubset {
  createFolder(
    space: SpaceResource,
    opts: { path: string; fetchFolder?: boolean }
  ): Promise<unknown>
  putFileContents(
    space: SpaceResource,
    opts: { path: string; content: string | ArrayBuffer; overwrite?: boolean }
  ): Promise<unknown>
}

export const normalizeFolder = (folder: string) =>
  folder
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p && p !== '.' && p !== '..')
    .join('/')

/** "space-report-host-2026-10-04.pdf" -> "space-report-host-2026-10-04-1907.pdf" (saves never overwrite) */
export const withTime = (fileName: string, d: Date) => {
  const hhmm = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
  return fileName.replace(/(\.[^.]+)$/, `-${hhmm}$1`)
}

const isStatus = (e: unknown, code: number) => (e as { statusCode?: number })?.statusCode === code

/**
 * Creates the target folder (each level; existing ones answer 405) and uploads the file.
 * If the name is taken, appends " (2)", " (3)", ... instead of overwriting.
 * Returns the path inside the space.
 */
export async function saveToSpace({
  webdav,
  space,
  folder,
  fileName,
  content
}: {
  webdav: WebDavSubset
  space: SpaceResource
  folder: string
  fileName: string
  content: string | ArrayBuffer
}): Promise<string> {
  const dir = normalizeFolder(folder)
  let current = ''
  for (const part of dir ? dir.split('/') : []) {
    current += `/${part}`
    try {
      await webdav.createFolder(space, { path: current, fetchFolder: false })
    } catch (e) {
      if (!isStatus(e, 405)) throw e // 405 = already exists
    }
  }

  const dot = fileName.lastIndexOf('.')
  const base = dot > 0 ? fileName.slice(0, dot) : fileName
  const ext = dot > 0 ? fileName.slice(dot) : ''
  for (let n = 1; n <= 20; n++) {
    const name = n === 1 ? fileName : `${base} (${n})${ext}`
    const path = `${current}/${name}`
    try {
      await webdav.putFileContents(space, { path, content, overwrite: false })
      return path
    } catch (e) {
      // overwrite: false -> oCIS answers 412 when the file exists
      if (!isStatus(e, 412)) throw e
    }
  }
  throw new Error('Could not find a free file name')
}
