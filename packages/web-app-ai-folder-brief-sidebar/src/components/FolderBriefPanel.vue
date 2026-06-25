<template>
  <div
    data-testid="ai-folder-brief-panel"
    class="ai-folder-brief-panel oc-background-muted oc-p-m oc-rounded"
  >
    <div v-if="isLoading" class="ai-folder-brief-placeholder">
      {{ $gettext('Generating folder brief…') }}
    </div>

    <template v-else>
      <div v-if="panelError" class="ai-folder-brief-error" role="alert">
        {{ panelError }}
      </div>

      <template v-else-if="briefResult">
        <p class="oc-mt-rm">{{ briefResult.summary }}</p>
        <p v-if="briefResult.filesByType" class="oc-mt-s ai-folder-brief-section">
          {{ briefResult.filesByType }}
        </p>
        <p v-if="briefResult.recentChanges" class="oc-mt-s ai-folder-brief-section">
          {{ briefResult.recentChanges }}
        </p>
        <div v-if="!briefResult.isStatic" class="oc-flex oc-flex-right">
          <oc-button
            size="small"
            variant="primary"
            appearance="raw"
            class="oc-mt-s"
            @click="triggerBrief"
          >
            {{ $pgettext('Button to regenerate folder brief', 'Regenerate') }}
          </oc-button>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { toRef, onMounted } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useFolderBrief, type FolderResource } from '../composables/useFolderBrief'
import type { LlmConfig } from '../composables/useLlm'

const { $gettext, $pgettext } = useGettext()

const props = defineProps<{
  resource?: FolderResource | null
  llmConfig?: LlmConfig | null
}>()

const { isLoading, briefResult, panelError, triggerBrief, ensureReady } = useFolderBrief(
  props.llmConfig ?? null,
  toRef(props, 'resource')
)

onMounted(async () => {
  await ensureReady()
  await triggerBrief()
})
</script>

<style scoped>
.ai-folder-brief-panel {
  min-height: 6rem;
}
.ai-folder-brief-placeholder {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-style: italic;
}
.ai-folder-brief-error {
  color: var(--oc-color-swatch-danger-default, #c00);
}
.ai-folder-brief-section {
  color: var(--oc-color-text-default, #333);
  font-size: 0.9em;
}
</style>
