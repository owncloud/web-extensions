import http from 'node:http'

// ---------------------------------------------------------------------------
// Config (all values come from environment variables)
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? '3031', 10)
const OCIS_URL = (process.env.OCIS_URL ?? '').replace(/\/$/, '')
const JITSI_ADMIN_URL = (process.env.JITSI_ADMIN_URL ?? '').replace(/\/$/, '')
const JITSI_ADMIN_API_KEY = process.env.JITSI_ADMIN_API_KEY ?? ''
/** Identifies which jitsi-admin `Server` (registered Jitsi/LiveKit backend) new rooms are created on. */
const JITSI_ADMIN_SERVER = process.env.JITSI_ADMIN_SERVER ?? ''
const ROOM_DURATION_MINUTES = parseInt(process.env.ROOM_DURATION_MINUTES ?? '60', 10)
const MAX_PARTICIPANTS = parseInt(process.env.MAX_PARTICIPANTS ?? '50', 10)
const MAX_BODY_BYTES = parseInt(process.env.MAX_BODY_BYTES ?? '65536', 10)
const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM ?? '10', 10)
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS ?? '15000', 10)

/**
 * Origin (scheme://host:port) permitted to call the proxy, derived from
 * OCIS_URL. Empty when OCIS_URL is unset or unparseable, in which case the
 * origin gate cannot be enforced (the server refuses to start without
 * OCIS_URL outside tests, so this only matters in unit tests).
 */
const ALLOWED_ORIGIN = (() => {
  if (!OCIS_URL) return ''
  try {
    return new URL(OCIS_URL).origin
  } catch {
    return ''
  }
})()

// ---------------------------------------------------------------------------
// OIDC discovery — lazily fetched on first request, userinfo_endpoint cached
// ---------------------------------------------------------------------------

let userinfoEndpoint: string | null = null

async function resolveUserinfoEndpoint(): Promise<string> {
  if (userinfoEndpoint) return userinfoEndpoint
  const discoveryUrl = `${OCIS_URL}/.well-known/openid-configuration`
  const res = await fetch(discoveryUrl)
  if (!res.ok) {
    throw new Error(`OIDC discovery failed: ${res.status} ${res.statusText}`)
  }
  const doc = (await res.json()) as { userinfo_endpoint?: string }
  if (!doc.userinfo_endpoint) {
    throw new Error('OIDC discovery document missing userinfo_endpoint')
  }
  userinfoEndpoint = doc.userinfo_endpoint
  console.log(`[jitsi-admin-proxy] userinfo_endpoint: ${userinfoEndpoint}`)
  return userinfoEndpoint
}

// ---------------------------------------------------------------------------
// Token validation — returns the caller's `sub`/`email` claims, or null
// ---------------------------------------------------------------------------

export interface OcisIdentity {
  sub: string
  email?: string
}

export async function validateOcisToken(authorizationHeader: string): Promise<OcisIdentity | null> {
  const endpoint = await resolveUserinfoEndpoint()
  const res = await fetch(endpoint, {
    headers: { Authorization: authorizationHeader }
  })
  if (!res.ok) return null
  const info = (await res.json()) as { sub?: string; email?: string }
  if (typeof info.sub !== 'string') return null
  return { sub: info.sub, email: typeof info.email === 'string' ? info.email : undefined }
}

// ---------------------------------------------------------------------------
// Per-user sliding-window rate limiter
// ---------------------------------------------------------------------------

/** Exported so tests can reset state between runs. */
export const rateLimitWindows = new Map<string, number[]>()

/**
 * Returns true when the request is within the allowed rate, false when the
 * user has exceeded `rpm` requests in the last 60 seconds.
 */
export function checkRateLimit(sub: string, rpm = RATE_LIMIT_RPM): boolean {
  const now = Date.now()
  const timestamps = (rateLimitWindows.get(sub) ?? []).filter((t) => now - t < 60_000)
  if (timestamps.length >= rpm) return false
  timestamps.push(now)
  rateLimitWindows.set(sub, timestamps)
  return true
}

// ---------------------------------------------------------------------------
// Body helpers
// ---------------------------------------------------------------------------

export class BodyTooLargeError extends Error {}

export function readBody(req: http.IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalBytes = 0
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length
      if (totalBytes > maxBytes) {
        reject(new BodyTooLargeError('Request body too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// Request body sanitization
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface RawParticipant {
  email?: unknown
  displayName?: unknown
}

interface RawRoomRequest {
  roomName?: unknown
  participants?: unknown
  [key: string]: unknown
}

export interface SanitizedParticipant {
  email: string
  displayName?: string
}

export interface SanitizedRoomRequest {
  roomName: string
  validParticipants: SanitizedParticipant[]
  invalidParticipants: Array<{ input: unknown; error: string }>
}

/**
 * Validates and sanitizes the client JSON body. Never rejects the whole
 * request over a handful of bad participant entries — those are reported
 * back per-entry in `invalidParticipants` so the caller can surface which
 * members couldn't be resolved to an email, while still creating the room
 * and inviting everyone who is valid.
 */
export function sanitizeRoomRequest(
  raw: RawRoomRequest,
  maxParticipants: number
): SanitizedRoomRequest | { error: string } {
  const roomName = typeof raw.roomName === 'string' ? raw.roomName.trim() : ''
  if (!roomName) return { error: 'roomName is required' }
  if (roomName.length > 200) return { error: 'roomName is too long' }

  if (!Array.isArray(raw.participants)) return { error: 'participants must be an array' }
  if (raw.participants.length > maxParticipants) {
    return { error: `participants exceeds the limit of ${maxParticipants}` }
  }

  const validParticipants: SanitizedParticipant[] = []
  const invalidParticipants: Array<{ input: unknown; error: string }> = []

  for (const entry of raw.participants as RawParticipant[]) {
    const email = typeof entry?.email === 'string' ? entry.email.trim() : ''
    if (!email || !EMAIL_RE.test(email)) {
      invalidParticipants.push({ input: entry, error: 'invalid or missing email' })
      continue
    }
    const displayName = typeof entry?.displayName === 'string' ? entry.displayName : undefined
    validParticipants.push({ email, displayName })
  }

  return { roomName, validParticipants, invalidParticipants }
}

// ---------------------------------------------------------------------------
// jitsi-admin API calls
//
// Field names below (`name`/`email`/`server`/`start`/`duration` on room
// creation, `room`/`email` on invites) are a best-effort reconstruction from
// reading H2-invent/jitsi-admin's Symfony controllers (see ARCHAEOLOGY.md
// §1.1) — not verified against a live instance. Confirm against your
// jitsi-admin version's actual API contract before relying on this in
// production; adjust here if it doesn't match.
// ---------------------------------------------------------------------------

export type CreateRoomResult =
  | { ok: true; roomId: string }
  | { ok: false; status: number; error: string }

export async function createJitsiAdminRoom(
  roomName: string,
  ownerEmail: string | undefined,
  signal: AbortSignal
): Promise<CreateRoomResult> {
  let res: Response
  try {
    res = await fetch(`${JITSI_ADMIN_URL}/api/v1/room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${JITSI_ADMIN_API_KEY}`
      },
      body: JSON.stringify({
        name: roomName,
        email: ownerEmail ?? '',
        server: JITSI_ADMIN_SERVER,
        start: new Date().toISOString(),
        duration: ROOM_DURATION_MINUTES
      }),
      signal
    })
  } catch (err) {
    return { ok: false, status: 502, error: err instanceof Error ? err.message : 'network error' }
  }

  const bodyText = await res.text()
  if (!res.ok) {
    return { ok: false, status: res.status, error: bodyText || res.statusText }
  }

  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(bodyText) as Record<string, unknown>
  } catch {
    // fall through with an empty object; handled by the missing-roomId branch below
  }

  const roomId = [parsed.uid, parsed.id, parsed.room, parsed.roomId].find(
    (v) => typeof v === 'string'
  ) as string | undefined

  if (!roomId) {
    return {
      ok: false,
      status: 502,
      error: 'jitsi-admin did not return a recognizable room identifier'
    }
  }

  return { ok: true, roomId }
}

export async function inviteJitsiAdminParticipant(
  roomId: string,
  email: string,
  signal: AbortSignal
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${JITSI_ADMIN_URL}/api/v1/user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${JITSI_ADMIN_API_KEY}`
      },
      body: JSON.stringify({ room: roomId, email }),
      signal
    })
    if (!res.ok) return { ok: false, error: `jitsi-admin responded ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network error' }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', OCIS_URL || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')
}

/**
 * Authoritative server-side origin check. CORS response headers (set by
 * `setCorsHeaders`) are advisory and browser-enforced only, so they cannot
 * stop a non-browser or hostile client from reaching jitsi-admin through
 * this proxy. This is the server-side gate that actually rejects requests
 * from an unexpected origin — see CLAUDE.md's origin-validation requirement.
 */
export function isOriginAllowed(origin: string | undefined, expected: string): boolean {
  if (!expected) return true
  if (origin !== undefined && origin !== expected) return false
  return true
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  if (res.writableEnded || res.destroyed) return
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(payload)
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

export async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  res.on('error', () => {})

  const clientAbortController = new AbortController()
  req.on('close', () => clientAbortController.abort())

  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'POST' || req.url !== '/rooms') {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  const originHeader = req.headers['origin']
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader
  if (!isOriginAllowed(origin, ALLOWED_ORIGIN)) {
    sendJson(res, 403, { error: 'Origin not allowed' })
    return
  }

  const authHeader = req.headers['authorization']
  if (!authHeader) {
    sendJson(res, 401, { error: 'Missing Authorization header' })
    return
  }

  let identity: OcisIdentity | null
  try {
    identity = await validateOcisToken(authHeader)
  } catch (err) {
    console.error('[jitsi-admin-proxy] Token validation error:', err)
    sendJson(res, 502, { error: 'Could not reach oCIS to validate token' })
    return
  }

  if (!identity) {
    sendJson(res, 401, { error: 'Invalid or expired oCIS token' })
    return
  }

  if (!checkRateLimit(identity.sub)) {
    sendJson(res, 429, { error: 'Rate limit exceeded. Please slow down.' })
    return
  }

  let rawBodyStr: string
  try {
    rawBodyStr = await readBody(req, MAX_BODY_BYTES)
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      sendJson(res, 413, { error: 'Request body too large' })
    } else {
      sendJson(res, 400, { error: 'Could not read request body' })
    }
    return
  }

  let parsed: RawRoomRequest
  try {
    parsed = JSON.parse(rawBodyStr) as RawRoomRequest
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' })
    return
  }

  const sanitized = sanitizeRoomRequest(parsed, MAX_PARTICIPANTS)
  if ('error' in sanitized) {
    sendJson(res, 400, { error: sanitized.error })
    return
  }

  const signal = AbortSignal.any([
    clientAbortController.signal,
    AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  ])

  const room = await createJitsiAdminRoom(sanitized.roomName, identity.email, signal)
  if (!room.ok) {
    sendJson(res, room.status, { error: `Could not create jitsi-admin room: ${room.error}` })
    return
  }

  const failed: Array<{ email: string; error: string }> = sanitized.invalidParticipants.map(
    (p) => {
      const input = p.input as { email?: unknown } | null | undefined
      const email =
        input && typeof input === 'object' && 'email' in input ? String(input.email) : String(input)
      return { email, error: p.error }
    }
  )
  let invited = 0

  for (const participant of sanitized.validParticipants) {
    const result = await inviteJitsiAdminParticipant(room.roomId, participant.email, signal)
    if (result.ok) {
      invited++
    } else {
      failed.push({ email: participant.email, error: result.error ?? 'unknown error' })
    }
  }

  sendJson(res, 200, { roomCreated: true, invited, failed })
}

// ---------------------------------------------------------------------------
// Server — only started when run directly, not when imported in tests
// ---------------------------------------------------------------------------

if (process.env.NODE_ENV !== 'test') {
  if (!OCIS_URL) {
    console.error('OCIS_URL is required')
    process.exit(1)
  }
  // JITSI_ADMIN_URL/API_KEY/SERVER are not fatal at startup — there is no
  // acceptable default to fall back to (see DECISIONS.md, D4), so an
  // operator-unconfigured proxy simply fails cleanly per-request instead of
  // crash-looping the whole container.
  if (!JITSI_ADMIN_URL || !JITSI_ADMIN_API_KEY || !JITSI_ADMIN_SERVER) {
    console.warn(
      '[jitsi-admin-proxy] JITSI_ADMIN_URL/JITSI_ADMIN_API_KEY/JITSI_ADMIN_SERVER are not fully configured — requests will fail until an operator sets them.'
    )
  }

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error('[jitsi-admin-proxy] Unhandled error:', err)
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Internal server error' })
      }
    })
  })

  server.listen(PORT, () => {
    console.log(`[jitsi-admin-proxy] Listening on: ${PORT}`)
    console.log(`[jitsi-admin-proxy] jitsi-admin URL: ${JITSI_ADMIN_URL}`)
    console.log(`[jitsi-admin-proxy] oCIS URL:         ${OCIS_URL}`)
  })
}
