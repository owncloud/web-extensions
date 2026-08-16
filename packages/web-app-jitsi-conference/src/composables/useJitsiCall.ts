import { ref, type Ref } from 'vue'
import { useAuthStore } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'

export interface JitsiAdminProxyConfig {
  endpoint: string
}

export type JitsiCallStatus = 'unconfigured' | 'ready'

export interface InviteFailure {
  email: string
  error: string
}

export interface JitsiCallResult {
  invited: number
  /** Candidates that couldn't be resolved to an invitable email — not invited automatically. */
  skipped: number
  failed: InviteFailure[]
}

export interface ResolvedParticipant {
  email: string
  displayName?: string
}

export interface ResolvedParticipants {
  participants: ResolvedParticipant[]
  /** Total number of grants/members considered, before filtering down to `participants`. */
  totalCandidates: number
}

export interface UseJitsiCallResult {
  status: Ref<JitsiCallStatus>
  isCalling: Ref<boolean>
  callResult: Ref<JitsiCallResult | null>
  panelError: Ref<string | null>
  triggerCall: () => Promise<void>
}

/**
 * Shared room-provisioning core behind the "Video call" sidebar panels (Space members,
 * file/folder share recipients). Callers supply how to name the room and how to resolve
 * the current selection down to invitable participants; this handles the proxy call,
 * loading/error state, and result reporting identically for both.
 */
export function useJitsiCall(
  proxyConfig: JitsiAdminProxyConfig | null,
  roomName: () => string | null | undefined,
  resolveParticipants: () => Promise<ResolvedParticipants>
): UseJitsiCallResult {
  const { $gettext } = useGettext()
  const authStore = useAuthStore()

  const status = ref<JitsiCallStatus>(proxyConfig ? 'ready' : 'unconfigured')
  const isCalling = ref(false)
  const callResult = ref<JitsiCallResult | null>(null)
  const panelError = ref<string | null>(null)

  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = authStore.accessToken
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  async function triggerCall(): Promise<void> {
    if (status.value === 'unconfigured' || !proxyConfig) {
      return
    }
    const name = roomName()
    if (!name) {
      return
    }

    isCalling.value = true
    panelError.value = null
    callResult.value = null

    try {
      const { participants, totalCandidates } = await resolveParticipants()

      const res = await fetch(proxyConfig.endpoint, {
        method: 'POST',
        headers: buildHeaders(),
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({ roomName: name, participants })
      })

      if (!res.ok) {
        throw new Error(String(res.status))
      }

      const data = (await res.json()) as { invited?: number; failed?: InviteFailure[] }
      callResult.value = {
        invited: data.invited ?? 0,
        skipped: totalCandidates - participants.length,
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
