import { ref, type Ref } from 'vue'
import { useAuthStore } from '@ownclouders/web-pkg'

export interface LLMConfig {
  endpoint: string
  model: string
}

export type LLMStatus = 'unconfigured' | 'ready' | 'cross-origin'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionOptions {
  maxTokens?: number
  temperature?: number
  responseFormat?: { type: 'json_object' | 'text' }
}

export interface UseLLMReturn {
  status: Ref<LLMStatus>
  complete(messages: ChatMessage[], opts?: CompletionOptions): Promise<string>
}

export function useLLM(cfg: LLMConfig | null): UseLLMReturn {
  const status = ref<LLMStatus>('unconfigured')
  const authStore = useAuthStore()

  if (cfg) {
    let endpointOrigin: string
    try {
      endpointOrigin = new URL(cfg.endpoint).origin
    } catch {
      endpointOrigin = ''
    }
    status.value = endpointOrigin === window.location.origin ? 'ready' : 'cross-origin'
  }

  function buildHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = authStore.accessToken
    if (token) {
      h['Authorization'] = `Bearer ${token}`
    }
    return h
  }

  async function complete(messages: ChatMessage[], opts: CompletionOptions = {}): Promise<string> {
    if (!cfg || status.value !== 'ready') {
      throw new Error('LLM is not configured or endpoint is not same-origin')
    }
    const base = cfg.endpoint.replace(/\/$/, '')
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.7,
        ...(opts.responseFormat && { response_format: opts.responseFormat })
      })
    })
    if (!r.ok) throw new Error(`LLM request failed: ${r.status} ${r.statusText}`)
    const d = (await r.json()) as { choices: { message: { content: string } }[] }
    return d.choices[0]?.message?.content ?? ''
  }

  return { status, complete }
}
