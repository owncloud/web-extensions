// Pure logic for the report: normalising spaces, aggregating, formatting, CSV.
import type { SpaceResource } from '@ownclouders/web-client'

export type SpaceKind = 'personal' | 'project'

export type QuotaState = 'normal' | 'nearing' | 'critical' | 'exceeded' | 'unknown'

export interface Member {
  type: 'user' | 'group'
  id: string
  manager: boolean
}

export type OrphanReason = 'owner-missing' | 'no-members' | 'members-gone'

/** "Manager" unified role (and the legacy v1 name) */
export const MANAGER_ROLES = ['312c0871-5ef7-4b3a-85b6-0e4074c64049', 'manager']

export interface SpaceRow {
  id: string
  kind: SpaceKind
  name: string
  owner: string
  used: number
  /** 0 = unlimited / not set */
  quota: number
  /** used / quota, null if unlimited */
  ratio: number | null
  state: QuotaState
  disabled: boolean
  lastModified: string | null
  ownerId: string
  members: Member[]
  /** set by the orphan analysis */
  orphan?: OrphanReason | null
  ownerDisabled?: boolean
  noManager?: boolean
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

const toState = (s: unknown): QuotaState =>
  s === 'normal' || s === 'nearing' || s === 'critical' || s === 'exceeded' ? s : 'unknown'

/** Space as built by web-client (graph.drives.listAllDrives) -> report row */
export function toRow(space: SpaceResource): SpaceRow | null {
  const type = space.driveType
  if (type !== 'personal' && type !== 'project') return null // skip virtual/mountpoint (shares)
  const used = num(space.spaceQuota?.used)
  const quota = num(space.spaceQuota?.total)
  return {
    id: space.id || '',
    kind: type,
    name: space.name || space.driveAlias || space.id || '?',
    owner: type === 'personal' ? space.owner?.displayName || space.name || '' : '',
    used,
    quota,
    ratio: quota ? used / quota : null,
    state: toState(space.spaceQuota?.state),
    disabled: !!space.disabled,
    lastModified: space.mdate || null,
    ownerId: space.owner?.id || '',
    // web-client keys the members by user/group id (from drive.root.permissions)
    members: Object.entries(space.members || {}).map(([id, m]): Member => ({
      type: m.grantedTo?.group ? 'group' : 'user',
      id,
      manager: MANAGER_ROLES.includes(m.roleId)
    }))
  }
}

export function toRows(spaces: SpaceResource[] | null | undefined): SpaceRow[] {
  const seen = new Set<string>()
  const rows: SpaceRow[] = []
  for (const space of spaces || []) {
    const row = toRow(space)
    if (!row || (row.id && seen.has(row.id))) continue
    if (row.id) seen.add(row.id)
    rows.push(row)
  }
  return rows
}

export interface KindSummary {
  count: number
  disabled: number
  used: number
  /** sum of quotas of spaces that have one */
  quotaAssigned: number
  unlimited: number
  overThreshold: number
  exceeded: number
}

export interface Summary {
  byKind: Record<SpaceKind, KindSummary>
  total: KindSummary
  largest: SpaceRow[]
  fullest: SpaceRow[]
}

const emptyKind = (): KindSummary => ({
  count: 0,
  disabled: 0,
  used: 0,
  quotaAssigned: 0,
  unlimited: 0,
  overThreshold: 0,
  exceeded: 0
})

/** threshold: ratio from which a space counts as "almost full" (default 0.9) */
export function summarize(rows: SpaceRow[], threshold = 0.9, topN = 10): Summary {
  const byKind = {
    personal: emptyKind(),
    project: emptyKind()
  } as Record<SpaceKind, KindSummary>
  const total = emptyKind()

  for (const r of rows) {
    for (const k of [byKind[r.kind], total]) {
      k.count++
      if (r.disabled) k.disabled++
      k.used += r.used
      if (r.quota) k.quotaAssigned += r.quota
      else k.unlimited++
      if (r.ratio !== null && r.ratio >= threshold) k.overThreshold++
      if (r.state === 'exceeded' || (r.ratio !== null && r.ratio >= 1)) k.exceeded++
    }
  }

  const largest = [...rows].sort((a, b) => b.used - a.used).slice(0, topN)
  const fullest = rows
    .filter((r) => r.ratio !== null)
    .sort((a, b) => (b.ratio as number) - (a.ratio as number))
    .slice(0, topN)

  return { byKind, total, largest, fullest }
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

/** Binary units (what storage admins compare with df/du), shown with the familiar names. */
export function formatBytes(bytes: number, digits = 1): string {
  if (!bytes) return '0 B'
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : digits)} ${UNITS[i]}`
}

export function formatPercent(ratio: number | null): string {
  return ratio === null ? '–' : `${(ratio * 100).toFixed(ratio < 0.1 ? 1 : 0)} %`
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  // quote always; neutralise spreadsheet formula injection
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

export function toCsv(rows: SpaceRow[]): string {
  const header = [
    'type',
    'name',
    'owner',
    'used_bytes',
    'quota_bytes',
    'used_percent',
    'quota_state',
    'disabled',
    'orphaned',
    'owner_disabled',
    'no_manager',
    'last_modified',
    'id'
  ]
  const lines = rows.map((r) =>
    [
      r.kind,
      r.name,
      r.owner,
      r.used,
      r.quota || '',
      r.ratio === null ? '' : (r.ratio * 100).toFixed(2),
      r.state,
      r.disabled ? 'yes' : 'no',
      r.orphan || '',
      r.ownerDisabled ? 'yes' : '',
      r.noManager ? 'yes' : '',
      r.lastModified || '',
      r.id
    ]
      .map(csvCell)
      .join(',')
  )
  return [header.map(csvCell).join(','), ...lines].join('\r\n') + '\r\n'
}
