<template>
  <div class="photo-view">
    <div v-if="groupedPhotos.size === 0" class="photo-view-empty">
      <div class="empty-message">
        <span class="icon">📷</span>
        <p>No photos found in this folder</p>
      </div>
    </div>

    <div v-else class="photo-groups">
      <DateGroup
        v-for="[date, photos] in groupedPhotos"
        :key="date"
        :date="date"
        :photos="photos"
        @photo-click="handlePhotoClick"
      />
    </div>

    <!-- Photo lightbox -->
    <PhotoLightbox
      :photo="selectedPhoto"
      @close="closeLightbox"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Resource } from '@ownclouders/web-client'
import DateGroup from './DateGroup.vue'
import PhotoLightbox from './PhotoLightbox.vue'
import { usePhotos } from '../composables/usePhotos'

// Props - oCIS folder views receive resources as a prop
const props = defineProps<{
  resources: Resource[]
}>()

// Use our photo composable for filtering and grouping
const { filterImages, groupByDate } = usePhotos()

// Computed: filter and group photos from props
const groupedPhotos = computed(() => {
  if (!props.resources || props.resources.length === 0) {
    return new Map<string, Resource[]>()
  }

  const images = filterImages(props.resources)
  return groupByDate(images)
})

// Lightbox state
const selectedPhoto = ref<Resource | null>(null)

function handlePhotoClick(photo: Resource) {
  selectedPhoto.value = photo
}

function closeLightbox() {
  selectedPhoto.value = null
}
</script>

<style scoped>
.photo-view {
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
}

.photo-view-loading,
.photo-view-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--oc-color-text-muted, #666);
}

.empty-message {
  text-align: center;
}

.empty-message .icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.photo-groups {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
</style>
