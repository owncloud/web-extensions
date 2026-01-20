<template>
  <div class="date-group">
    <h3 class="date-header">{{ formattedDate }}</h3>
    <PhotoGrid :photos="photos" @photo-click="handleClick" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Resource } from '@ownclouders/web-client'
import PhotoGrid from './PhotoGrid.vue'

const props = defineProps<{
  date: string
  photos: Resource[]
}>()

const emit = defineEmits<{
  (e: 'photo-click', photo: Resource): void
}>()

// Format date for display (YYYY-MM-DD -> "January 10, 2026")
const formattedDate = computed(() => {
  const [year, month, day] = props.date.split('-').map(Number)
  const dateObj = new Date(year, month - 1, day)

  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  // Check if it's today or yesterday
  if (dateObj.toDateString() === today.toDateString()) {
    return 'Today'
  }
  if (dateObj.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }

  // Otherwise format as full date
  return dateObj.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

function handleClick(photo: Resource) {
  emit('photo-click', photo)
}
</script>

<style scoped>
.date-group {
  margin-bottom: 1rem;
}

.date-header {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--oc-color-text-default, #333);
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--oc-color-border, #ddd);
}
</style>
