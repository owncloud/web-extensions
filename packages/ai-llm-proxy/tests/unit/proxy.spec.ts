import { describe, it, expect, beforeEach } from 'vitest'
import { Readable } from 'node:stream'
import type http from 'node:http'

import {
  sanitizeBody,
  checkRateLimit,
  rateLimitWindows,
  readBody,
  BodyTooLargeError
} from '../../src/index.js'

// ---------------------------------------------------------------------------
// sanitizeBody
// ---------------------------------------------------------------------------

describe('sanitizeBody', () => {
  it('uses the client model when no override is set', () => {
    const result = sanitizeBody({ model: 'llama3.2', messages: [] }, '', 4096)
    expect('error' in result).toBe(false)
    if (!('error' in result)) expect(result.model).toBe('llama3.2')
  })

  it('overrides the client model when modelOverride is set', () => {
    const result = sanitizeBody({ model: 'llama3.2', messages: [] }, 'mistral', 4096)
    if (!('error' in result)) expect(result.model).toBe('mistral')
  })

  it('returns an error when model is absent and no override is configured', () => {
    const result = sanitizeBody({ messages: [] }, '', 4096)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/model/i)
  })

  it('returns an error when messages is not an array', () => {
    const result = sanitizeBody({ model: 'm', messages: 'bad' }, '', 4096)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/messages/i)
  })

  it('returns an error when messages is missing', () => {
    const result = sanitizeBody({ model: 'm' }, '', 4096)
    expect('error' in result).toBe(true)
  })

  it('clamps max_tokens to maxTokensLimit', () => {
    const result = sanitizeBody({ model: 'm', messages: [], max_tokens: 99_999 }, '', 4096)
    if (!('error' in result)) expect(result.max_tokens).toBe(4096)
  })

  it('uses maxTokensLimit as the default when max_tokens is absent', () => {
    const result = sanitizeBody({ model: 'm', messages: [] }, '', 2048)
    if (!('error' in result)) expect(result.max_tokens).toBe(2048)
  })

  it('keeps a max_tokens value that is within the limit', () => {
    const result = sanitizeBody({ model: 'm', messages: [], max_tokens: 512 }, '', 4096)
    if (!('error' in result)) expect(result.max_tokens).toBe(512)
  })

  it('strips unknown fields from the body', () => {
    const result = sanitizeBody(
      { model: 'm', messages: [], injected_param: 'evil', another: 42 },
      '',
      4096
    )
    if (!('error' in result)) {
      expect('injected_param' in result).toBe(false)
      expect('another' in result).toBe(false)
    }
  })

  it('strips stream regardless of its value — SSE passthrough is not implemented', () => {
    const result = sanitizeBody({ model: 'm', messages: [], stream: true }, '', 4096)
    if (!('error' in result)) expect('stream' in result).toBe(false)
  })

  it('passes through a numeric temperature field', () => {
    const result = sanitizeBody({ model: 'm', messages: [], temperature: 0.7 }, '', 4096)
    if (!('error' in result)) expect(result.temperature).toBe(0.7)
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

  it('applies limits independently per user', () => {
    checkRateLimit('user-a', 3)
    checkRateLimit('user-a', 3)
    checkRateLimit('user-a', 3)
    // user-b has made no requests yet
    expect(checkRateLimit('user-b', 3)).toBe(true)
  })

  it('allows a new request once old timestamps leave the 60-second window', () => {
    const now = Date.now()
    // Pre-populate with timestamps that are just over a minute old
    rateLimitWindows.set('user-a', [now - 61_000, now - 62_000, now - 63_000])
    // All three are expired, so this request should be allowed
    expect(checkRateLimit('user-a', 3)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// readBody
// ---------------------------------------------------------------------------

function makeStream(chunks: string[]): http.IncomingMessage {
  const readable = new Readable({ read() {} })
  for (const chunk of chunks) readable.push(chunk)
  readable.push(null)
  return readable as unknown as http.IncomingMessage
}

describe('readBody', () => {
  it('reads and concatenates body chunks into a string', async () => {
    const req = makeStream(['hello', ' ', 'world'])
    const body = await readBody(req, 1024)
    expect(body).toBe('hello world')
  })

  it('reads an empty body as an empty string', async () => {
    const req = makeStream([])
    const body = await readBody(req, 1024)
    expect(body).toBe('')
  })

  it('throws BodyTooLargeError when the total body exceeds maxBytes', async () => {
    const req = makeStream(['a'.repeat(100)])
    await expect(readBody(req, 50)).rejects.toBeInstanceOf(BodyTooLargeError)
  })

  it('accepts a body that is exactly at the limit', async () => {
    const req = makeStream(['a'.repeat(50)])
    const body = await readBody(req, 50)
    expect(body.length).toBe(50)
  })
})
