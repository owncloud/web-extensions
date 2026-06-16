import { ref, type Ref } from 'vue'

export interface LlmConfig {
  endpoint: string
  model: string
}

export type LlmStatus = 'unconfigured' | 'ready'

export interface UseLlmResult {
  status: Ref<LlmStatus>
  config: Ref<LlmConfig | null>
  ensureReady: () => void
}

export function useLlm(initialConfig: LlmConfig | null): UseLlmResult {
  const status = ref<LlmStatus>('unconfigured')
  const config = ref<LlmConfig | null>(initialConfig)

  function ensureReady() {
    status.value = config.value ? 'ready' : 'unconfigured'
  }

  return { status, config, ensureReady }
}
