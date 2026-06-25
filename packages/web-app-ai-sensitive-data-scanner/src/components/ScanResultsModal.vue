<template>
  <div data-testid="scan-results-modal" class="scan-results-modal oc-p-s">
    <div v-if="status === 'unconfigured'" class="scan-results-placeholder">
      {{
        $gettext(
          'Sensitive data scanning is not set up yet. Contact your administrator to configure an AI endpoint.'
        )
      }}
    </div>

    <div v-else-if="isScanning && !hasAnyResult" class="scan-results-placeholder oc-p-m">
      {{ $gettext('Scanning files for sensitive data…') }}
    </div>

    <template v-else>
      <div v-for="result in scanResults" :key="result.filename" class="scan-result oc-mb-m">
        <div class="oc-flex oc-flex-between oc-flex-center oc-mb-xs">
          <p class="oc-text-bold">{{ result.filename }}</p>
          <span v-if="result.state === 'scanning'" class="scan-results-placeholder scan-results-scanning">
            {{ $gettext('Scanning…') }}
          </span>
        </div>

        <div v-if="result.state === 'pending'" class="scan-results-placeholder">
          {{ $gettext('Waiting…') }}
        </div>

        <div v-else-if="result.state === 'skipped'" class="scan-results-placeholder">
          {{ $gettext('File type not supported — skipped.') }}
        </div>

        <div v-else-if="result.error" role="alert" class="scan-results-error">
          {{ result.error }}
        </div>

        <div v-else-if="result.narrative" class="scan-results-narrative">
          {{ result.narrative }}
        </div>

        <div
          v-else-if="result.state === 'done' && result.findings.length === 0"
          class="scan-results-placeholder"
        >
          {{ $gettext('No sensitive data found.') }}
        </div>

        <ul v-else class="scan-results-findings oc-mt-xs">
          <li
            v-for="(finding, i) in result.findings"
            :key="i"
            class="scan-results-finding oc-flex oc-flex-center oc-mb-xs"
          >
            <oc-icon :name="categoryIcon(finding.category)" size="small" class="oc-mr-xs" />
            <strong class="scan-results-finding-category oc-mr-xs">{{
              categoryLabel(finding.category)
            }}</strong>
            <span class="scan-results-finding-excerpt">{{ finding.excerpt }}</span>
          </li>
        </ul>
      </div>

      <div v-if="!isScanning && scanResults.length > 0" class="oc-flex oc-flex-right oc-mt-s">
        <oc-button size="small" variant="primary" appearance="raw" @click="rescan">
          {{ $pgettext('Button to re-run the sensitive data scan', 'Re-scan') }}
        </oc-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useScanner, type LlmConfig, type ScanResource, type ScanFindingCategory } from '../composables/useScanner'

const { $gettext, $pgettext } = useGettext()

const props = defineProps<{
  resources?: ScanResource[]
  llmConfig?: LlmConfig | null
}>()

const resourcesRef = ref(props.resources ?? [])
const { isScanning, scanResults, status, runScan } = useScanner(props.llmConfig ?? null, resourcesRef)

const hasAnyResult = computed(() => scanResults.value.some((r) => r.state !== 'pending'))

function categoryIcon(category: ScanFindingCategory): string {
  switch (category) {
    case 'pii':
      return 'user'
    case 'credentials':
      return 'key'
    case 'confidential':
      return 'lock'
    default:
      return 'alert'
  }
}

function categoryLabel(category: ScanFindingCategory): string {
  switch (category) {
    case 'pii':
      return $pgettext('Sensitive data category label', 'PII')
    case 'credentials':
      return $pgettext('Sensitive data category label', 'Credentials')
    case 'confidential':
      return $pgettext('Sensitive data category label', 'Confidential')
    default:
      return category
  }
}

async function rescan() {
  await runScan()
}

onMounted(async () => {
  if (status.value !== 'unconfigured') {
    await runScan()
  }
})
</script>

<style scoped>
.scan-results-placeholder {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-style: italic;
}

.scan-results-scanning {
  font-size: 0.875rem;
}

.scan-results-error {
  color: var(--oc-color-danger, #c00);
}

.scan-results-narrative {
  white-space: pre-wrap;
}

.scan-results-findings {
  list-style: none;
  padding: 0;
  margin: 0;
}

.scan-results-finding-category {
  font-size: 0.875rem;
  min-width: 6rem;
}

.scan-results-finding-excerpt {
  font-size: 0.875rem;
  color: var(--oc-color-text-muted, #6f6f6f);
  word-break: break-word;
}
</style>
