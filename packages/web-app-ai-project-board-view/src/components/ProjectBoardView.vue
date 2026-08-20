<template>
  <div
    class="project-board-view oc-flex oc-flex-column"
    data-testid="project-board-view"
    :aria-label="$gettext('Project space status board')"
  >
    <div class="project-board-toolbar oc-flex oc-flex-middle oc-flex-between oc-mb-m">
      <p class="project-board-hint oc-text-muted oc-my-rm">
        {{
          $gettext(
            'Files are grouped by status, classified by AI from their name and content.'
          )
        }}
      </p>
      <oc-button
        size="small"
        variant="primary"
        appearance="raw"
        data-testid="project-board-rerun"
        :disabled="isClassifying || status !== 'ready'"
        @click="classify"
      >
        <oc-icon name="refresh" fill-type="line" size="small" />
        {{
          $pgettext(
            'Button to re-run AI classification of project files',
            'Re-run classification'
          )
        }}
      </oc-button>
    </div>

    <p v-if="status === 'cross-origin'" class="project-board-notice" role="alert">
      {{
        $gettext(
          'The AI endpoint must be on the same server as ownCloud. Cross-origin requests are not supported.'
        )
      }}
    </p>
    <p v-else-if="status === 'unconfigured'" class="project-board-notice">
      {{
        $gettext(
          'Configure an AI endpoint in admin settings to classify files automatically. All files are shown as Draft.'
        )
      }}
    </p>

    <p v-if="panelError" class="project-board-error" role="alert" data-testid="project-board-error">
      {{ panelError }}
    </p>

    <p v-if="truncated" class="project-board-notice" role="status" data-testid="project-board-truncated">
      {{
        $gettext(
          'Only the first %{count} files were classified; the rest are shown as Draft.',
          { count: MAX_FILES }
        )
      }}
    </p>

    <div
      v-if="isClassifying"
      class="project-board-state oc-flex oc-flex-column oc-flex-center oc-text-center"
      data-testid="project-board-loading"
    >
      <oc-spinner :aria-label="$gettext('Classifying files…')" />
      <p class="oc-mt-s">{{ $gettext('Classifying files…') }}</p>
    </div>

    <div
      v-else-if="totalFiles === 0"
      class="project-board-state oc-flex oc-flex-column oc-flex-center oc-text-center"
      data-testid="project-board-empty"
    >
      <oc-icon name="grid" fill-type="line" size="xlarge" />
      <p class="oc-mt-s">{{ $gettext('This project space has no files yet.') }}</p>
    </div>

    <div v-else class="project-board-lanes oc-flex oc-gap-m">
      <board-lane
        v-for="lane in LANE_ORDER"
        :key="lane"
        :lane="lane"
        :label="laneLabel(lane)"
        :icon="LANE_META[lane].icon"
        :resources="lanes[lane]"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useBoardClassification, MAX_FILES } from '../composables/useBoardClassification'
import type { LLMConfig } from '../composables/useLLM'
import { LANE_ORDER, LANE_META, type Lane } from '../utils/lane'
import BoardLane from './BoardLane.vue'

const props = defineProps<{ llmConfig?: LLMConfig | null }>()

const { $gettext, $pgettext } = useGettext()

const { status, lanes, isClassifying, panelError, truncated, classify } = useBoardClassification(
  props.llmConfig ?? null
)

const totalFiles = computed(
  () => lanes.value.draft.length + lanes.value['in-review'].length + lanes.value.final.length
)

function laneLabel(lane: Lane): string {
  switch (lane) {
    case 'draft':
      return $pgettext('Project board lane label', 'Draft')
    case 'in-review':
      return $pgettext('Project board lane label', 'In Review')
    case 'final':
      return $pgettext('Project board lane label', 'Final')
  }
}

onMounted(() => {
  classify()
})
</script>

<style scoped>
.project-board-view {
  height: 100%;
  min-height: 0;
}
.project-board-toolbar {
  gap: var(--oc-space-small, 0.5rem);
}
.project-board-hint {
  font-size: 0.9rem;
}
.project-board-notice {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-size: 0.85rem;
  margin: 0 0 var(--oc-space-small, 0.5rem);
}
.project-board-error {
  color: var(--oc-color-swatch-danger-default, #c00);
  margin: 0 0 var(--oc-space-small, 0.5rem);
}
.project-board-state {
  flex: 1 1 auto;
  color: var(--oc-color-text-muted, #6f6f6f);
}
.project-board-lanes {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
