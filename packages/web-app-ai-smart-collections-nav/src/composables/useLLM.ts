import { ref, type Ref } from 'vue'
import { useClientService } from '@ownclouders/web-pkg'

// LLMConfig is sourced from the oCIS admin-configured extension config.
// endpoint must be the same-origin ai-llm-proxy URL — never a direct external LLM URL.
// The proxy validates the oCIS access token and forwards the request with its own
// server-side LLM credential. No LLM credential of any kind belongs on this interface —
// that is a server-side proxy concern only.
export interface LLMConfig {
  endpoint: string // same-origin ai-llm-proxy base URL (e.g. https://owncloud.example.com/ai-llm-proxy)
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

// Normalizes the platform HTTP client's error shape back into the plain Error/TypeError/
// DOMException shapes callers (useCollections.ts's handleLlmError and friends) already
// pattern-match on, so switching transport doesn't change the caller-facing contract.
function toCompletionError(err: unknown): Error {
  const e = err as { code?: string; response?: { status?: number; statusText?: string } }

  if (e?.code === 'ERR_CANCELED') {
    return new DOMException('The LLM request timed out', 'TimeoutError')
  }
  if (e?.response?.status !== undefined) {
    return new Error(`LLM request failed: ${e.response.status} ${e.response.statusText ?? ''}`.trim())
  }
  if (e?.code === 'ERR_NETWORK') {
    return new TypeError('Network error while reaching the LLM endpoint')
  }
  return err instanceof Error ? err : new Error('LLM request failed')
}

export function useLLM(cfg: LLMConfig | null): UseLLMReturn {
  // The platform's authenticated HTTP client attaches the oCIS access token itself — the
  // same mechanism useRecentFiles.ts uses for WebDAV REPORT calls. This composable never
  // builds that credential header by hand, so a same-origin check (below) is the only
  // thing standing between this call and the token, and it can't be silently bypassed.
  const clientService = useClientService()
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

  async function complete(messages: ChatMessage[], opts: CompletionOptions = {}): Promise<string> {
    if (!cfg || status.value !== 'ready') {
      throw new Error('LLM is not configured or endpoint is not same-origin')
    }
    const base = cfg.endpoint.replace(/\/$/, '')

    try {
      const response = await clientService.httpAuthenticated.post(
        `${base}/chat/completions`,
        {
          model: cfg.model,
          messages,
          max_tokens: opts.maxTokens ?? 1024,
          temperature: opts.temperature ?? 0.7,
          ...(opts.responseFormat && { response_format: opts.responseFormat })
        },
        { signal: AbortSignal.timeout(60_000) }
      )
      const d = response.data as { choices: { message: { content: string } }[] }
      return d.choices[0]?.message?.content ?? ''
    } catch (err) {
      throw toCompletionError(err)
    }
  }

  return { status, complete }
}
