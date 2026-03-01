<template>
  <span class="oc-tag oc-tag-rounded filter-chip" :class="categoryClass" role="group">
    <span class="chip-label">{{ filter.label }}:</span>
    <span class="chip-value">{{ filter.value }}</span>
    <button
      class="oc-button-reset chip-remove"
      :aria-label="$gettext('Remove filter') + ': ' + filter.label + ' ' + filter.value"
      @click="emit('remove')"
    >
      <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 10.586L16.95 5.636L18.364 7.05L13.414 12L18.364 16.95L16.95 18.364L12 13.414L7.05 18.364L5.636 16.95L10.586 12L5.636 7.05L7.05 5.636L12 10.586Z" /></svg>
    </button>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ActiveFilter } from '../types'
import { useTranslations } from '../composables/useTranslations'

const { $gettext } = useTranslations()

const props = defineProps<{
  filter: ActiveFilter
}>()

const emit = defineEmits<{
  (e: 'remove'): void
}>()

const categoryClass = computed(() => `chip-${props.filter.category}`)
</script>

<style scoped>
.filter-chip {
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.8125rem;
  background: var(--oc-color-background-muted, #e8e8e8);
  color: var(--oc-color-text-default, #333);
}

.chip-standard {
  background: rgba(25, 118, 210, 0.15);
  color: var(--oc-color-swatch-primary-default, #1565c0);
}

.chip-photo {
  background: rgba(156, 39, 176, 0.15);
  color: #6a1b9a;
}

.chip-text {
  background: rgba(46, 125, 50, 0.15);
  color: var(--oc-color-swatch-success-default, #2e7d32);
}

.chip-label {
  font-weight: 500;
}

.chip-value {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  margin-left: 0.25rem;
  border-radius: 50%;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
}

.chip-remove svg {
  width: 0.75rem;
  height: 0.75rem;
}

.chip-remove:hover {
  background: rgba(0, 0, 0, 0.1);
  opacity: 1;
}

</style>
