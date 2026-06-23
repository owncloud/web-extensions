<template>
  <div class="scan-results-modal oc-p-s">
    <div v-if="isScanning" class="oc-p-m">
      {{ $gettext('Scanning files for sensitive data…') }}
    </div>

    <template v-else>
      <div v-for="result in scanResults" :key="result.name" class="scan-result oc-mb-m">
        <p class="oc-text-bold oc-mb-xs">{{ result.name }}</p>

        <div v-if="result.error" role="alert" class="scan-error">
          {{ result.error }}
        </div>

        <div v-else-if="result.findings.length === 0" class="scan-no-findings">
          {{ $gettext('No sensitive data found.') }}
        </div>

        <ul v-else class="oc-mt-xs">
          <li v-for="(finding, i) in result.findings" :key="i">
            <strong>{{ finding.type }}</strong
            >: {{ finding.value }}
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useModals } from '@ownclouders/web-pkg'
import { useScanner, type LlmConfig, type ScanResource } from '../composables/useScanner'

const { $gettext } = useGettext()
const { activeModal, removeModal } = useModals()

const props = defineProps<{
  resources?: ScanResource[]
  llmConfig?: LlmConfig | null
}>()

const resourcesRef = ref(props.resources ?? [])
const { isScanning, scanResults, runScan } = useScanner(props.llmConfig ?? null, resourcesRef)

onMounted(async () => {
  const modalId = activeModal.id
  await runScan()
  setTimeout(() => removeModal(modalId), 500)
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
