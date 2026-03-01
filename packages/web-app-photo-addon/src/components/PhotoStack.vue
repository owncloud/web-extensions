<template>
  <div
    v-if="topPhoto"
    class="photo-stack"
    role="button"
    tabindex="0"
    :aria-label="photos.length > 1 ? $gettext('%{name}, stack of %{count} photos').replace('%{name}', topPhoto.name).replace('%{count}', String(photos.length)) : topPhoto.name"
    @click="$emit('click')"
    @keydown.enter="$emit('click')"
    @keydown.space.prevent="$emit('click')"
  >
    <!-- Background images (rotated) -->
    <div
      v-for="(photo, index) in backgroundPhotos"
      :key="photo.fileId || photo.id || index"
      class="stack-layer"
      :style="getLayerStyle(index)"
    >
      <img
        :src="getPhotoUrl(photo)"
        :alt="photo.name"
        loading="lazy"
        @error="handleImageError"
      />
    </div>

    <!-- Top image -->
    <div class="stack-top">
      <img
        :src="getPhotoUrl(topPhoto)"
        :alt="topPhoto.name"
        loading="lazy"
        @error="handleImageError"
      />
    </div>

    <!-- Count badge -->
    <div v-if="photos.length > 1" class="stack-badge">
      {{ photos.length }}
    </div>

    <!-- Hover overlay -->
    <div class="stack-overlay">
      <span class="stack-name">{{ topPhoto.name }}</span>
      <span v-if="photos.length > 1" class="stack-count">
        {{ $gettext('+%{count} more').replace('%{count}', String(photos.length - 1)) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Resource } from '@ownclouders/web-client'
import { useTranslations } from '../composables/useTranslations'
import type { PhotoWithDate } from '../types'

const props = defineProps<{
  photos: PhotoWithDate[]
  getPhotoUrl: (photo: Resource) => string
}>()

defineEmits<{
  (e: 'click'): void
}>()

const { $gettext } = useTranslations()

// Top photo is the first one (most recent in the group)
const topPhoto = computed(() => props.photos[0])

// Show up to 2 background photos for the stack effect
const backgroundPhotos = computed(() => {
  if (props.photos.length <= 1) return []
  return props.photos.slice(1, 3).reverse()
})

// Generate rotation and offset for each background layer
function getLayerStyle(index: number): Record<string, string> {
  const rotations = [6, -4] // degrees
  const offsets = [8, 4] // pixels

  const rotation = rotations[index] || 0
  const offset = offsets[index] || 0

  return {
    transform: `rotate(${rotation}deg) translate(${offset}px, ${offset}px)`,
    zIndex: String(index)
  }
}

function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement
  img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ddd" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="12">No preview</text></svg>'
}
</script>

<style scoped>
.photo-stack {
  position: relative;
  aspect-ratio: 1;
  cursor: pointer;
}

.stack-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--oc-color-background-muted, #f0f0f0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.stack-layer img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.stack-top {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: var(--oc-color-background-muted, #f0f0f0);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  z-index: 10;
  transition: transform 0.2s, box-shadow 0.2s;
}

.photo-stack:hover .stack-top {
  transform: scale(1.02);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.stack-top img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.stack-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: var(--oc-color-swatch-primary-default, #0070c0);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
  z-index: 20;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.stack-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  padding: 0.5rem;
  color: white;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 15;
  border-radius: 0 0 8px 8px;
}

.photo-stack:hover .stack-overlay {
  opacity: 1;
}

.stack-name {
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.stack-count {
  font-size: 0.65rem;
  opacity: 0.8;
}
</style>
