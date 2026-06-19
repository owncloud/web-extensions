import { ref, type Ref } from 'vue'

export interface LlmConfig {
  endpoint: string
  model: string
  vision?: boolean
}

export type LlmStatus = 'unconfigured' | 'text-only' | 'vision-ready'

export interface UseLlmResult {
  status: Ref<LlmStatus>
  config: Ref<LlmConfig | null>
  ensureReady: () => Promise<void>
}

export function useLlm(initialConfig: LlmConfig | null): UseLlmResult {
  const status = ref<LlmStatus>('unconfigured')
  const config = ref<LlmConfig | null>(initialConfig)

  function ensureReady(): Promise<void> {
    if (!config.value) {
      status.value = 'unconfigured'
    } else if (config.value.vision) {
      status.value = 'vision-ready'
    } else {
      status.value = 'text-only'
    }
    return Promise.resolve()
  }

  return { status, config, ensureReady }
}
