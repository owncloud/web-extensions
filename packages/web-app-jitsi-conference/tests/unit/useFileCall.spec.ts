import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({ $gettext: (s: string) => s })
}))

vi.mock('@ownclouders/web-pkg', () => ({
  useAuthStore: vi.fn(),
  useClientService: vi.fn()
}))

import { useFileCall } from '../../src/composables/useFileCall'
import { useAuthStore, useClientService } from '@ownclouders/web-pkg'
import { ShareTypes } from '@ownclouders/web-client'

const PROXY_CONFIG = { endpoint: 'http://localhost:3000/jitsi-admin-proxy/rooms' }

function makeResource(overrides: Record<string, unknown> = {}) {
  return { id: 'item-1', storageId: 'drive-1', name: 'Q3 Report.docx', ...overrides } as any
}

let getUserMock: ReturnType<typeof vi.fn>
let listPermissionsMock: ReturnType<typeof vi.fn>

function setupClientServiceMock() {
  getUserMock = vi.fn()
  listPermissionsMock = vi.fn()
  vi.mocked(useClientService).mockReturnValue({
    graphAuthenticated: {
      users: { getUser: getUserMock },
      permissions: { listPermissions: listPermissionsMock }
    }
  } as any)
}

beforeEach(() => {
  vi.restoreAllMocks()
  setupClientServiceMock()
  vi.mocked(useAuthStore).mockReturnValue({ accessToken: 'bearer-token' } as any)
  vi.stubGlobal('fetch', vi.fn())
})

function makeFetchResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: async () => body })
}

const SHARE_TYPE_USER = ShareTypes.user.value
const SHARE_TYPE_GROUP = ShareTypes.group.value
const SHARE_TYPE_REMOTE = ShareTypes.remote.value

describe('useFileCall', () => {
  describe('when unconfigured', () => {
    it('returns immediately without calling fetch', async () => {
      const { status, triggerCall } = useFileCall(null, ref(makeResource()))
      expect(status.value).toBe('unconfigured')
      await triggerCall()
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('when configured', () => {
    it('resolves only direct user shares, skipping groups, remote/OCM shares, and users without mail', async () => {
      listPermissionsMock.mockResolvedValue({
        shares: [
          { shareType: SHARE_TYPE_USER, sharedWith: { id: 'user-1' } },
          { shareType: SHARE_TYPE_GROUP, sharedWith: { id: 'group-1' } },
          { shareType: SHARE_TYPE_REMOTE, sharedWith: { id: 'remote-user-1' } },
          { shareType: SHARE_TYPE_USER, sharedWith: { id: 'user-3' } }
        ]
      })

      getUserMock.mockImplementation((id: string) => {
        if (id === 'user-1') return Promise.resolve({ mail: 'one@example.test', displayName: 'One' })
        if (id === 'user-3') return Promise.resolve({ mail: undefined, displayName: 'Three' })
        return Promise.reject(new Error('unexpected id'))
      })

      vi.mocked(fetch).mockReturnValue(makeFetchResponse({ invited: 1, failed: [] }) as any)

      const { triggerCall, callResult } = useFileCall(PROXY_CONFIG, ref(makeResource()))
      await triggerCall()

      expect(listPermissionsMock).toHaveBeenCalledWith('drive-1', 'item-1')
      expect(getUserMock).toHaveBeenCalledTimes(2)
      expect(getUserMock).not.toHaveBeenCalledWith('group-1', expect.anything())
      expect(getUserMock).not.toHaveBeenCalledWith('remote-user-1', expect.anything())

      const [, init] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse((init as RequestInit).body as string)
      expect(body.roomName).toBe('Q3 Report.docx')
      expect(body.participants).toEqual([{ email: 'one@example.test', displayName: 'One' }])

      // 2 direct user shares found, only 1 resolved to an invitable email
      expect(callResult.value).toEqual({ invited: 1, skipped: 1, failed: [] })
    })

    it("sends the caller's access token as a bearer header", async () => {
      listPermissionsMock.mockResolvedValue({ shares: [] })
      vi.mocked(fetch).mockReturnValue(makeFetchResponse({ invited: 0, failed: [] }) as any)

      const { triggerCall } = useFileCall(PROXY_CONFIG, ref(makeResource()))
      await triggerCall()

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe(PROXY_CONFIG.endpoint)
      expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer bearer-token' })
    })

    it('sets panelError when the proxy responds with a non-ok status', async () => {
      listPermissionsMock.mockResolvedValue({ shares: [] })
      vi.mocked(fetch).mockReturnValue(makeFetchResponse({}, false, 500) as any)

      const { triggerCall, panelError, callResult } = useFileCall(PROXY_CONFIG, ref(makeResource()))
      await triggerCall()

      expect(panelError.value).toBeTruthy()
      expect(callResult.value).toBeNull()
    })

    it('sets panelError on a timeout', async () => {
      listPermissionsMock.mockResolvedValue({ shares: [] })
      vi.mocked(fetch).mockImplementation(() => {
        const err = new DOMException('timed out', 'TimeoutError')
        return Promise.reject(err)
      })

      const { triggerCall, panelError } = useFileCall(PROXY_CONFIG, ref(makeResource()))
      await triggerCall()

      expect(panelError.value).toBe('The request timed out. Please try again.')
    })

    it('does nothing when no resource is selected', async () => {
      const { triggerCall } = useFileCall(PROXY_CONFIG, ref(null))
      await triggerCall()
      expect(fetch).not.toHaveBeenCalled()
      expect(listPermissionsMock).not.toHaveBeenCalled()
    })
  })
})
