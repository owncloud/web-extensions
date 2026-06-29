import { ref } from 'vue'
import type { LLMConfig } from './composables/useLLM'

export interface SynthesisResource {
  id?: string
  name?: string
  extension?: string
  storageId?: string
  path?: string
}

export const overlayOpen = ref(false)
export const overlayResources = ref<SynthesisResource[]>([])
export const overlayLlmConfig = ref<LLMConfig | null>(null)
