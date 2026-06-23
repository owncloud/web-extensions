<template>
  <div class="scan-results-modal oc-p-s">
    <div v-if="isScanning && !hasAnyResult" class="oc-p-m">
      {{ $gettext('Scanning files for sensitive data…') }}
    </div>

    <template v-else>
      <div v-for="result in scanResults" :key="result.filename" class="scan-result oc-mb-m">
        <p class="oc-text-bold oc-mb-xs">{{ result.filename }}</p>

        <div v-if="result.state === 'scanning'" class="scan-scanning">
          {{ $gettext('Scanning…') }}
        </div>

        <div v-else-if="result.state === 'skipped'" class="scan-skipped">
          {{ $gettext('File type not supported — skipped.') }}
        </div>

        <div v-else-if="result.error" role="alert" class="scan-error">
          {{ result.error }}
        </div>

        <div v-else-if="result.narrative" class="scan-narrative">
          {{ result.narrative }}
        </div>

        <div v-else-if="result.findings.length === 0" class="scan-no-findings">
          {{ $gettext('No sensitive data found.') }}
        </div>

        <ul v-else class="oc-mt-xs">
          <li v-for="(finding, i) in result.findings" :key="i">
            <strong>{{ finding.category }}</strong>: {{ finding.excerpt }}
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useScanner, type LlmConfig, type ScanResource } from '../composables/useScanner'

const props = defineProps<{
  resources?: ScanResource[]
  llmConfig?: LlmConfig | null
}>()

const resourcesRef = ref(props.resources ?? [])
const { isScanning, scanResults, runScan } = useScanner(props.llmConfig ?? null, resourcesRef)

const hasAnyResult = computed(() => scanResults.value.some((r) => r.state !== 'pending'))

onMounted(async () => {
  await runScan()
})
</script>

<style scoped>
.scan-error {
  color: var(--oc-color-danger, #c00);
}

.scan-no-findings,
.scan-skipped {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-style: italic;
}

.scan-narrative {
  white-space: pre-wrap;
}
</style>
