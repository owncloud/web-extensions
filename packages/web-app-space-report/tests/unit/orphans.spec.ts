import { describe, it, expect, vi } from 'vitest'
import { analyzeOrphans, summarizeOrphans } from '../../src/orphans'
import { GraphDrive, MANAGER_ROLES, toRows } from '../../src/report'

const MANAGER = MANAGER_ROLES[0]
const EDITOR = '58c63c02-1d89-4572-916a-870abc5a1b7d'
const GiB = 1024 ** 3

const perm = (type: 'user' | 'group', id: string, role = EDITOR) => ({
  roles: [role],
  grantedToV2: { [type]: { id } }
})

const drives: GraphDrive[] = [
  // personal: owner exists / deleted / deleted-but-listing-truncated / disabled
  { id: 'p-ok', name: 'Alice', driveType: 'personal', owner: { user: { id: 'alice' } } },
  {
    id: 'p-gone',
    name: 'Bob',
    driveType: 'personal',
    owner: { user: { id: 'bob' } },
    quota: { used: 5 * GiB }
  },
  { id: 'p-trunc', name: 'Carol', driveType: 'personal', owner: { user: { id: 'carol' } } },
  { id: 'p-dis', name: 'Dave', driveType: 'personal', owner: { user: { id: 'dave' } } },
  // projects
  { id: 's-none', name: 'Empty', driveType: 'project', quota: { used: 2 * GiB } },
  {
    id: 's-gone',
    name: 'Ghost',
    driveType: 'project',
    root: { permissions: [perm('user', 'bob', MANAGER), perm('group', 'deleted-group')] }
  },
  {
    id: 's-emptygroup',
    name: 'Hollow',
    driveType: 'project',
    root: { permissions: [perm('group', 'empty-group', MANAGER)] }
  },
  {
    id: 's-ok',
    name: 'Fine',
    driveType: 'project',
    root: { permissions: [perm('user', 'alice', MANAGER)] }
  },
  {
    id: 's-nomgr',
    name: 'Headless',
    driveType: 'project',
    root: { permissions: [perm('user', 'bob', MANAGER), perm('group', 'staff')] }
  },
  {
    id: 's-unverified',
    name: 'Unknown',
    driveType: 'project',
    root: { permissions: [perm('user', 'flaky', MANAGER)] }
  }
]

const users = [{ id: 'alice' }, { id: 'dave', accountEnabled: false }] // carol missing: truncated list
const groups = [
  { id: 'staff', memberCount: 12 },
  { id: 'empty-group', memberCount: 0 }
]
const existing = new Set(['carol'])

const lookups = {
  userExists: vi.fn((id: string) =>
    id === 'flaky' ? Promise.reject(new Error('HTTP 500')) : Promise.resolve(existing.has(id))
  ),
  groupExists: vi.fn(() => Promise.resolve(false))
}

describe('analyzeOrphans', () => {
  it('classifies every case and only trusts confirmed lookups', async () => {
    const { rows, unverified } = await analyzeOrphans({
      rows: toRows(drives),
      users,
      groups,
      lookups
    })
    const by = Object.fromEntries(rows.map((r) => [r.id, r]))

    expect(by['p-ok'].orphan).toBeNull()
    expect(by['p-gone'].orphan).toBe('owner-missing')
    expect(by['p-trunc'].orphan).toBeNull() // not in list, but direct lookup says it exists
    expect(by['p-dis'].orphan).toBeNull()
    expect(by['p-dis'].ownerDisabled).toBe(true)

    expect(by['s-none'].orphan).toBe('no-members')
    expect(by['s-gone'].orphan).toBe('members-gone')
    expect(by['s-emptygroup'].orphan).toBe('members-gone')
    expect(by['s-ok'].orphan).toBeNull()
    expect(by['s-ok'].noManager).toBe(false)
    expect(by['s-nomgr'].orphan).toBeNull()
    expect(by['s-nomgr'].noManager).toBe(true)
    expect(by['s-unverified'].orphan).toBeNull()
    expect(by['s-unverified'].noManager).toBe(false)
    expect(unverified).toBe(1)

    // every unknown id is looked up exactly once
    expect(lookups.userExists.mock.calls.map((c: any[]) => c[0]).sort()).toEqual([
      'bob',
      'carol',
      'flaky'
    ])
    expect((lookups.groupExists.mock.calls as any[][]).map((c) => c[0])).toEqual(['deleted-group'])

    const s = summarizeOrphans(rows)
    expect(s).toMatchObject({
      personalOwnerMissing: 1,
      projectNoMembers: 1,
      projectMembersGone: 2,
      total: 4,
      used: 7 * GiB,
      ownerDisabled: 1,
      noManager: 1
    })
  })

  it('never marks group-based projects orphaned without a group listing', async () => {
    const rows = toRows([
      { id: 's', driveType: 'project', root: { permissions: [perm('group', 'x')] } }
    ])
    const res = await analyzeOrphans({ rows, users: [], groups: null, lookups })
    expect(res.rows[0].orphan).toBeNull()
  })

  it('caps lookups and reports the rest as unverified', async () => {
    const many = toRows(
      Array.from({ length: 5 }, (_, i) => ({
        id: `p${i}`,
        driveType: 'personal',
        owner: { user: { id: `u${i}` } }
      }))
    )
    const res = await analyzeOrphans({
      rows: many,
      users: [],
      groups: [],
      lookups: {
        userExists: () => Promise.resolve(false),
        groupExists: () => Promise.resolve(false)
      },
      maxLookups: 2
    })
    expect(res.rows.filter((r) => r.orphan).length).toBe(2)
    expect(res.unverified).toBe(3)
  })
})
