<template>
  <div />
</template>

<script setup lang="ts">
import type { LLMConfig } from '../composables/useLLM'
import type { TagResource } from '../composables/useTagSuggestions'

defineProps<{
  resource: TagResource | null
  llmConfig: LLMConfig | null
}>()
</script>
