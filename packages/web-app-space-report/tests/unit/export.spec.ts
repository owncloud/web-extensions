import { describe, it, expect } from 'vitest'
import { buildMarkdown, reportFileName, ReportData } from '../../src/export'
import { summarize, toRows } from '../../src/report'
import { spaces } from './spaces'

const GiB = 1024 ** 3
const rows = toRows(
  spaces([
    {
      id: 'p1',
      name: 'Jürgen | Müller',
      driveType: 'personal',
      owner: { user: { displayName: 'Jürgen Müller' } },
      quota: { total: 10 * GiB, used: 9.5 * GiB }
    },
    { id: 'p2', name: 'Bob', driveType: 'personal', quota: { used: 1 * GiB } },
    {
      id: 's1',
      name: 'Projekt – X',
      driveType: 'project',
      quota: { total: 100 * GiB, used: 20 * GiB },
      lastModifiedDateTime: '2026-09-30T10:00:00Z'
    }
  ])
)

const data = (over: Partial<ReportData['meta']> = {}): ReportData => ({
  meta: {
    server: 'cloud.example.org',
    generatedAt: new Date('2026-10-04T17:00:00Z'),
    generatedBy: 'Sami',
    thresholdPercent: 90,
    complete: true,
    ...over
  },
  summary: summarize(rows, 0.9),
  rows
})

describe('buildMarkdown', () => {
  it('contains overview, top lists and all spaces, with escaped pipes', () => {
    const md = buildMarkdown(data())
    expect(md).toContain('# Space report – cloud.example.org')
    expect(md).toContain('| Personal | 2 | 10.5 GB | 10.0 GB (+1 unlimited) |')
    expect(md).toContain('| Total | 3 | 30.5 GB | 110.0 GB |')
    expect(md).toContain('| Spaces >= 90 % full | 1 |')
    expect(md).toContain('Jürgen \\| Müller')
    expect(md).toContain('## All spaces (3)')
  })

  it('states what is missing', () => {
    const md = buildMarkdown(data({ complete: false }))
    expect(md).toContain("> Other users' personal spaces were not visible")
  })

  it('builds a file name per server and day', () => {
    expect(reportFileName(data().meta)).toBe('space-report-cloud.example.org-2026-10-04.md')
  })
})

describe('orphans in exports', () => {
  it('adds key figures and the orphan table when the check ran', () => {
    const orphaned = rows.map((r) =>
      r.id === 'p2' ? { ...r, orphan: 'owner-missing' as const } : { ...r, orphan: null }
    )
    const md = buildMarkdown({ ...data({ orphans: 'ok' }), rows: orphaned })
    expect(md).toContain('| Orphaned spaces | 1 |')
    expect(md).toContain('| Storage in orphaned spaces | 1.0 GB |')
    expect(md).toContain('## Orphaned spaces (1)')
    expect(md).toContain('| Personal | Bob | Owner no longer exists | 1.0 GB | - |')
    expect(md).toContain('Bob [orphaned]')
  })

  it('says why the check is missing otherwise', () => {
    expect(buildMarkdown(data({ orphans: 'skipped' }))).toContain(
      '> Orphaned spaces were not checked (requires the Admin role).'
    )
    expect(buildMarkdown(data({ orphans: 'skipped' }))).not.toContain('## Orphaned spaces')
  })
})
