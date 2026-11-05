// Graph calls through Web's own client (clientService.graphAuthenticated): auth, base URL and
// response parsing are the same as in the rest of Web, e.g. Admin Settings.
import type { ShareRole, SpaceResource } from '@ownclouders/web-client'
import type { Graph } from '@ownclouders/web-client/graph'

export type GraphClient = Pick<Graph, 'drives' | 'users' | 'groups'>

/** Lists all spaces of one type (the "all drives" call Admin Settings uses). */
export function fetchSpaces(
  graph: GraphClient,
  graphRoles: Record<string, ShareRole>,
  driveType: 'personal' | 'project',
  signal?: AbortSignal
): Promise<SpaceResource[]> {
  return graph.drives.listAllDrives(
    graphRoles,
    { filter: `driveType eq ${driveType}`, orderBy: 'name asc' },
    { signal }
  )
}

// ---- directory (users / groups), for the orphan analysis -------------------------------------

export async function fetchUsers(graph: GraphClient, signal?: AbortSignal) {
  const users = await graph.users.listUsers({}, { signal })
  return (users || [])
    .filter((u) => typeof u.id === 'string' && u.id)
    .map((u) => ({ id: u.id as string, accountEnabled: u.accountEnabled }))
}

export async function fetchGroups(graph: GraphClient, signal?: AbortSignal) {
  const groups = await graph.groups.listGroups({ expand: ['members'] }, { signal })
  return (groups || [])
    .filter((g) => typeof g.id === 'string' && g.id)
    .map((g) => ({
      id: g.id as string,
      memberCount: Array.isArray(g.members) ? g.members.length : undefined
    }))
}

/** HTTP status of a failed web-client (axios) request */
const statusOf = (e: unknown) => (e as { response?: { status?: number } })?.response?.status

/** true/false for exists/404; throws on anything else so the caller can mark it unverified */
async function exists(lookup: () => Promise<unknown>): Promise<boolean> {
  try {
    await lookup()
    return true
  } catch (e) {
    if (statusOf(e) === 404) return false
    throw e
  }
}

// select/expand keep the lookups small; without them getUser expands the drive and roles
export const userExists = (graph: GraphClient, id: string, signal?: AbortSignal) =>
  exists(() => graph.users.getUser(id, { select: ['id'], expand: ['memberOf'] }, { signal }))

export const groupExists = (graph: GraphClient, id: string, signal?: AbortSignal) =>
  exists(() => graph.groups.getGroup(id, { select: ['id'] }, { signal }))
