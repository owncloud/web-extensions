import { ref, type Ref } from 'vue'
import { useAuthStore, useClientService } from '@ownclouders/web-pkg'
import type { SpaceResource } from '@ownclouders/web-client'
import { useGettext } from 'vue3-gettext'

export interface JitsiAdminProxyConfig {
  endpoint: string
}

export type SpaceCallStatus = 'unconfigured' | 'ready'

export interface InviteFailure {
  email: string
  error: string
}

export interface SpaceCallResult {
  invited: number
  /** Members with a group grant, or no resolvable email — not invited automatically. */
  skipped: number
  failed: InviteFailure[]
}

export interface UseSpaceCallResult {
  status: Ref<SpaceCallStatus>
  isCalling: Ref<boolean>
  callResult: Ref<SpaceCallResult | null>
  panelError: Ref<string | null>
  triggerCall: () => Promise<void>
}

interface ResolvedParticipant {
  email: string
  displayName?: string
}

export function useSpaceCall(
  proxyConfig: JitsiAdminProxyConfig | null,
  space: Ref<SpaceResource | null | undefined>
): UseSpaceCallResult {
  const { $gettext } = useGettext()
  const authStore = useAuthStore()
  const clientService = useClientService()

  const status = ref<SpaceCallStatus>(proxyConfig ? 'ready' : 'unconfigured')
  const isCalling = ref(false)
  const callResult = ref<SpaceCallResult | null>(null)
  const panelError = ref<string | null>(null)

  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = authStore.accessToken
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  /**
   * Only individual user grants can be resolved to an invitable email —
   * group grants would need expanding group membership, which is out of
   * scope for this feature (see README.md).
   */
  async function resolveParticipants(currentSpace: SpaceResource): Promise<ResolvedParticipant[]> {
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

    return users
      .filter((user): user is NonNullable<typeof user> => !!user?.mail)
      .map((user) => ({ email: user.mail as string, displayName: user.displayName }))
  }

  async function triggerCall(): Promise<void> {
    if (status.value === 'unconfigured' || !proxyConfig) {
      return
    }
    const currentSpace = space.value
    if (!currentSpace) {
      return
    }

    isCalling.value = true
    panelError.value = null
    callResult.value = null

    try {
      const totalMembers = Object.keys(currentSpace.members ?? {}).length
      const participants = await resolveParticipants(currentSpace)

      const res = await fetch(proxyConfig.endpoint, {
        method: 'POST',
        headers: buildHeaders(),
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({ roomName: currentSpace.name, participants })
      })

      if (!res.ok) {
        throw new Error(String(res.status))
      }

      const data = (await res.json()) as { invited?: number; failed?: InviteFailure[] }
      callResult.value = {
        invited: data.invited ?? 0,
        skipped: totalMembers - participants.length,
        failed: Array.isArray(data.failed) ? data.failed : []
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        panelError.value = $gettext('The request timed out. Please try again.')
      } else if (err instanceof TypeError) {
        panelError.value = $gettext('Could not reach the call service. Please try again.')
      } else {
        panelError.value = $gettext('Something went wrong. Please try again.')
      }
    } finally {
      isCalling.value = false
    }
  }

  return { status, isCalling, callResult, panelError, triggerCall }
}
