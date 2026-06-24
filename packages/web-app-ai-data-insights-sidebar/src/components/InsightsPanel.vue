<template>
  <div data-testid="ai-data-insights-panel" />
</template>

<script setup lang="ts">
import type { LLMConfig } from '../composables/useLLM'

defineProps<{
  resource: unknown
  llmConfig: LLMConfig | null
}>()
</script>
