<template>
  <div class="scan-results-modal oc-p-s">
    <div v-if="isScanning" class="oc-p-m">
      {{ $gettext('Scanning files for sensitive data…') }}
    </div>

    <template v-else>
      <div
        v-for="result in scanResults"
        :key="result.name"
        class="scan-result oc-mb-m"
      >
        <p class="oc-text-bold oc-mb-xs">{{ result.name }}</p>

        <div v-if="result.error" role="alert" class="scan-error">
          {{ result.error }}
        </div>

        <div v-else-if="result.findings.length === 0" class="scan-no-findings">
          {{ $gettext('No sensitive data found.') }}
        </div>

        <ul v-else class="oc-mt-xs">
          <li v-for="(finding, i) in result.findings" :key="i">
            <strong>{{ finding.type }}</strong>: {{ finding.value }}
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useScanner, type LlmConfig, type ScanResource } from '../composables/useScanner'

const { $gettext } = useGettext()

const props = defineProps<{
  resources?: ScanResource[]
  llmConfig?: LlmConfig | null
}>()

const resourcesRef = ref(props.resources ?? [])
const { isScanning, scanResults, runScan } = useScanner(props.llmConfig ?? null, resourcesRef)

onMounted(async () => {
  // The oc-modal-background captures all pointer events by default, which prevents
  // the app-switcher button (in the top nav) from being clicked while the modal is
  // open. Setting pointer-events: none on the backdrop keeps the modal visible and
  // functional while allowing clicks to reach elements behind it.
  const backdrop = document.querySelector<HTMLElement>('.oc-modal-background')
  if (backdrop) {
    backdrop.style.pointerEvents = 'none'
  }
  await runScan()
})
</script>

<style scoped>
.scan-error {
  color: var(--oc-color-danger, #c00);
}

.scan-no-findings {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-style: italic;
}
</style>
