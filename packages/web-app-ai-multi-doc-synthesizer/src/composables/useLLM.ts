import { useAuthStore } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'

/**
 * LLMConfig is sourced from the oCIS admin-configured extension config.
 * It must never contain an apiKey — the proxy handles provider authentication.
 * All traffic goes browser → ai-llm-proxy (same origin) → LLM provider.
 */
export interface LLMConfig {
  endpoint: string // Proxy URL, e.g. https://host.docker.internal:9200/ai-llm-proxy/v1
  model: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionOptions {
  maxTokens?: number
  temperature?: number
}

export interface UseLLMReturn {
  complete(messages: ChatMessage[], opts?: CompletionOptions): Promise<string>
  completeJSON<T>(messages: ChatMessage[], schema?: string): Promise<T>
}

/**
 * useLLM routes all requests through the ai-llm-proxy using the user's oCIS
 * access token for authentication. The proxy validates the token server-side
 * and forwards requests to the configured LLM provider, keeping provider keys
 * out of the browser entirely.
 *
 * Same-origin enforcement: if the configured endpoint is not on the same origin
 * as the ownCloud Web UI, all calls are rejected to prevent credential leakage.
 */
export function useLLM(cfg: LLMConfig): UseLLMReturn {
  const { $gettext } = useGettext()
  const authStore = useAuthStore()

  function buildHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = authStore.accessToken
    if (token) {
      h['Authorization'] = `Bearer ${token}`
    }
    return h
  }

  function aiErrorMessage(httpStatus: number): string {
    if (httpStatus === 401 || httpStatus === 403) {
      return $gettext(
        'Access to the AI service was denied. Your session may have expired — try reloading the page.'
      )
    }
    if (httpStatus === 404) {
      return $gettext(
        'The AI endpoint could not be found. Check the endpoint URL in admin settings.'
      )
    }
    if (httpStatus === 429) {
      return $gettext('The AI service is currently busy. Please try again in a moment.')
    }
    if (httpStatus >= 500) {
      return $gettext('The AI service is temporarily unavailable. Please try again later.')
    }
    return $gettext('The AI service returned an unexpected response. Please try again.')
  }

  function assertSameOrigin(): void {
    let endpointOrigin: string
    try {
      endpointOrigin = new URL(cfg.endpoint).origin
    } catch {
      endpointOrigin = ''
    }
    if (endpointOrigin !== window.location.origin) {
      throw new Error(
        $gettext(
          'The AI endpoint must be on the same server as ownCloud. Contact your administrator.'
        )
      )
    }
  }

  const base = cfg.endpoint.replace(/\/$/, '')

  async function complete(messages: ChatMessage[], opts: CompletionOptions = {}): Promise<string> {
    assertSameOrigin()
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.7
      })
    })
    if (!r.ok) {
      throw new Error(aiErrorMessage(r.status))
    }
    const d = (await r.json()) as { choices: { message: { content: string } }[] }
    return d.choices[0]?.message?.content ?? ''
  }

  async function completeJSON<T>(messages: ChatMessage[], schema?: string): Promise<T> {
    assertSameOrigin()
    // Inject JSON format instruction into the last user message so models
    // without response_format support still return structured output.
    const formatInstruction = schema
      ? `\n\nRespond ONLY with valid JSON matching this schema:\n${schema}`
      : '\n\nRespond ONLY with valid JSON. No explanation.'
    const augmented: ChatMessage[] = [
      ...messages.slice(0, -1),
      {
        ...messages[messages.length - 1],
        content: messages[messages.length - 1].content + formatInstruction
      }
    ]
    const text = await complete(augmented, { maxTokens: 2048 })
    // Tolerant parsing: find the first {...} or [...] block
    const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    if (!match) throw new Error($gettext('The AI service did not return a valid response.'))
    return JSON.parse(match[1]) as T
  }

  return { complete, completeJSON }
}
