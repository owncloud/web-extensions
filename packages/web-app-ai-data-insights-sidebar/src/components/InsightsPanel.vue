<template>
  <div
    data-testid="ai-data-insights-panel"
    class="ai-insights-panel oc-background-muted oc-p-m oc-rounded"
  >
    <div v-if="isAnalyzing" class="ai-insights-placeholder">
      {{ $gettext('Analyzing…') }}
    </div>

    <template v-else>
      <!-- Consent disclosure: shown once per session before the first analysis -->
      <div v-if="showConsentDialog" data-testid="ai-insights-consent" class="oc-flex oc-flex-column oc-flex-center oc-text-center">
        <p class="oc-mb-m">
          {{
            $gettext(
              'To generate insights, parts of this file will be sent to the AI service configured by your administrator. Continue?'
            )
          }}
        </p>
        <div class="oc-flex oc-flex-center oc-gap-xs">
          <oc-button size="small" variant="primary" @click="confirmConsent">
            {{ $pgettext('Consent confirmation button', 'Send to AI') }}
          </oc-button>
          <oc-button size="small" variant="passive" @click="denyConsent">
            {{ $pgettext('Consent cancellation button', 'Cancel') }}
          </oc-button>
        </div>
      </div>

      <template v-else>
        <div v-if="panelError" class="ai-insights-error" role="alert">
          {{ panelError }}
        </div>

        <template v-else-if="insightsResult">
          <table class="ai-insights-table oc-mt-rm">
            <thead>
              <tr>
                <th>{{ $gettext('Column') }}</th>
                <th>{{ $gettext('Type') }}</th>
                <th>{{ $gettext('Range') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="col in insightsResult.columnTypes" :key="col.column">
                <td>{{ col.column }}</td>
                <td>{{ col.type }}</td>
                <td>{{ rangeFor(col.column) }}</td>
              </tr>
            </tbody>
          </table>
          <ul v-if="insightsResult.observations.length" class="oc-mt-s">
            <li v-for="obs in insightsResult.observations" :key="obs">{{ obs }}</li>
          </ul>
        </template>

        <div v-else class="oc-flex oc-flex-column oc-flex-center oc-text-center">
          <p class="ai-insights-placeholder oc-mb-m oc-mt-rm">
            {{ $gettext('Analyze this CSV/TSV file to get column insights and observations.') }}
          </p>
          <oc-button size="small" variant="primary" @click="triggerInsights">
            {{ $pgettext('Button to analyze data file', 'Analyze') }}
          </oc-button>
        </div>

        <div v-if="insightsResult && !panelError" class="oc-flex oc-flex-right">
          <oc-button
            size="small"
            variant="primary"
            appearance="raw"
            class="oc-mt-s"
            @click="triggerInsights"
          >
            {{ $pgettext('Button to re-analyze data file', 'Re-analyze') }}
          </oc-button>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { toRef, onMounted } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useInsights, type InsightsResource } from '../composables/useInsights'
import type { LLMConfig } from '../composables/useLLM'

const { $gettext, $pgettext } = useGettext()

const props = defineProps<{
  resource?: InsightsResource | null
  llmConfig?: LLMConfig | null
}>()

const {
  isAnalyzing,
  insightsResult,
  panelError,
  showConsentDialog,
  triggerInsights,
  confirmConsent,
  denyConsent,
  ensureReady
} = useInsights(props.llmConfig ?? null, toRef(props, 'resource'))

onMounted(() => {
  ensureReady()
})

function rangeFor(column: string): string {
  if (!insightsResult.value) return ''
  const r = insightsResult.value.ranges.find((ri) => ri.column === column)
  if (!r) return ''
  if (r.min !== undefined && r.max !== undefined) return `${r.min} – ${r.max}`
  if (r.min !== undefined) return `≥ ${r.min}`
  if (r.max !== undefined) return `≤ ${r.max}`
  return ''
}
</script>

<style scoped>
.ai-insights-panel {
  min-height: 8rem;
}
.ai-insights-placeholder {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-style: italic;
}
.ai-insights-error {
  color: var(--oc-color-swatch-danger-default, #c00);
}
.ai-insights-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.ai-insights-table th,
.ai-insights-table td {
  text-align: left;
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid var(--oc-color-border, #e0e0e0);
}
</style>
