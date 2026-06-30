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

      <div v-else-if="tags.length" class="oc-flex oc-flex-wrap oc-mt-rm" data-testid="tag-suggestion-chips">
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

      <div v-else class="tag-suggestion-placeholder">
        {{ $gettext('No tags were suggested for this file.') }}
      </div>

      <div class="oc-flex oc-flex-right oc-mt-m">
        <oc-button
          size="small"
          appearance="raw"
          class="oc-mr-s"
          data-testid="tag-suggestion-dismiss"
          @click="dismiss"
        >
          {{ $pgettext('Button to dismiss tag suggestions without applying them', 'Dismiss') }}
        </oc-button>
        <oc-button
          size="small"
          variant="primary"
          :disabled="!hasSelectedTags || isApplying"
          data-testid="tag-suggestion-confirm"
          @click="confirm"
        >
          <oc-spinner v-if="isApplying" size="xsmall" :aria-label="$gettext('Applying tags…')" />
          {{ $pgettext('Button to apply the selected tag suggestions to the file', 'Apply tags') }}
        </oc-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef, onMounted } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useModals, type Modal } from '@ownclouders/web-pkg'
import { useTagSuggestions, type TagResource, type TagSuggestion } from '../composables/useTagSuggestions'
import type { LLMConfig } from '../composables/useLLM'

const { $gettext, $pgettext } = useGettext()
const { removeModal } = useModals()

const props = defineProps<{
  modal?: Modal
  resource?: TagResource | null
  llmConfig?: LLMConfig | null
}>()

const { status, tags, isGenerating, error, fetchSuggestions, applyTags } = useTagSuggestions(
  toRef(props, 'resource'),
  props.llmConfig ?? null
)

const isApplying = ref(false)

const hasSelectedTags = computed(() => tags.value.some((tag) => tag.selected))

function toggleTag(tag: TagSuggestion): void {
  tag.selected = !tag.selected
}

function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

function close(): void {
  if (props.modal?.id) {
    removeModal(props.modal.id)
  }
}

function dismiss(): void {
  close()
}

async function confirm(): Promise<void> {
  isApplying.value = true
  try {
    await applyTags()
    close()
  } catch (err) {
    error.value = err instanceof Error ? err.message : $gettext('Could not apply tags. Please try again.')
  } finally {
    isApplying.value = false
  }
}

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

.tag-suggestion-chip {
  cursor: pointer;
  border: 1px solid var(--oc-color-border, #cacaca);
  background-color: var(--oc-color-background-default, transparent);
}

.tag-suggestion-chip-selected {
  border-color: var(--oc-color-swatch-primary-default, #0079c3);
  background-color: var(--oc-color-swatch-primary-muted, #e7f2fa);
}

.tag-suggestion-chip-confidence {
  margin-left: var(--oc-space-xsmall, 0.25rem);
  color: var(--oc-color-text-muted, #6f6f6f);
  font-size: 0.75rem;
}
</style>
