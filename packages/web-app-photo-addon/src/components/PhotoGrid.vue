<template>
  <div class="photo-grid">
    <div
      v-for="photo in photos"
      :key="photo.id"
      class="photo-item"
      @click="handleClick(photo)"
      @keydown.enter="handleClick(photo)"
      tabindex="0"
      role="button"
      :aria-label="photo.name || 'Photo'"
    >
      <img
        :src="getThumbnailUrl(photo)"
        :alt="photo.name || 'Photo'"
        class="photo-thumbnail"
        loading="lazy"
        @error="handleImageError"
      />
      <div class="photo-overlay">
        <span class="photo-name">{{ photo.name || 'Untitled' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Resource } from '@ownclouders/web-client'

defineProps<{
  photos: Resource[]
}>()

const emit = defineEmits<{
  (e: 'photo-click', photo: Resource): void
}>()

/**
 * Get thumbnail URL for a photo
 * oCIS provides thumbnails via the thumbnail property or downloadURL
 */
function getThumbnailUrl(photo: Resource): string {
  // Use thumbnail if available
  if (photo.thumbnail) {
    return photo.thumbnail
  }
  // Fall back to download URL
  if (photo.downloadURL) {
    return photo.downloadURL
  }
  // Last resort: webDavPath
  return photo.webDavPath || ''
}

function handleClick(photo: Resource) {
  emit('photo-click', photo)
}

function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement
  // Replace with a placeholder on error
  img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ddd" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23999" font-size="12">No preview</text></svg>'
}
</script>

<style scoped>
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.5rem;
}

.photo-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 4px;
  cursor: pointer;
  background: var(--oc-color-background-muted, #f5f5f5);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.photo-item:hover,
.photo-item:focus {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  outline: none;
}

.photo-item:focus {
  box-shadow: 0 0 0 2px var(--oc-color-swatch-primary-default, #0070f3);
}

.photo-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.5rem;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  opacity: 0;
  transition: opacity 0.15s ease;
}

.photo-item:hover .photo-overlay,
.photo-item:focus .photo-overlay {
  opacity: 1;
}

.photo-name {
  color: white;
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
</style>
