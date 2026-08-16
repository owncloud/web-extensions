import type { Ref } from 'vue'
import { useClientService } from '@ownclouders/web-pkg'
import type { SpaceResource } from '@ownclouders/web-client'
import {
  useJitsiCall,
  type JitsiAdminProxyConfig,
  type ResolvedParticipant,
  type ResolvedParticipants,
  type UseJitsiCallResult
} from './useJitsiCall'

export type { JitsiAdminProxyConfig, UseJitsiCallResult }

/**
 * Only individual user grants can be resolved to an invitable email — group grants
 * would need expanding group membership, which is out of scope for this feature
 * (see README.md).
 */
export function useSpaceCall(
  proxyConfig: JitsiAdminProxyConfig | null,
  space: Ref<SpaceResource | null | undefined>
): UseJitsiCallResult {
  const clientService = useClientService()

  async function resolveParticipants(): Promise<ResolvedParticipants> {
    const currentSpace = space.value
    if (!currentSpace) {
      return { participants: [], totalCandidates: 0 }
    }

    const userIds = Object.values(currentSpace.members ?? {})
      .map((member) => member.grantedTo?.user?.id)
      .filter((id): id is string => typeof id === 'string')

    const users = await Promise.all(
      userIds.map((id) =>
        clientService.graphAuthenticated.users
          .getUser(id, { select: ['mail', 'displayName'] })
          .catch(() => null)
      )
    )

    const participants: ResolvedParticipant[] = users
      .filter((user): user is NonNullable<typeof user> => !!user?.mail)
      .map((user) => ({ email: user.mail as string, displayName: user.displayName }))

    return { participants, totalCandidates: Object.keys(currentSpace.members ?? {}).length }
  }

  return useJitsiCall(proxyConfig, () => space.value?.name, resolveParticipants)
}
