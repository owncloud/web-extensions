import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({ $gettext: (s: string) => s })
}))

vi.mock('@ownclouders/web-pkg', () => ({
  useAuthStore: vi.fn(),
  useClientService: vi.fn()
}))

import { useSpaceCall } from '../../src/composables/useSpaceCall'
import { useAuthStore, useClientService } from '@ownclouders/web-pkg'

const PROXY_CONFIG = { endpoint: 'http://localhost:3000/jitsi-admin-proxy/rooms' }

function makeSpace(members: Record<string, unknown> = {}) {
  return { name: 'Marketing', members } as any
}

let getUserMock: ReturnType<typeof vi.fn>

function setupClientServiceMock() {
  getUserMock = vi.fn()
  vi.mocked(useClientService).mockReturnValue({
    graphAuthenticated: { users: { getUser: getUserMock } }
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

describe('useSpaceCall', () => {
  describe('when unconfigured', () => {
    it('returns immediately without calling fetch', async () => {
      const { status, triggerCall } = useSpaceCall(null, ref(makeSpace()))
      expect(status.value).toBe('unconfigured')
      await triggerCall()
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('when configured', () => {
    it('resolves only individual user grants to emails, skipping group grants and users without mail', async () => {
      const space = makeSpace({
        '1': { grantedTo: { user: { id: 'user-1' } } },
        '2': { grantedTo: { group: { id: 'group-1' } } },
        '3': { grantedTo: { user: { id: 'user-3' } } }
      })

      getUserMock.mockImplementation((id: string) => {
        if (id === 'user-1') return Promise.resolve({ mail: 'one@example.test', displayName: 'One' })
        if (id === 'user-3') return Promise.resolve({ mail: undefined, displayName: 'Three' })
        return Promise.reject(new Error('unexpected id'))
      })

      vi.mocked(fetch).mockReturnValue(
        makeFetchResponse({ invited: 1, failed: [] }) as any
      )

      const { triggerCall, callResult } = useSpaceCall(PROXY_CONFIG, ref(space))
      await triggerCall()

      expect(getUserMock).toHaveBeenCalledTimes(2)
      expect(getUserMock).not.toHaveBeenCalledWith('group-1', expect.anything())

      const [, init] = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse((init as RequestInit).body as string)
      expect(body.roomName).toBe('Marketing')
      expect(body.participants).toEqual([{ email: 'one@example.test', displayName: 'One' }])

      // 3 total members, only 1 resolved to an invitable email
      expect(callResult.value).toEqual({ invited: 1, skipped: 2, failed: [] })
    })

    it('sends the caller\'s access token as a bearer header', async () => {
      const space = makeSpace({})
      vi.mocked(fetch).mockReturnValue(makeFetchResponse({ invited: 0, failed: [] }) as any)

      const { triggerCall } = useSpaceCall(PROXY_CONFIG, ref(space))
      await triggerCall()

      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe(PROXY_CONFIG.endpoint)
      expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer bearer-token' })
    })

    it('sets panelError when the proxy responds with a non-ok status', async () => {
      const space = makeSpace({})
      vi.mocked(fetch).mockReturnValue(makeFetchResponse({}, false, 500) as any)

      const { triggerCall, panelError, callResult } = useSpaceCall(PROXY_CONFIG, ref(space))
      await triggerCall()

      expect(panelError.value).toBeTruthy()
      expect(callResult.value).toBeNull()
    })

    it('sets panelError on a timeout', async () => {
      const space = makeSpace({})
      vi.mocked(fetch).mockImplementation(() => {
        const err = new DOMException('timed out', 'TimeoutError')
        return Promise.reject(err)
      })

      const { triggerCall, panelError } = useSpaceCall(PROXY_CONFIG, ref(space))
      await triggerCall()

      expect(panelError.value).toBe('The request timed out. Please try again.')
    })

    it('does nothing when no space is selected', async () => {
      const { triggerCall } = useSpaceCall(PROXY_CONFIG, ref(null))
      await triggerCall()
      expect(fetch).not.toHaveBeenCalled()
    })
  })
})
