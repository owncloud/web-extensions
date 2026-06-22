import { useClientService } from '@ownclouders/web-pkg'
import { Group, User } from '@ownclouders/web-client/graph/generated'

export interface MemberMutationResult {
  succeeded: string[]
  failed: { id: string; reason: Error }[]
}

// Escape a user-supplied term for use inside an OData `$search` phrase (which is
// wrapped in double quotes). Without escaping, a typed `"` produces a malformed
// expression and the Graph API returns 400 -- which would otherwise surface to
// the user as an empty list / "no results" for a perfectly valid search.
const quoteSearchTerm = (term: string): string =>
  `"${term.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

/**
 * Thin, typed wrapper around the LibreGraph groups/users client.
 *
 * Note on scope: oCIS / LibreGraph models group membership strictly as
 * User -> memberOf -> Group (a group's `members` are always users). There is no
 * group-in-group relationship in the graph client, so this extension manages
 * user membership only and deliberately offers no "nested group" affordances.
 */
export function useGroupManagement() {
  const clientService = useClientService()
  const graph = () => clientService.graphAuthenticated

  const isReadOnly = (group: Group): boolean => !!group.groupTypes?.includes('ReadOnly')

  const memberCount = (group: Group): number => group.members?.length ?? 0

  const listGroups = (search = ''): Promise<Group[]> =>
    graph()
      .groups.listGroups({
        orderBy: ['displayName'],
        expand: ['members'],
        ...(search ? { search: quoteSearchTerm(search) } : {})
      })
      .then((groups) => groups ?? [])

  const getGroup = (id: string): Promise<Group> =>
    graph().groups.getGroup(id, { expand: ['members'] })

  // oCIS / LibreGraph groups expose only id, displayName and groupTypes. The
  // MS-Graph "description" field is not persisted by the backend, so it is
  // intentionally not part of the create/edit surface.
  const createGroup = (displayName: string): Promise<Group> =>
    graph().groups.createGroup({ displayName })

  const editGroup = (id: string, displayName: string): Promise<void> =>
    graph().groups.editGroup(id, { displayName })

  const deleteGroup = (id: string): Promise<void> => graph().groups.deleteGroup(id)

  /**
   * Add several users to a group, reporting per-user success/failure so the
   * caller can surface a combined toast (mirrors the admin-settings pattern).
   * Users already in the group are skipped.
   */
  const addMembers = async (group: Group, userIds: string[]): Promise<MemberMutationResult> => {
    // Build the dedup set from live server state rather than the snapshot taken
    // when the modal opened, so a user added concurrently by another admin is
    // not added again (which would surface as a spurious per-user failure).
    // Fall back to the snapshot if the refresh itself fails.
    let existing: Set<string>
    try {
      const fresh = await getGroup(group.id)
      existing = new Set((fresh.members ?? []).map((m) => m.id))
    } catch {
      existing = new Set((group.members ?? []).map((m) => m.id))
    }
    const toAdd = userIds.filter((id) => !existing.has(id))
    const results = await Promise.allSettled(
      toAdd.map((userId) => graph().groups.addMember(group.id, userId))
    )
    return toAdd.reduce<MemberMutationResult>(
      (acc, userId, index) => {
        const result = results[index]
        if (result.status === 'fulfilled') {
          acc.succeeded.push(userId)
        } else {
          acc.failed.push({ id: userId, reason: result.reason as Error })
        }
        return acc
      },
      { succeeded: [], failed: [] }
    )
  }

  const removeMember = (groupId: string, userId: string): Promise<void> =>
    graph().groups.deleteMember(groupId, userId)

  const searchUsers = (search = ''): Promise<User[]> =>
    graph()
      .users.listUsers({
        orderBy: ['displayName'],
        ...(search ? { search: quoteSearchTerm(search) } : {})
      })
      .then((users) => users ?? [])

  return {
    isReadOnly,
    memberCount,
    listGroups,
    getGroup,
    createGroup,
    editGroup,
    deleteGroup,
    addMembers,
    removeMember,
    searchUsers
  }
}
