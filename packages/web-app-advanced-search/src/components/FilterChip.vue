<template>
  <span class="filter-chip" :class="categoryClass" role="group">
    <span class="chip-label">{{ filter.label }}:</span>
    <span class="chip-value">{{ filter.value }}</span>
    <button
      class="chip-remove"
      @click="emit('remove')"
      :aria-label="$gettext('Remove filter') + ': ' + filter.label + ' ' + filter.value"
    >
      <span aria-hidden="true">×</span>
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
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 16px;
  font-size: 0.8125rem;
  background: #e8e8e8;
  color: #333;
}

.chip-standard {
  background: #e3f2fd;
  color: #1565c0;
}

.chip-photo {
  background: #f3e5f5;
  color: #7b1fa2;
}

.chip-text {
  background: #e8f5e9;
  color: #2e7d32;
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
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  color: inherit;
  opacity: 0.7;
}

.chip-remove:hover {
  background: rgba(0, 0, 0, 0.1);
  opacity: 1;
}
</style>
