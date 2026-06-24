<template>
  <div data-testid="ai-data-insights-panel" />
</template>

<script setup lang="ts">
import type { LlmConfig } from '../composables/useLlm'

defineProps<{
  resource: unknown
  llmConfig: LlmConfig | null
}>()
</script>
