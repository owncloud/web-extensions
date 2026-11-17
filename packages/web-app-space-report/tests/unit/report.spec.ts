import { describe, it, expect, vi } from 'vitest'
import { formatBytes, formatPercent, summarize, toCsv, toRows } from '../../src/report'
import { fetchSpaces, GraphClient, userExists } from '../../src/api'
import { DriveFixture, spaces } from './spaces'

const GiB = 1024 ** 3

const drives: DriveFixture[] = [
  {
    id: 'p1',
    name: 'Alice',
    driveType: 'personal',
    owner: { user: { displayName: 'Alice A.' } },
    quota: { total: 10 * GiB, used: 9.5 * GiB, state: 'nearing' }
  },
  { id: 'p2', name: 'Bob', driveType: 'personal', quota: { total: 0, used: 1 * GiB } },
  { id: 'p2', name: 'Bob dup', driveType: 'personal', quota: { used: 5 } },
  {
    id: 's1',
    name: 'Projekt X',
    driveType: 'project',
    quota: { total: 100 * GiB, used: 120 * GiB, state: 'exceeded' },
    root: { deleted: { state: 'trashed' } }
  },
  { id: 'v1', name: 'Shares', driveType: 'virtual' },
  { id: 'm1', name: 'mount', driveType: 'mountpoint' }
]

describe('toRows / summarize', () => {
  const rows = toRows(spaces(drives))

  it('keeps only personal and project spaces, deduped', () => {
    expect(rows.map((r) => r.id)).toEqual(['p1', 'p2', 's1'])
    expect(rows[0].owner).toBe('Alice A.')
    expect(rows[1].quota).toBe(0)
    expect(rows[1].ratio).toBeNull()
    expect(rows[2].disabled).toBe(true)
  })

  it('aggregates per kind and in total', () => {
    const s = summarize(rows, 0.9)
    expect(s.byKind.personal.count).toBe(2)
    expect(s.byKind.personal.unlimited).toBe(1)
    expect(s.byKind.project.disabled).toBe(1)
    expect(s.total.count).toBe(3)
    expect(s.total.used).toBe((9.5 + 1 + 120) * GiB)
    expect(s.total.quotaAssigned).toBe((10 + 100) * GiB)
    expect(s.total.overThreshold).toBe(2)
    expect(s.total.exceeded).toBe(1)
    expect(s.largest[0].id).toBe('s1')
    expect(s.fullest.map((r) => r.id)).toEqual(['s1', 'p1'])
  })
})

describe('formatting', () => {
  it('formats bytes and percent', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(9.5 * GiB)).toBe('9.5 GB')
    expect(formatPercent(null)).toBe('–')
    expect(formatPercent(0.95)).toBe('95 %')
    expect(formatPercent(0.012)).toBe('1.2 %')
  })

  it('writes CSV with quoting and formula neutralisation', () => {
    const csv = toCsv(
      toRows(
        spaces([{ id: 'x', name: '=HYPERLINK("evil")', driveType: 'project', quota: { used: 1 } }])
      )
    )
    const [header, line] = csv.trim().split('\r\n')
    expect(header).toContain('"used_bytes"')
    expect(line).toContain(`"'=HYPERLINK(""evil"")"`)
  })
})

describe('api', () => {
  it('lists all spaces of a type through web-client', async () => {
    const listAllDrives = vi.fn().mockResolvedValue(spaces([drives[0]]))
    const graph = { drives: { listAllDrives } } as unknown as GraphClient
    const signal = new AbortController().signal
    const res = await fetchSpaces(graph, {}, 'personal', signal)
    expect(res).toHaveLength(1)
    expect(listAllDrives).toHaveBeenCalledWith(
      {},
      { filter: 'driveType eq personal', orderBy: 'name asc' },
      { signal }
    )
  })

  it('treats only a 404 as "user does not exist"', async () => {
    const httpError = (status: number) => Object.assign(new Error(), { response: { status } })
    const getUser = vi.fn()
    const graph = { users: { getUser } } as unknown as GraphClient

    getUser.mockResolvedValueOnce({ id: 'a' })
    expect(await userExists(graph, 'a')).toBe(true)
    getUser.mockRejectedValueOnce(httpError(404))
    expect(await userExists(graph, 'b')).toBe(false)
    getUser.mockRejectedValueOnce(httpError(500))
    await expect(userExists(graph, 'c')).rejects.toThrow()
  })
})
