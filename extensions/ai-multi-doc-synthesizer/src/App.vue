<template>
  <div class="ai-multi-doc-synthesizer">
    <SynthesisOverlay
      v-if="overlayOpen && overlayResources.length >= 2"
      :resources="overlayResources"
      :llm-config="overlayLlmConfig"
      @close="overlayOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import SynthesisOverlay from './components/SynthesisOverlay.vue'
import { overlayOpen, overlayResources, overlayLlmConfig } from './state'
</script>
