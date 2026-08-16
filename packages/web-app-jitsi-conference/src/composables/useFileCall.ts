import type { Ref } from 'vue'
import { useClientService } from '@ownclouders/web-pkg'
import { ShareTypes, type Resource } from '@ownclouders/web-client'
import {
  useJitsiCall,
  type JitsiAdminProxyConfig,
  type ResolvedParticipant,
  type ResolvedParticipants,
  type UseJitsiCallResult
} from './useJitsiCall'

export type { JitsiAdminProxyConfig, UseJitsiCallResult }

/**
 * Only direct, same-instance individual-user shares (`ShareTypes.user`) are resolved to an
 * invitable email. Group shares, public links, guest shares, and federated/OCM shares
 * (`ShareTypes.remote`) are all skipped — expanding a group's membership or reaching a
 * federated recipient with no shared IdP is out of scope for this feature (see README.md).
 */
export function useFileCall(
  proxyConfig: JitsiAdminProxyConfig | null,
  resource: Ref<Resource | null | undefined>
): UseJitsiCallResult {
  const clientService = useClientService()

  async function resolveParticipants(): Promise<ResolvedParticipants> {
    const currentResource = resource.value
    if (!currentResource?.id || !currentResource?.storageId) {
      return { participants: [], totalCandidates: 0 }
    }

    const { shares } = await clientService.graphAuthenticated.permissions.listPermissions(
      currentResource.storageId,
      currentResource.id
    )

    const userIds = shares
      .filter((share) => share.shareType === ShareTypes.user.value)
      .map((share) => ('sharedWith' in share ? share.sharedWith?.id : undefined))
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

    return { participants, totalCandidates: userIds.length }
  }

  return useJitsiCall(proxyConfig, () => resource.value?.name, resolveParticipants)
}
