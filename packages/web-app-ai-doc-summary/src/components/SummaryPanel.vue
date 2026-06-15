<template>
  <div
    data-testid="ai-doc-summary-panel"
    class="ai-doc-summary-panel oc-background-muted oc-p-m oc-rounded"
  >
    <div v-if="status === 'unconfigured'" class="ai-summary-placeholder">
      {{
        $gettext(
          'Document summarization is not set up yet. Contact your administrator to configure an AI endpoint.'
        )
      }}
    </div>

    <div v-else-if="isGenerating" class="ai-summary-placeholder">
      {{ $gettext('Summarizing…') }}
    </div>

    <template v-else>
      <div v-if="panelError" class="ai-summary-error" role="alert">
        {{ panelError }}
      </div>

      <template v-else-if="summaryResult">
        <p class="oc-mt-rm">{{ summaryResult.overview }}</p>
        <ul class="oc-mt-s">
          <li v-for="point in summaryResult.keyPoints" :key="point">{{ point }}</li>
        </ul>
      </template>

      <div v-else class="oc-flex oc-flex-column oc-flex-center oc-text-center">
        <p class="ai-summary-placeholder oc-mb-m oc-mt-rm">
          {{ $gettext('Generate an AI summary of this document.') }}
        </p>
        <oc-button size="small" variant="primary" @click="triggerSummary">
          {{ $pgettext('Button to generate document summary', 'Summarize') }}
        </oc-button>
      </div>

      <div v-if="summaryResult && !panelError" class="oc-flex oc-flex-right">
        <oc-button
          size="small"
          variant="primary"
          appearance="raw"
          class="oc-mt-s"
          @click="triggerSummary"
        >
          {{ $pgettext('Button to regenerate document summary', 'Regenerate') }}
        </oc-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { toRef, onMounted } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useSummary, type SummaryResource } from '../composables/useSummary'
import type { LlmConfig } from '../composables/useLlm'

const { $gettext, $pgettext } = useGettext()

const props = defineProps<{
  resource?: SummaryResource | null
  llmConfig?: LlmConfig | null
}>()

const { status, isGenerating, summaryResult, panelError, triggerSummary, ensureReady } = useSummary(
  props.llmConfig ?? null,
  toRef(props, 'resource')
)

onMounted(() => {
  ensureReady()
})
</script>

<style scoped>
.ai-summary-placeholder {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-style: italic;
}
.ai-summary-error {
  color: var(--oc-color-danger, #c00);
}
</style>
