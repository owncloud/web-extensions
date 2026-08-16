import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type http from 'node:http'

import {
  sanitizeRoomRequest,
  checkRateLimit,
  rateLimitWindows,
  isOriginAllowed,
  handleRequest
} from '../../src/index.js'

// ---------------------------------------------------------------------------
// sanitizeRoomRequest
// ---------------------------------------------------------------------------

describe('sanitizeRoomRequest', () => {
  it('returns an error when roomName is missing', () => {
    const result = sanitizeRoomRequest({ participants: [] }, 50)
    expect('error' in result).toBe(true)
  })

  it('returns an error when roomName is blank after trimming', () => {
    const result = sanitizeRoomRequest({ roomName: '   ', participants: [] }, 50)
    expect('error' in result).toBe(true)
  })

  it('returns an error when participants is not an array', () => {
    const result = sanitizeRoomRequest({ roomName: 'Team Sync', participants: 'nope' }, 50)
    expect('error' in result).toBe(true)
  })

  it('returns an error when participants exceeds the configured limit', () => {
    const participants = Array.from({ length: 3 }, (_, i) => ({ email: `u${i}@example.test` }))
    const result = sanitizeRoomRequest({ roomName: 'Team Sync', participants }, 2)
    expect('error' in result).toBe(true)
  })

  it('splits valid and invalid participants', () => {
    const result = sanitizeRoomRequest(
      {
        roomName: 'Team Sync',
        participants: [
          { email: 'valid@example.test', displayName: 'Valid User' },
          { email: 'not-an-email' },
          { email: '' },
          {}
        ]
      },
      50
    )
    expect('error' in result).toBe(false)
    if ('error' in result) return
    expect(result.roomName).toBe('Team Sync')
    expect(result.validParticipants).toEqual([
      { email: 'valid@example.test', displayName: 'Valid User' }
    ])
    expect(result.invalidParticipants).toHaveLength(3)
  })

  it('trims roomName', () => {
    const result = sanitizeRoomRequest({ roomName: '  Team Sync  ', participants: [] }, 50)
    if (!('error' in result)) expect(result.roomName).toBe('Team Sync')
  })
})

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------

describe('checkRateLimit', () => {
  beforeEach(() => {
    rateLimitWindows.clear()
  })

  it('allows requests under the per-minute limit', () => {
    expect(checkRateLimit('user-a', 3)).toBe(true)
    expect(checkRateLimit('user-a', 3)).toBe(true)
    expect(checkRateLimit('user-a', 3)).toBe(true)
  })

  it('blocks the request that would exceed the limit', () => {
    checkRateLimit('user-a', 3)
    checkRateLimit('user-a', 3)
    checkRateLimit('user-a', 3)
    expect(checkRateLimit('user-a', 3)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isOriginAllowed
// ---------------------------------------------------------------------------

describe('isOriginAllowed', () => {
  const expected = 'https://cloud.example.test'

  it('allows a request whose Origin matches the expected origin', () => {
    expect(isOriginAllowed('https://cloud.example.test', expected)).toBe(true)
  })

  it('rejects a request from a different origin', () => {
    expect(isOriginAllowed('https://evil.example.test', expected)).toBe(false)
  })

  it('allows a request with no Origin header (non-browser client, still token-gated)', () => {
    expect(isOriginAllowed(undefined, expected)).toBe(true)
  })

  it('does not enforce when no expected origin is configured', () => {
    expect(isOriginAllowed('https://anything.example.test', '')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// handleRequest — end to end, with jitsi-admin's API mocked
// ---------------------------------------------------------------------------

// No Origin header is set by default: isOriginAllowed only enforces a match
// when the request actually carries one, so a request with none is always
// origin-gate-agnostic — this keeps these tests independent of whatever
// OCIS_URL happens to be set in the process running them (e.g. CI sets a
// real one; ALLOWED_ORIGIN is derived from it at module-load time).
function makeMockReq(overrides: Partial<http.IncomingMessage> = {}): http.IncomingMessage {
  const req = new EventEmitter() as unknown as http.IncomingMessage
  Object.assign(req, {
    method: 'POST',
    url: '/rooms',
    headers: { authorization: 'Bearer test-token' },
    ...overrides
  })
  return req
}

function makeMockRes(): http.ServerResponse & {
  writeHead: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
} {
  const res = new EventEmitter() as unknown as http.ServerResponse & {
    writeHead: ReturnType<typeof vi.fn>
    end: ReturnType<typeof vi.fn>
  }
  Object.assign(res, {
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    setHeader: vi.fn(),
    writeHead: vi.fn(),
    write: vi.fn(),
    end: vi.fn(function end(this: typeof res) {
      this.writableEnded = true
    })
  })
  return res
}

function waitForListener(emitter: EventEmitter, event: string): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (emitter.listenerCount(event) > 0) {
        resolve()
      } else {
        setImmediate(check)
      }
    }
    check()
  })
}

async function sendRequest(
  req: http.IncomingMessage,
  res: ReturnType<typeof makeMockRes>,
  body: unknown
): Promise<void> {
  const pending = handleRequest(req, res)
  await waitForListener(req, 'data')
  req.emit('data', Buffer.from(JSON.stringify(body)))
  req.emit('end')
  await pending
}

function stubOidcAndJitsiAdmin({
  sub = 'user-1',
  email = 'caller@example.test',
  roomResponse = { ok: true, body: { uid: 'room-123' } },
  inviteOk = () => true
}: {
  sub?: string
  email?: string
  roomResponse?: { ok: boolean; status?: number; body?: unknown }
  inviteOk?: (email: string) => boolean
} = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('.well-known/openid-configuration')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ userinfo_endpoint: 'https://ocis.example.test/userinfo' })
        })
      }
      if (url.includes('/userinfo')) {
        return Promise.resolve({ ok: true, json: async () => ({ sub, email }) })
      }
      if (url.endsWith('/api/v1/room')) {
        return Promise.resolve({
          ok: roomResponse.ok,
          status: roomResponse.status ?? (roomResponse.ok ? 200 : 500),
          text: async () => JSON.stringify(roomResponse.body ?? {})
        })
      }
      if (url.endsWith('/api/v1/user')) {
        // crude: pull the email back out of the call by inspecting the last fetch args
        return Promise.resolve({ ok: true })
      }
      return Promise.reject(new Error(`unexpected fetch url: ${url}`))
    })
  )
  void inviteOk
}

describe('handleRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    rateLimitWindows.clear()
  })

  // Origin rejection itself is covered exhaustively by the isOriginAllowed
  // unit tests above; ALLOWED_ORIGIN is derived from OCIS_URL at module load
  // time (whatever the process running these tests happens to have set —
  // e.g. CI sets a real one), so it isn't exercised end-to-end here to avoid
  // coupling these tests to that ambient value.

  it('rejects a request with no Authorization header', async () => {
    stubOidcAndJitsiAdmin()
    const req = makeMockReq({ headers: {} })
    const res = makeMockRes()
    // No body is ever read on this path, so call handleRequest directly
    // rather than via sendRequest (which waits for the body-read listener).
    await handleRequest(req, res)
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.anything())
  })

  it('creates a room and reports invited/failed participants', async () => {
    stubOidcAndJitsiAdmin()
    const req = makeMockReq()
    const res = makeMockRes()
    await sendRequest(req, res, {
      roomName: 'Team Sync',
      participants: [{ email: 'a@example.test' }, { email: 'not-an-email' }]
    })
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything())
    const body = JSON.parse(res.end.mock.calls[0][0] as string)
    expect(body.roomCreated).toBe(true)
    expect(body.invited).toBe(1)
    expect(body.failed).toEqual([{ email: 'not-an-email', error: 'invalid or missing email' }])
  })

  it('returns an error status when jitsi-admin refuses to create the room', async () => {
    stubOidcAndJitsiAdmin({ roomResponse: { ok: false, status: 500, body: 'boom' } })
    const req = makeMockReq()
    const res = makeMockRes()
    await sendRequest(req, res, { roomName: 'Team Sync', participants: [] })
    expect(res.writeHead).toHaveBeenCalledWith(500, expect.anything())
  })

  it('returns an error when jitsi-admin does not return a recognizable room id', async () => {
    stubOidcAndJitsiAdmin({ roomResponse: { ok: true, body: { unexpected: 'shape' } } })
    const req = makeMockReq()
    const res = makeMockRes()
    await sendRequest(req, res, { roomName: 'Team Sync', participants: [] })
    expect(res.writeHead).toHaveBeenCalledWith(502, expect.anything())
  })
})
