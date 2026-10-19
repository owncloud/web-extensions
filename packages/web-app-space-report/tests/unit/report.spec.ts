import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatBytes, formatPercent, summarize, toCsv, toRows, GraphDrive } from '../../src/report'
import { fetchDrives, GraphError } from '../../src/api'

const GiB = 1024 ** 3

const drives: GraphDrive[] = [
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
  const rows = toRows(drives)

  it('keeps only personal and project spaces, deduped', () => {
    expect(rows.map((r) => r.id)).toEqual(['p1', 'p2', 's1'])
    expect(rows[0].owner).toBe('Alice A.')
    expect(rows[1].quota).toBe(0)
    expect(rows[1].ratio).toBeNull()
    expect(rows[2].disabled).toBe(true)
  })

  it('aggregates per kind and in total', () => {
    const s = summarize([...rows, ...toRows([drives[0]], true)], 0.9)
    expect(s.byKind.personal.count).toBe(2)
    expect(s.byKind.personal.unlimited).toBe(1)
    expect(s.byKind.project.disabled).toBe(1)
    expect(s.byKind['vault-personal'].count).toBe(1)
    expect(s.total.count).toBe(4)
    expect(s.total.used).toBe((9.5 + 1 + 120 + 9.5) * GiB)
    expect(s.total.quotaAssigned).toBe((10 + 100 + 10) * GiB)
    expect(s.total.overThreshold).toBe(3)
    expect(s.total.exceeded).toBe(1)
    expect(s.largest[0].id).toBe('s1')
    expect(s.fullest.map((r) => r.id)).toEqual(['s1', 'p1', 'p1'])
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
      toRows([{ id: 'x', name: '=HYPERLINK("evil")', driveType: 'project', quota: { used: 1 } }])
    )
    const [header, line] = csv.trim().split('\r\n')
    expect(header).toContain('"used_bytes"')
    expect(line).toContain(`"'=HYPERLINK(""evil"")"`)
  })
})

describe('fetchDrives', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('calls the all-drives endpoint with the filter and bearer token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ value: [drives[0]] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await fetchDrives({
      serverUrl: 'https://cloud.example.org/',
      accessToken: 'T',
      driveType: 'personal',
      vault: true
    })
    expect(res).toHaveLength(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'https://cloud.example.org/vault/graph/v1beta1/drives?%24filter=driveType+eq+personal&%24orderby=name+asc'
    )
    expect(init.headers.Authorization).toBe('Bearer T')
  })

  it('handles `null` bodies and flags MFA-required errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('null', { status: 200 })))
    expect(
      await fetchDrives({ serverUrl: 'https://c/', accessToken: 'T', driveType: 'project' })
    ).toEqual([])

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('', { status: 403, headers: { 'X-OCIS-MFA-Required': 'true' } })
        )
    )
    const err = await fetchDrives({
      serverUrl: 'https://c/',
      accessToken: 'T',
      driveType: 'project',
      vault: true
    }).catch((e) => e)
    expect(err).toBeInstanceOf(GraphError)
    expect(err.mfaRequired).toBe(true)
  })
})
