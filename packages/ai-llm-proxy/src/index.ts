import http from 'node:http'

// ---------------------------------------------------------------------------
// Config (all values come from environment variables)
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? '3030', 10)
const LLM_ENDPOINT = (process.env.LLM_ENDPOINT ?? '').replace(/\/$/, '')
const LLM_API_KEY = process.env.LLM_API_KEY ?? ''
const OCIS_URL = (process.env.OCIS_URL ?? '').replace(/\/$/, '')

if (!LLM_ENDPOINT) {
  console.error('LLM_ENDPOINT is required')
  process.exit(1)
}
if (!OCIS_URL) {
  console.error('OCIS_URL is required')
  process.exit(1)
}

// NODE_TLS_REJECT_UNAUTHORIZED=0 is intentionally left to the operator for
// dev setups with self-signed certs (e.g. the oCIS docker-compose stack).

// ---------------------------------------------------------------------------
// OIDC discovery — fetched once at startup, userinfo_endpoint cached
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
  console.log(`[ai-llm-proxy] userinfo_endpoint: ${userinfoEndpoint}`)
  return userinfoEndpoint
}

// ---------------------------------------------------------------------------
// Token validation
// ---------------------------------------------------------------------------

async function validateOcisToken(authorizationHeader: string): Promise<boolean> {
  const endpoint = await resolveUserinfoEndpoint()
  const res = await fetch(endpoint, {
    headers: { Authorization: authorizationHeader }
  })
  return res.ok
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function setCorsHeaders(res: http.ServerResponse, origin: string | undefined): void {
  res.setHeader('Access-Control-Allow-Origin', origin ?? '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(payload)
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const origin = req.headers['origin']
  setCorsHeaders(res, origin)

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Only POST /v1/chat/completions
  if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  const authHeader = req.headers['authorization']
  if (!authHeader) {
    sendJson(res, 401, { error: 'Missing Authorization header' })
    return
  }

  let tokenValid: boolean
  try {
    tokenValid = await validateOcisToken(authHeader)
  } catch (err) {
    console.error('[ai-llm-proxy] Token validation error:', err)
    sendJson(res, 502, { error: 'Could not reach oCIS to validate token' })
    return
  }

  if (!tokenValid) {
    sendJson(res, 401, { error: 'Invalid or expired oCIS token' })
    return
  }

  let body: string
  try {
    body = await readBody(req)
  } catch (err) {
    sendJson(res, 400, { error: 'Could not read request body' })
    return
  }

  const llmHeaders: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (LLM_API_KEY) {
    llmHeaders['Authorization'] = `Bearer ${LLM_API_KEY}`
  }

  let llmRes: Response
  try {
    llmRes = await fetch(`${LLM_ENDPOINT}/chat/completions`, {
      method: 'POST',
      headers: llmHeaders,
      body,
      signal: AbortSignal.timeout(60_000)
    })
  } catch (err) {
    console.error('[ai-llm-proxy] LLM request error:', err)
    sendJson(res, 502, { error: 'Could not reach LLM endpoint' })
    return
  }

  const llmBody = await llmRes.text()
  res.writeHead(llmRes.status, {
    'Content-Type': llmRes.headers.get('content-type') ?? 'application/json'
  })
  res.end(llmBody)
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error('[ai-llm-proxy] Unhandled error:', err)
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Internal server error' })
    }
  })
})

server.listen(PORT, () => {
  console.log(`[ai-llm-proxy] Listening on: ${PORT}`)
  console.log(`[ai-llm-proxy] LLM endpoint: ${LLM_ENDPOINT}`)
  console.log(`[ai-llm-proxy] oCIS URL:     ${OCIS_URL}`)
})
