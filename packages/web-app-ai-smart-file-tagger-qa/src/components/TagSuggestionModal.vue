<template>
  <div data-testid="tag-suggestion-modal" class="tag-suggestion-modal">
    <div v-if="status === 'unconfigured'" class="tag-suggestion-placeholder">
      {{
        $gettext(
          'AI tag suggestions are not set up yet. Contact your administrator to configure an AI endpoint.'
        )
      }}
    </div>

    <div v-else-if="isGenerating" class="oc-flex oc-flex-center oc-flex-middle oc-p-m">
      <oc-spinner :aria-label="$gettext('Generating tag suggestions…')" />
    </div>

    <template v-else>
      <div v-if="error" class="tag-suggestion-error" role="alert">
        {{ error }}
      </div>

      <template v-else-if="tags.length">
        <p class="tag-suggestion-hint">
          {{ $gettext('Select the tags you want to apply to this file:') }}
        </p>
        <div class="oc-flex oc-flex-wrap oc-mt-s" data-testid="tag-suggestion-chips">
          <oc-tag
            v-for="tag in tags"
            :key="tag.name"
            type="button"
            rounded
            class="tag-suggestion-chip oc-mr-xs oc-mb-xs"
            :class="{ 'tag-suggestion-chip-selected': tag.selected }"
            :aria-pressed="tag.selected"
            @click="toggleTag(tag)"
          >
            <span class="tag-suggestion-chip-name">{{ tag.name }}</span>
            <span v-if="tag.confidence !== null" class="tag-suggestion-chip-confidence">
              {{ confidenceLabel(tag.confidence) }}
            </span>
          </oc-tag>
        </div>
      </template>

      <div v-else class="tag-suggestion-placeholder">
        {{ $gettext('No tags were suggested for this file.') }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef, onMounted, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { Modal } from '@ownclouders/web-pkg'
import {
  useTagSuggestions,
  type TagResource,
  type TagSuggestion
} from '../composables/useTagSuggestions'
import type { LLMConfig } from '../composables/useLLM'

const { $gettext } = useGettext()

const props = defineProps<{
  modal?: Modal
  resource?: TagResource | null
  llmConfig?: LLMConfig | null
}>()

const emit = defineEmits<{
  (e: 'update:confirmDisabled', value: boolean): void
}>()

const { status, tags, isGenerating, error, fetchSuggestions, applyTags } = useTagSuggestions(
  toRef(props, 'resource'),
  props.llmConfig ?? null
)

const hasSelectedTags = computed(() => tags.value.some((tag) => tag.selected))
const canConfirm = computed(() => status.value === 'ready' && hasSelectedTags.value)

watch(canConfirm, (value) => emit('update:confirmDisabled', !value), { immediate: true })

function toggleTag(tag: TagSuggestion): void {
  tag.selected = !tag.selected
}

function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

async function onConfirm(): Promise<void> {
  try {
    await applyTags()
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : $gettext('Could not apply tags. Please try again.')
    throw err
  }
}

defineExpose({ onConfirm })

onMounted(() => {
  if (status.value !== 'unconfigured') {
    fetchSuggestions()
  }
})
</script>

<style scoped>
.tag-suggestion-placeholder {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-style: italic;
}

.tag-suggestion-error {
  color: var(--oc-color-danger, #c00);
}

.tag-suggestion-hint {
  margin: 0;
  color: var(--oc-color-text-muted, #6f6f6f);
  font-size: 0.875rem;
}

.tag-suggestion-chip {
  cursor: pointer;
  border: 1px solid var(--oc-color-border, #cacaca);
  background-color: var(--oc-color-background-muted, #f8f8f8);
}

.tag-suggestion-chip-selected {
  border-color: var(--oc-color-swatch-primary-default, #4a76ac);
  background-color: var(--oc-color-swatch-primary-default, #4a76ac);
  color: var(--oc-color-swatch-primary-contrast, #fff);
}

.tag-suggestion-chip-confidence {
  margin-left: var(--oc-space-xsmall, 0.25rem);
  color: var(--oc-color-text-muted, #6f6f6f);
  font-size: 0.75rem;
}

.tag-suggestion-chip-selected .tag-suggestion-chip-confidence {
  color: var(--oc-color-swatch-primary-contrast, #fff);
}
</style>
