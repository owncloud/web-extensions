import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@ownclouders/web-pkg', () => ({
  useClientService: vi.fn()
}))

import { useClientService } from '@ownclouders/web-pkg'
import { useGroupManagement } from '../../src/composables/useGroupManagement'

const makeGraph = () => ({
  groups: {
    listGroups: vi.fn().mockResolvedValue([]),
    getGroup: vi.fn().mockResolvedValue({ id: 'g1', displayName: 'G1', members: [] }),
    createGroup: vi.fn().mockResolvedValue({ id: 'g-new', displayName: 'New' }),
    editGroup: vi.fn().mockResolvedValue(undefined),
    deleteGroup: vi.fn().mockResolvedValue(undefined),
    addMember: vi.fn().mockResolvedValue(undefined),
    deleteMember: vi.fn().mockResolvedValue(undefined)
  },
  users: {
    listUsers: vi.fn().mockResolvedValue([])
  }
})

let graph: ReturnType<typeof makeGraph>

beforeEach(() => {
  graph = makeGraph()
  vi.mocked(useClientService).mockReturnValue({ graphAuthenticated: graph } as any)
})

describe('useGroupManagement', () => {
  describe('listGroups', () => {
    it('requests groups ordered by name and expands members', async () => {
      await useGroupManagement().listGroups()
      expect(graph.groups.listGroups).toHaveBeenCalledWith({
        orderBy: ['displayName'],
        expand: ['members']
      })
    })

    it('passes a quoted search term when given', async () => {
      await useGroupManagement().listGroups('sales')
      expect(graph.groups.listGroups).toHaveBeenCalledWith({
        orderBy: ['displayName'],
        expand: ['members'],
        search: '"sales"'
      })
    })

    it('returns an empty array when the client yields nothing', async () => {
      graph.groups.listGroups.mockResolvedValueOnce(null)
      expect(await useGroupManagement().listGroups()).toEqual([])
    })
  })

  describe('group CRUD', () => {
    it('creates a group with display name only (oCIS groups have no description)', async () => {
      await useGroupManagement().createGroup('Marketing')
      expect(graph.groups.createGroup).toHaveBeenCalledWith({ displayName: 'Marketing' })
    })

    it('renames a group', async () => {
      await useGroupManagement().editGroup('g1', 'Renamed')
      expect(graph.groups.editGroup).toHaveBeenCalledWith('g1', { displayName: 'Renamed' })
    })

    it('deletes a group', async () => {
      await useGroupManagement().deleteGroup('g1')
      expect(graph.groups.deleteGroup).toHaveBeenCalledWith('g1')
    })
  })

  describe('addMembers', () => {
    it('skips users already in the group and reports success/failure per user', async () => {
      graph.groups.addMember
        .mockResolvedValueOnce(undefined) // u2 succeeds
        .mockRejectedValueOnce(new Error('boom')) // u3 fails

      const group = { id: 'g1', displayName: 'G1', members: [{ id: 'u1' }] } as any
      const result = await useGroupManagement().addMembers(group, ['u1', 'u2', 'u3'])

      // u1 is already a member -> skipped
      expect(graph.groups.addMember).toHaveBeenCalledTimes(2)
      expect(graph.groups.addMember).toHaveBeenCalledWith('g1', 'u2')
      expect(graph.groups.addMember).toHaveBeenCalledWith('g1', 'u3')
      expect(graph.groups.addMember).not.toHaveBeenCalledWith('g1', 'u1')

      expect(result.succeeded).toEqual(['u2'])
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].id).toBe('u3')
    })

    it('reports all as succeeded when none fail', async () => {
      const group = { id: 'g1', displayName: 'G1', members: [] } as any
      const result = await useGroupManagement().addMembers(group, ['u1', 'u2'])
      expect(result.succeeded).toEqual(['u1', 'u2'])
      expect(result.failed).toEqual([])
    })
  })

  describe('removeMember', () => {
    it('removes a user from a group', async () => {
      await useGroupManagement().removeMember('g1', 'u1')
      expect(graph.groups.deleteMember).toHaveBeenCalledWith('g1', 'u1')
    })
  })

  describe('searchUsers', () => {
    it('passes a quoted search term', async () => {
      await useGroupManagement().searchUsers('bob')
      expect(graph.users.listUsers).toHaveBeenCalledWith({
        orderBy: ['displayName'],
        search: '"bob"'
      })
    })
  })

  describe('helpers', () => {
    it('flags ReadOnly groups', () => {
      const { isReadOnly } = useGroupManagement()
      expect(isReadOnly({ id: 'g1', groupTypes: ['ReadOnly'] } as any)).toBe(true)
      expect(isReadOnly({ id: 'g2' } as any)).toBe(false)
    })

    it('counts members defensively', () => {
      const { memberCount } = useGroupManagement()
      expect(memberCount({ id: 'g1', members: [{ id: 'u1' }, { id: 'u2' }] } as any)).toBe(2)
      expect(memberCount({ id: 'g2' } as any)).toBe(0)
    })
  })
})
