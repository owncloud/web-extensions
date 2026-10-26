import { GraphDrive } from './report'

export type VaultStatus = 'ok' | 'disabled' | 'mfa-required' | 'error'

export class GraphError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly mfaRequired = false
  ) {
    super(message)
    this.name = 'GraphError'
  }
}

/**
 * Lists all spaces of one type via /graph/v1beta1/drives (the "all drives" endpoint Admin Settings
 * uses). Vault spaces live behind the /vault prefix and need an MFA-level token.
 */
export async function fetchDrives({
  serverUrl,
  accessToken,
  driveType,
  vault = false,
  signal
}: {
  serverUrl: string
  accessToken: string
  driveType: 'personal' | 'project'
  vault?: boolean
  signal?: AbortSignal
}): Promise<GraphDrive[]> {
  const base = serverUrl.replace(/\/+$/, '') + (vault ? '/vault' : '')
  const query = new URLSearchParams({ $filter: `driveType eq ${driveType}`, $orderby: 'name asc' })
  const res = await fetch(`${base}/graph/v1beta1/drives?${query}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    credentials: 'omit',
    signal
  })
  if (!res.ok) {
    const mfa = res.headers.has('x-ocis-mfa-required')
    throw new GraphError(
      res.status,
      `Listing ${vault ? 'vault ' : ''}${driveType} spaces failed: HTTP ${res.status}`,
      mfa
    )
  }
  const body = await res.json().catch(() => null)
  // oCIS answers `null` when there are no spaces at all
  return Array.isArray(body?.value) ? body.value : []
}

// ---- directory (users / groups), for the orphan analysis -------------------------------------

function graphGet(serverUrl: string, accessToken: string, path: string, signal?: AbortSignal) {
  return fetch(`${serverUrl.replace(/\/+$/, '')}/graph/v1.0/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    credentials: 'omit',
    signal
  })
}

export async function fetchUsers(serverUrl: string, accessToken: string, signal?: AbortSignal) {
  const res = await graphGet(serverUrl, accessToken, 'users', signal)
  if (!res.ok) throw new GraphError(res.status, `Listing users failed: HTTP ${res.status}`)
  const body = await res.json().catch(() => null)
  const value: Array<{ id?: string; accountEnabled?: boolean }> = Array.isArray(body?.value)
    ? body.value
    : []
  return value
    .filter((u) => typeof u.id === 'string' && u.id)
    .map((u) => ({ id: u.id as string, accountEnabled: u.accountEnabled }))
}

export async function fetchGroups(serverUrl: string, accessToken: string, signal?: AbortSignal) {
  const res = await graphGet(serverUrl, accessToken, 'groups?$expand=members', signal)
  if (!res.ok) throw new GraphError(res.status, `Listing groups failed: HTTP ${res.status}`)
  const body = await res.json().catch(() => null)
  const value: Array<{ id?: string; members?: unknown[] }> = Array.isArray(body?.value)
    ? body.value
    : []
  return value
    .filter((g) => typeof g.id === 'string' && g.id)
    .map((g) => ({
      id: g.id as string,
      memberCount: Array.isArray(g.members) ? g.members.length : undefined
    }))
}

/** true/false for exists/404; throws on anything else so the caller can mark it unverified */
export async function exists(
  serverUrl: string,
  accessToken: string,
  kind: 'users' | 'groups',
  id: string,
  signal?: AbortSignal
): Promise<boolean> {
  const res = await graphGet(serverUrl, accessToken, `${kind}/${encodeURIComponent(id)}`, signal)
  if (res.ok) return true
  if (res.status === 404) return false
  throw new GraphError(res.status, `Looking up ${kind} ${id} failed: HTTP ${res.status}`)
}
