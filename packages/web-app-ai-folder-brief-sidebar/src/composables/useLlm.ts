import { ref, type Ref } from 'vue'
import { useAuthStore } from '@ownclouders/web-pkg'

export interface LlmConfig {
  endpoint: string
  model: string
}

export type LlmStatus = 'unconfigured' | 'ready'

export interface UseLlmResult {
  status: Ref<LlmStatus>
  config: Ref<LlmConfig | null>
  ensureReady: () => Promise<void>
  buildHeaders: () => Record<string, string>
}

export function useLlm(initialConfig: LlmConfig | null): UseLlmResult {
  const status = ref<LlmStatus>('unconfigured')
  const config = ref<LlmConfig | null>(initialConfig)

  async function ensureReady(): Promise<void> {
    status.value = config.value ? 'ready' : 'unconfigured'
  }

  function buildHeaders(): Record<string, string> {
    const authStore = useAuthStore()
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authStore.accessToken) {
      h['Authorization'] = `Bearer ${authStore.accessToken}`
    }
    return h
  }

  return { status, config, ensureReady, buildHeaders }
}
