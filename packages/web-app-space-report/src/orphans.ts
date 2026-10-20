// Orphaned spaces:
//  - personal space whose owner no longer exists in the user backend      -> 'owner-missing'
//  - project space without any member                                       -> 'no-members'
//  - project space whose members all point to deleted users/groups
//    or to groups without members                                           -> 'members-gone'
// Extra flags (not orphaned, but worth a look):
//  - ownerDisabled: personal space of a disabled account
//  - noManager:     project space with live members but no live manager
import { OrphanReason, SpaceRow } from './report'

export interface DirectoryUser {
  id: string
  accountEnabled?: boolean
}

export interface DirectoryGroup {
  id: string
  /** undefined: member list unknown (not expanded) */
  memberCount?: number
}

export interface Lookups {
  /** single lookup by id; resolves false only on 404 */
  userExists(id: string): Promise<boolean>
  groupExists(id: string): Promise<boolean>
}

export interface OrphanResult {
  rows: SpaceRow[]
  /** ids that could not be verified (lookup error or limit reached) — never counted as orphaned */
  unverified: number
}

export interface OrphanSummary {
  personalOwnerMissing: number
  projectNoMembers: number
  projectMembersGone: number
  total: number
  /** storage held by orphaned spaces */
  used: number
  ownerDisabled: number
  noManager: number
}

/** Runs fn over items with limited concurrency. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++])
  })
  await Promise.all(workers)
}

/**
 * The directory listings are only a first pass: oCIS reads users/groups without paging, so an
 * LDAP size limit can truncate them. Every id missing from a listing is confirmed with a direct
 * lookup before a space is reported as orphaned.
 */
export async function analyzeOrphans({
  rows,
  users,
  groups,
  lookups,
  maxLookups = 500,
  concurrency = 8
}: {
  rows: SpaceRow[]
  users: DirectoryUser[]
  groups: DirectoryGroup[] | null
  lookups: Lookups
  maxLookups?: number
  concurrency?: number
}): Promise<OrphanResult> {
  const userById = new Map(users.map((u) => [u.id, u]))
  const groupById = new Map((groups || []).map((g) => [g.id, g]))

  // ids not in the listings, to be confirmed one by one
  const unknownUsers = new Set<string>()
  const unknownGroups = new Set<string>()
  for (const r of rows) {
    if (r.kind.endsWith('personal')) {
      if (r.ownerId && !userById.has(r.ownerId)) unknownUsers.add(r.ownerId)
    } else {
      for (const m of r.members) {
        if (m.type === 'user' && !userById.has(m.id)) unknownUsers.add(m.id)
        if (m.type === 'group' && groups && !groupById.has(m.id)) unknownGroups.add(m.id)
      }
    }
  }

  // id -> true (exists) | false (gone) | undefined (not verified)
  const userState = new Map<string, boolean | undefined>()
  const groupState = new Map<string, boolean | undefined>()
  const jobs: Array<() => Promise<void>> = [
    ...[...unknownUsers].map((id) => async () => {
      userState.set(id, await lookups.userExists(id).catch(() => undefined))
    }),
    ...[...unknownGroups].map((id) => async () => {
      groupState.set(id, await lookups.groupExists(id).catch(() => undefined))
    })
  ]
  await pool(jobs.slice(0, maxLookups), concurrency, (job) => job())
  const unverified =
    Math.max(0, jobs.length - maxLookups) +
    [...userState.values(), ...groupState.values()].filter((v) => v === undefined).length

  const userAlive = (id: string): boolean | undefined =>
    userById.has(id) ? true : userState.get(id)
  const groupAlive = (id: string): boolean | undefined => {
    if (!groups) return undefined // group listing not available: can't judge
    const g = groupById.get(id)
    if (g) return g.memberCount === undefined ? true : g.memberCount > 0
    return groupState.get(id) // exists-but-unlisted counts as alive (member count unknown)
  }

  const out = rows.map((r): SpaceRow => {
    const row: SpaceRow = { ...r, orphan: null, ownerDisabled: false, noManager: false }
    if (r.kind.endsWith('personal')) {
      if (!r.ownerId) {
        row.orphan = 'owner-missing'
      } else {
        if (userAlive(r.ownerId) === false) row.orphan = 'owner-missing'
        row.ownerDisabled = userById.get(r.ownerId)?.accountEnabled === false
      }
      return row
    }

    if (!r.members.length) {
      row.orphan = 'no-members'
      return row
    }
    const states = r.members.map((m) => (m.type === 'user' ? userAlive(m.id) : groupAlive(m.id)))
    if (states.every((s) => s === false)) {
      row.orphan = 'members-gone'
    } else {
      // only flag a missing manager when we know the state of every manager grant
      const managers = r.members.map((m, i) => ({ m, s: states[i] })).filter(({ m }) => m.manager)
      row.noManager = managers.every(({ s }) => s === false)
    }
    return row
  })

  return { rows: out, unverified }
}

export function summarizeOrphans(rows: SpaceRow[]): OrphanSummary {
  const count = (reason: OrphanReason) => rows.filter((r) => r.orphan === reason).length
  const orphans = rows.filter((r) => r.orphan)
  return {
    personalOwnerMissing: count('owner-missing'),
    projectNoMembers: count('no-members'),
    projectMembersGone: count('members-gone'),
    total: orphans.length,
    used: orphans.reduce((a, r) => a + r.used, 0),
    ownerDisabled: rows.filter((r) => r.ownerDisabled).length,
    noManager: rows.filter((r) => r.noManager).length
  }
}

export const ORPHAN_LABEL: Record<OrphanReason, string> = {
  'owner-missing': 'Owner no longer exists',
  'no-members': 'No members',
  'members-gone': 'All members deleted/empty'
}
