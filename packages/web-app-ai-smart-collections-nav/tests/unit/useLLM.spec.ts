import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLLM } from '../../src/composables/useLLM'
import type { LLMConfig } from '../../src/composables/useLLM'

const postMock = vi.fn()

vi.mock('@ownclouders/web-pkg', () => ({
  useClientService: () => ({
    httpAuthenticated: { post: postMock }
  })
}))

// happy-dom is this package's vitest environment (see vite.config.ts), so window.location.origin
// is a real same-origin base we can build a "ready" config against.
const SAME_ORIGIN = window.location.origin
const SAME_ORIGIN_CONFIG: LLMConfig = { endpoint: `${SAME_ORIGIN}/ai-llm-proxy`, model: 'llama3.2' }
const CROSS_ORIGIN_CONFIG: LLMConfig = { endpoint: 'https://external-llm.example.com/v1', model: 'llama3.2' }

beforeEach(() => {
  postMock.mockReset()
})

describe('useLLM', () => {
  describe('status', () => {
    it('is unconfigured when no config is provided', () => {
      const { status } = useLLM(null)
      expect(status.value).toBe('unconfigured')
    })

    it('is ready when a same-origin endpoint is provided', () => {
      const { status } = useLLM(SAME_ORIGIN_CONFIG)
      expect(status.value).toBe('ready')
    })

    it('marks cross-origin endpoints as cross-origin', () => {
      const { status } = useLLM(CROSS_ORIGIN_CONFIG)
      expect(status.value).toBe('cross-origin')
    })

    it('is cross-origin when the endpoint URL is malformed', () => {
      const { status } = useLLM({ endpoint: 'not-a-valid-url', model: 'llama3.2' })
      expect(status.value).toBe('cross-origin')
    })
  })

  describe('complete — guard conditions', () => {
    it('throws without posting when unconfigured', async () => {
      const { complete } = useLLM(null)
      await expect(complete([{ role: 'user', content: 'hi' }])).rejects.toThrow()
      expect(postMock).not.toHaveBeenCalled()
    })

    it('throws without posting when cross-origin', async () => {
      const { complete } = useLLM(CROSS_ORIGIN_CONFIG)
      await expect(complete([{ role: 'user', content: 'hi' }])).rejects.toThrow()
      expect(postMock).not.toHaveBeenCalled()
    })
  })

  describe('complete — ready state', () => {
    it('posts to <endpoint>/chat/completions with the model and messages', async () => {
      postMock.mockResolvedValue({ data: { choices: [{ message: { content: 'result' } }] } })
      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await complete([{ role: 'user', content: 'ping' }])

      expect(postMock).toHaveBeenCalledWith(
        `${SAME_ORIGIN}/ai-llm-proxy/chat/completions`,
        expect.objectContaining({ model: 'llama3.2', messages: [{ role: 'user', content: 'ping' }] }),
        expect.anything()
      )
    })

    it('strips a trailing slash from the endpoint before building the request URL', async () => {
      postMock.mockResolvedValue({ data: { choices: [{ message: { content: 'ok' } }] } })
      const { complete } = useLLM({ endpoint: `${SAME_ORIGIN}/ai-llm-proxy/`, model: 'llama3.2' })
      await complete([{ role: 'user', content: 'ping' }])
      expect(postMock).toHaveBeenCalledWith(
        `${SAME_ORIGIN}/ai-llm-proxy/chat/completions`,
        expect.anything(),
        expect.anything()
      )
    })

    it('returns the content string from the first choice', async () => {
      postMock.mockResolvedValue({ data: { choices: [{ message: { content: 'hello there' } }] } })
      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      const result = await complete([{ role: 'user', content: 'ping' }])
      expect(result).toBe('hello there')
    })

    it('returns an empty string when there are no choices', async () => {
      postMock.mockResolvedValue({ data: { choices: [] } })
      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      const result = await complete([{ role: 'user', content: 'ping' }])
      expect(result).toBe('')
    })

    it('defaults max_tokens to 1024 and temperature to 0.7 when not provided', async () => {
      postMock.mockResolvedValue({ data: { choices: [{ message: { content: '{}' } }] } })
      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await complete([{ role: 'user', content: 'ping' }])
      expect(postMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ max_tokens: 1024, temperature: 0.7 }),
        expect.anything()
      )
    })

    it('forwards maxTokens, temperature, and responseFormat overrides', async () => {
      postMock.mockResolvedValue({ data: { choices: [{ message: { content: '{}' } }] } })
      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await complete([{ role: 'user', content: 'ping' }], {
        maxTokens: 512,
        temperature: 0.2,
        responseFormat: { type: 'json_object' }
      })
      expect(postMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          max_tokens: 512,
          temperature: 0.2,
          response_format: { type: 'json_object' }
        }),
        expect.anything()
      )
    })

    it('omits response_format entirely when not requested', async () => {
      postMock.mockResolvedValue({ data: { choices: [{ message: { content: '{}' } }] } })
      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await complete([{ role: 'user', content: 'ping' }])
      const body = postMock.mock.calls[0][1]
      expect(body).not.toHaveProperty('response_format')
    })
  })

  describe('complete — error mapping', () => {
    it('maps an ERR_CANCELED rejection to a DOMException TimeoutError', async () => {
      postMock.mockRejectedValue({ code: 'ERR_CANCELED' })
      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await expect(complete([{ role: 'user', content: 'ping' }])).rejects.toMatchObject({
        name: 'TimeoutError'
      })
    })

    it('maps an HTTP error response to "LLM request failed: <status> <statusText>"', async () => {
      postMock.mockRejectedValue({ response: { status: 500, statusText: 'Internal Server Error' } })
      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await expect(complete([{ role: 'user', content: 'ping' }])).rejects.toThrow(
        'LLM request failed: 500 Internal Server Error'
      )
    })

    it('maps an ERR_NETWORK rejection to a TypeError', async () => {
      postMock.mockRejectedValue({ code: 'ERR_NETWORK' })
      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await expect(complete([{ role: 'user', content: 'ping' }])).rejects.toBeInstanceOf(TypeError)
    })

    it('passes a plain Error through unchanged', async () => {
      postMock.mockRejectedValue(new Error('boom'))
      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await expect(complete([{ role: 'user', content: 'ping' }])).rejects.toThrow('boom')
    })

    it('falls back to a generic error for unrecognised rejection shapes', async () => {
      postMock.mockRejectedValue('a string rejection')
      const { complete } = useLLM(SAME_ORIGIN_CONFIG)
      await expect(complete([{ role: 'user', content: 'ping' }])).rejects.toThrow('LLM request failed')
    })
  })
})
