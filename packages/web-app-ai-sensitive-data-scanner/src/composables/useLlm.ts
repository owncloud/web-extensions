import { ref } from 'vue'
import { useAuthStore } from '@ownclouders/web-pkg'

export interface LlmConfig {
  endpoint: string
  model: string
}

export type LlmStatus = 'unconfigured' | 'ready'

export function useLlm(initialConfig: LlmConfig | null) {
  const authStore = useAuthStore()
  const config = ref<LlmConfig | null>(initialConfig)
  const status = ref<LlmStatus>(initialConfig ? 'ready' : 'unconfigured')

  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = authStore.accessToken
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  async function callLlm(
    messages: Array<{ role: string; content: string }>,
    options?: { maxTokens?: number }
  ): Promise<{ choices?: Array<{ message?: { content?: string } }> }> {
    const cfg = config.value
    if (!cfg) {
      throw new Error('AI endpoint not configured')
    }
    const base = cfg.endpoint.replace(/\/$/, '')
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: cfg.model,
        messages,
        response_format: { type: 'json_object' },
        max_tokens: options?.maxTokens ?? 1024
      })
    })
    if (!res.ok) {
      throw new Error(`LLM request failed with status ${res.status}`)
    }
    return res.json() as Promise<{ choices?: Array<{ message?: { content?: string } }> }>
  }

  return { config, status, callLlm }
}
