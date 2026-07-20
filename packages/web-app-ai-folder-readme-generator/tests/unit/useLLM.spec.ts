import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @ownclouders/web-pkg before importing useLLM so useAuthStore is available.
vi.mock('@ownclouders/web-pkg', () => ({
  useAuthStore: vi.fn(() => ({ accessToken: 'test-token' }))
}))

import { useLLM } from '../../src/composables/useLLM'
import type { LLMConfig } from '../../src/composables/useLLM'
import { useAuthStore } from '@ownclouders/web-pkg'

// In the happy-dom test environment, window.location.origin defaults to a fixed value.
const SAME_ORIGIN = window.location.origin
const SAME_ORIGIN_CONFIG: LLMConfig = {
  endpoint: `${SAME_ORIGIN}/ai-llm-proxy/v1`,
  model: 'test-model'
}
const CROSS_ORIGIN_CONFIG: LLMConfig = {
  endpoint: 'https://external-llm.example.com/v1',
  model: 'llama3.2'
}

describe('useLLM', () => {
  beforeEach(() => {
    vi.mocked(useAuthStore).mockReturnValue({ accessToken: 'test-token' } as any)
  })

  describe('status at initialisation', () => {
    it('is unconfigured when no config is provided', () => {
      const { status } = useLLM(null)
      expect(status.value).toBe('unconfigured')
    })

    it('is ready when a same-origin endpoint is provided', () => {
      const { status } = useLLM(SAME_ORIGIN_CONFIG)
      expect(status.value).toBe('ready')
    })

    it('is cross-origin when a cross-origin endpoint is provided', () => {
      const { status } = useLLM(CROSS_ORIGIN_CONFIG)
      expect(status.value).toBe('cross-origin')
    })

    it('is cross-origin when the endpoint URL is malformed', () => {
      const { status } = useLLM({ endpoint: 'not-a-valid-url', model: 'test' })
      expect(status.value).toBe('cross-origin')
    })
  })

  describe('complete', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    it('throws when the LLM is unconfigured', async () => {
      const { complete } = useLLM(null)
      await expect(complete([{ role: 'user', content: 'hello' }])).rejects.toThrow(
        /not configured/
      )
    })

    it('throws when the endpoint is cross-origin', async () => {
      const { complete } = useLLM(CROSS_ORIGIN_CONFIG)
      await expect(complete([{ role: 'user', content: 'hello' }])).rejects.toThrow()
    })

    it('calls fetch against <endpoint>/chat/completions with POST', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: 'result' } }] })
      })
      vi.stubGlobal('fetch', fetchMock)

      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await complete([{ role: 'user', content: 'ping' }])

      expect(fetchMock).toHaveBeenCalledWith(
        `${SAME_ORIGIN}/ai-llm-proxy/v1/chat/completions`,
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('strips a trailing slash from the endpoint before building the URL', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: 'result' } }] })
      })
      vi.stubGlobal('fetch', fetchMock)

      const { complete } = useLLM({ endpoint: `${SAME_ORIGIN}/ai-llm-proxy/v1/`, model: 'test-model' })
      await complete([{ role: 'user', content: 'ping' }])

      expect(fetchMock).toHaveBeenCalledWith(
        `${SAME_ORIGIN}/ai-llm-proxy/v1/chat/completions`,
        expect.anything()
      )
    })

    it('sends the model and messages in the request body with default options', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: 'ok' } }] })
      })
      vi.stubGlobal('fetch', fetchMock)

      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await complete([{ role: 'user', content: 'test' }])

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.model).toBe('test-model')
      expect(body.messages).toEqual([{ role: 'user', content: 'test' }])
      expect(body.max_tokens).toBe(1024)
      expect(body.temperature).toBe(0.7)
    })

    it('honours custom maxTokens and temperature options', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: 'ok' } }] })
      })
      vi.stubGlobal('fetch', fetchMock)

      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await complete([{ role: 'user', content: 'test' }], { maxTokens: 256, temperature: 0.1 })

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.max_tokens).toBe(256)
      expect(body.temperature).toBe(0.1)
    })

    it('sends the Authorization Bearer header with the oCIS access token', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: 'ok' } }] })
      })
      vi.stubGlobal('fetch', fetchMock)
      vi.mocked(useAuthStore).mockReturnValue({ accessToken: 'my-ocis-token' } as any)

      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await complete([{ role: 'user', content: 'test' }])

      const headers = fetchMock.mock.calls[0][1].headers
      expect(headers['Authorization']).toBe('Bearer my-ocis-token')
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('omits the Authorization header when no access token is present', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: 'ok' } }] })
      })
      vi.stubGlobal('fetch', fetchMock)
      vi.mocked(useAuthStore).mockReturnValue({ accessToken: '' } as any)

      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await complete([{ role: 'user', content: 'test' }])

      const headers = fetchMock.mock.calls[0][1].headers
      expect(headers['Authorization']).toBeUndefined()
    })

    it('returns the content string from the first choice', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => ({ choices: [{ message: { content: 'hello there' } }] })
        })
      )

      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      const result = await complete([{ role: 'user', content: 'ping' }])
      expect(result).toBe('hello there')
    })

    it('returns an empty string when the response has no choices', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => ({ choices: [] })
        })
      )

      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      const result = await complete([{ role: 'user', content: 'ping' }])
      expect(result).toBe('')
    })

    it('throws an error containing the HTTP status on a non-ok response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable'
        })
      )

      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await expect(complete([{ role: 'user', content: 'ping' }])).rejects.toThrow('503')
    })

    it('propagates a network TypeError from fetch', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await expect(complete([{ role: 'user', content: 'ping' }])).rejects.toThrow(TypeError)
    })
  })
})
