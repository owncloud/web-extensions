import { ref, type Ref } from 'vue'
import { useAuthStore } from '@ownclouders/web-pkg'

// LLMConfig is sourced from the oCIS admin-configured extension config.
// endpoint must be the same-origin ai-llm-proxy URL — never a direct external LLM URL.
// The proxy validates the oCIS access token and forwards the request with its own LLM_API_KEY.
// apiKey must NOT appear here: the LLM credential is a server-side proxy concern only.
export interface LLMConfig {
  endpoint: string  // same-origin ai-llm-proxy base URL (e.g. https://owncloud.example.com/ai-llm-proxy)
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
}

export interface UseLLMReturn {
  status: Ref<LLMStatus>
  complete(messages: ChatMessage[], opts?: CompletionOptions): Promise<string>
  stream(messages: ChatMessage[], onChunk: (chunk: string) => void): Promise<void>
}

export function useLLM(cfg: LLMConfig | null): UseLLMReturn {
  const authStore = useAuthStore()
  const status = ref<LLMStatus>('unconfigured')

  if (cfg) {
    // Enforce same-origin: cfg.endpoint must be the in-cluster ai-llm-proxy, never a direct
    // external LLM URL. Forwarding the oCIS access token cross-origin leaks user credentials.
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
        temperature: opts.temperature ?? 0.7
      })
    })
    if (!r.ok) throw new Error(`LLM request failed: ${r.status} ${r.statusText}`)
    const d = await r.json() as { choices: { message: { content: string } }[] }
    return d.choices[0]?.message?.content ?? ''
  }

  async function stream(messages: ChatMessage[], onChunk: (chunk: string) => void): Promise<void> {
    if (!cfg || status.value !== 'ready') {
      throw new Error('LLM is not configured or endpoint is not same-origin')
    }
    const base = cfg.endpoint.replace(/\/$/, '')
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ model: cfg.model, messages, stream: true, max_tokens: 1024 })
    })
    if (!r.ok) throw new Error(`LLM stream failed: ${r.status}`)
    const reader = r.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
        try {
          const data = JSON.parse(line.slice(6)) as { choices: { delta: { content?: string } }[] }
          const chunk = data.choices[0]?.delta?.content
          if (chunk) onChunk(chunk)
        } catch { /* malformed SSE chunk */ }
      }
    }
  }

  return { status, complete, stream }
}
