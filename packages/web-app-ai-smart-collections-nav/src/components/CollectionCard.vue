<template>
  <button
    type="button"
    class="collection-card oc-rounded oc-background-muted oc-p-m"
    :aria-label="ariaLabel"
    @click="emit('click')"
  >
    <span class="collection-card-badge oc-rounded">
      <oc-icon name="sparkling-2" fill-type="line" />
    </span>
    <span class="collection-card-label oc-text-truncate">{{ label }}</span>
    <span class="collection-card-count oc-text-muted">{{ countLabel }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'

const { $gettext, $ngettext } = useGettext()

const props = defineProps<{
  label: string
  fileCount: number
}>()

const emit = defineEmits<{
  click: []
}>()

const countLabel = computed(() =>
  $ngettext('%{n} file', '%{n} files', props.fileCount, { n: String(props.fileCount) })
)

const ariaLabel = computed(() =>
  $gettext('View collection "%{label}" (%{count} files)', {
    label: props.label,
    count: String(props.fileCount)
  })
)
</script>

<style scoped>
.collection-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--oc-space-small);
  width: 100%;
  border: 1px solid var(--oc-color-border);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s;
}

.collection-card:hover,
.collection-card:focus-visible {
  background-color: var(--oc-color-background-hover);
}

.collection-card-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  background-color: var(--oc-color-swatch-brand-default);
  color: var(--oc-color-swatch-brand-contrast);
}

.collection-card-label {
  font-weight: 600;
  font-size: 1rem;
  max-width: 100%;
}

.collection-card-count {
  font-size: 0.8125rem;
}
</style>
