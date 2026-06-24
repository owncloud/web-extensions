import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLLM } from '../../src/composables/useLLM'
import type { LLMConfig } from '../../src/composables/useLLM'

// In the happy-dom test environment, window.location.origin is 'http://localhost:3000'
const SAME_ORIGIN = window.location.origin
const SAME_ORIGIN_CONFIG: LLMConfig = {
  endpoint: `${SAME_ORIGIN}/ai-proxy/v1`,
  model: 'test-model'
}
const CROSS_ORIGIN_CONFIG: LLMConfig = {
  endpoint: 'http://external.example.com/api/v1',
  model: 'test-model'
}

describe('useLLM', () => {
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

    it('throws when status is unconfigured', async () => {
      const { complete } = useLLM(null)
      await expect(complete([{ role: 'user', content: 'hello' }])).rejects.toThrow()
    })

    it('throws when status is cross-origin', async () => {
      const { complete } = useLLM(CROSS_ORIGIN_CONFIG)
      await expect(complete([{ role: 'user', content: 'hello' }])).rejects.toThrow()
    })

    it('calls fetch with the correct URL and POST method', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: 'result' } }] })
      })
      vi.stubGlobal('fetch', fetchMock)

      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await complete([{ role: 'user', content: 'ping' }])

      expect(fetchMock).toHaveBeenCalledWith(
        `${SAME_ORIGIN}/ai-proxy/v1/chat/completions`,
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('returns the content string from the first choice', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: 'hello there' } }] })
      }))

      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      const result = await complete([{ role: 'user', content: 'ping' }])
      expect(result).toBe('hello there')
    })

    it('sends the model and messages in the request body', async () => {
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
    })

    it('throws with the HTTP status code on a non-ok response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      }))

      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await expect(complete([{ role: 'user', content: 'ping' }])).rejects.toThrow('401')
    })

    it('honours the responseFormat option', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => ({ choices: [{ message: { content: '{}' } }] })
      })
      vi.stubGlobal('fetch', fetchMock)

      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await complete([{ role: 'user', content: 'test' }], { responseFormat: { type: 'json_object' } })

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.response_format).toEqual({ type: 'json_object' })
    })
  })
})
