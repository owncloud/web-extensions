import { ref, type Ref } from 'vue'

export interface LlmConfig {
  endpoint: string
  model: string
}

export type LlmStatus = 'unconfigured' | 'text-only' | 'vision-ready'

export interface UseLlmResult {
  status: Ref<LlmStatus>
  config: Ref<LlmConfig | null>
  ensureReady: (probeVision?: () => Promise<boolean>) => Promise<void>
}

export function useLlm(initialConfig: LlmConfig | null): UseLlmResult {
  const status = ref<LlmStatus>('unconfigured')
  const config = ref<LlmConfig | null>(initialConfig)

  async function ensureReady(probeVision?: () => Promise<boolean>): Promise<void> {
    if (status.value !== 'unconfigured') return
    if (!config.value) return
    if (probeVision) {
      try {
        status.value = (await probeVision()) ? 'vision-ready' : 'text-only'
      } catch {
        // Infrastructure error (404, 502, network) — leave as unconfigured so no button appears
      }
    } else {
      status.value = 'vision-ready'
    }
  }

  return { status, config, ensureReady }
}
