import { describe, it, expect, vi } from 'vitest'
import { normalizeFolder, saveToSpace, withTime } from '../../src/save'

const space = { id: 'personal' } as any
const err = (statusCode: number) => Object.assign(new Error(`HTTP ${statusCode}`), { statusCode })

describe('helpers', () => {
  it('normalizes folders and blocks traversal', () => {
    expect(normalizeFolder(' /Reports//2026/ ')).toBe('Reports/2026')
    expect(normalizeFolder('../../x')).toBe('x')
    expect(normalizeFolder('')).toBe('')
  })
  it('adds the time before the extension', () => {
    expect(withTime('space-report-a-2026-10-04.pdf', new Date(2026, 9, 4, 9, 5))).toBe(
      'space-report-a-2026-10-04-0905.pdf'
    )
  })
})

describe('saveToSpace', () => {
  it('creates each folder level (ignoring existing ones) and uploads without overwrite', async () => {
    const webdav = {
      createFolder: vi.fn().mockRejectedValueOnce(err(405)).mockResolvedValue(undefined),
      putFileContents: vi.fn().mockResolvedValue(undefined)
    }
    const path = await saveToSpace({
      webdav,
      space,
      folder: 'Reports/Spaces',
      fileName: 'r.pdf',
      content: 'x'
    })
    expect(path).toBe('/Reports/Spaces/r.pdf')
    expect(webdav.createFolder.mock.calls.map((c) => c[1].path)).toEqual([
      '/Reports',
      '/Reports/Spaces'
    ])
    expect(webdav.putFileContents).toHaveBeenCalledWith(space, {
      path: '/Reports/Spaces/r.pdf',
      content: 'x',
      overwrite: false
    })
  })

  it('picks a new name when the file exists (412)', async () => {
    const webdav = {
      createFolder: vi.fn().mockResolvedValue(undefined),
      putFileContents: vi.fn().mockRejectedValueOnce(err(412)).mockResolvedValue(undefined)
    }
    expect(await saveToSpace({ webdav, space, folder: '', fileName: 'r.md', content: 'x' })).toBe(
      '/r (2).md'
    )
    expect(webdav.createFolder).not.toHaveBeenCalled()
  })

  it('surfaces other errors', async () => {
    const webdav = {
      createFolder: vi.fn().mockRejectedValue(err(403)),
      putFileContents: vi.fn()
    }
    await expect(
      saveToSpace({ webdav, space, folder: 'A', fileName: 'r.md', content: 'x' })
    ).rejects.toThrow('HTTP 403')
    expect(webdav.putFileContents).not.toHaveBeenCalled()
  })
})
