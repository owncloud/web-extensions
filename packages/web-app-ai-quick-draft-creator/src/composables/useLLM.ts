import { useAuthStore } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'

// LLMConfig is sourced from the oCIS admin-configured extension config.
// The endpoint must be the same-origin ai-llm-proxy (e.g. /ai-llm-proxy/v1).
// The proxy holds the provider API key server-side — no key is ever exposed to the browser.
export interface LLMConfig {
  endpoint: string // Same-origin ai-llm-proxy base URL (e.g. https://host/ai-llm-proxy/v1)
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
}

// useLLM is the integration point for all LLM calls in this extension.
// All traffic goes through the same-origin ai-llm-proxy which validates the
// user's oCIS OIDC token and forwards requests to the configured LLM endpoint.
// The browser never sees the provider API key.
export function useLLM(cfg: LLMConfig): UseLLMReturn {
  const authStore = useAuthStore()
  const { $gettext } = useGettext()

  function buildHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = authStore.accessToken
    if (token) {
      h['Authorization'] = `Bearer ${token}`
    }
    return h
  }

  async function complete(messages: ChatMessage[], opts: CompletionOptions = {}): Promise<string> {
    const base = cfg.endpoint.replace(/\/$/, '')

    // Reject cross-origin endpoints: the proxy must live on the same origin as ownCloud.
    // This prevents the user's OIDC bearer token from being sent to a foreign server.
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

    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature ?? 0.7
      })
    })

    if (!r.ok) {
      const status = r.status
      if (status === 401 || status === 403) {
        throw new Error(
          $gettext(
            'Access to the AI service was denied. Your session may have expired — try reloading the page.'
          )
        )
      }
      if (status === 429) {
        throw new Error($gettext('The AI service is currently busy. Please try again in a moment.'))
      }
      if (status >= 500) {
        throw new Error(
          $gettext('The AI service is temporarily unavailable. Please try again later.')
        )
      }
      throw new Error($gettext('The AI service returned an unexpected response. Please try again.'))
    }

    const d = (await r.json()) as { choices: { message: { content: string } }[] }
    return d.choices[0]?.message?.content ?? ''
  }

  return { complete }
}
