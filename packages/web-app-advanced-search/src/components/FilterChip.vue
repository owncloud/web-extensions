<template>
  <oc-tag rounded class="filter-chip" :class="categoryClass" type="span">
    <span class="chip-label">{{ filter.label }}:</span>
    <span class="chip-value">{{ filter.value }}</span>
    <oc-button
      appearance="raw"
      variation="passive"
      size="small"
      class="chip-remove"
      :aria-label="$gettext('Remove filter') + ': ' + filter.label + ' ' + filter.value"
      @click="emit('remove')"
    >
      <oc-icon name="close" size="xsmall" />
    </oc-button>
  </oc-tag>
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

.chip-remove:hover {
  background: rgba(0, 0, 0, 0.1);
  opacity: 1;
}
</style>
