<!--
  Search Results Component

  Performance: Uses v-memo directive on each item to prevent unnecessary re-renders.
  The dependency array contains only the properties displayed in that view mode.
  When the parent component's state changes, items only re-render if their
  displayed properties actually changed.

  v-memo dependency arrays by view:
  - List: [id, name, size, mdate] - shows name, size, and date
  - Grid: [id, name, mimeType] - shows name and icon (derived from mimeType)
  - Table: [id, name, mimeType, size, mdate, photo.cameraMake, photo.takenDateTime]
-->
<template>
  <div class="search-results" :class="`view-${viewMode}`">
    <!-- List View -->
    <div v-if="viewMode === 'list'" class="results-list">
      <div
        v-for="item in items"
        :key="item.id"
        v-memo="[item.id, item.name, item.size, item.mdate]"
        class="list-item"
        role="button"
        tabindex="0"
        @click="emit('item-click', item)"
        @keydown.enter="emit('item-click', item)"
      >
        <span class="item-icon">{{ getIcon(item) }}</span>
        <div class="item-details">
          <span class="item-name">{{ item.name }}</span>
          <span class="item-path">{{ getPath(item) }}</span>
        </div>
        <span class="item-size">{{ formatBytes(item.size) }}</span>
        <span class="item-date">{{ formatDate(item.mdate, undefined, getUserLocale()) }}</span>
        <button
          type="button"
          class="oc-button-reset item-menu-btn"
          :title="$gettext('More actions')"
          :aria-label="$gettext('More actions for %{name}').replace('%{name}', item.name || '')"
          @click.stop="emit('context-menu', $event, item)"
        >
          <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 3C10.9 3 10 3.9 10 5C10 6.1 10.9 7 12 7C13.1 7 14 6.1 14 5C14 3.9 13.1 3 12 3ZM12 17C10.9 17 10 17.9 10 19C10 20.1 10.9 21 12 21C13.1 21 14 20.1 14 19C14 17.9 13.1 17 12 17ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z" /></svg>
        </button>
      </div>
    </div>

    <!-- Grid View -->
    <div v-else-if="viewMode === 'grid'" class="results-grid">
      <div
        v-for="item in items"
        :key="item.id"
        v-memo="[item.id, item.name, item.mimeType]"
        class="grid-item"
        role="button"
        tabindex="0"
        @click="emit('item-click', item)"
        @keydown.enter="emit('item-click', item)"
      >
        <div class="grid-thumbnail">
          <span class="grid-icon">{{ getIcon(item) }}</span>
          <button
            type="button"
            class="oc-button-reset grid-menu-btn"
            :title="$gettext('More actions')"
            :aria-label="$gettext('More actions for %{name}').replace('%{name}', item.name || '')"
            @click.stop="emit('context-menu', $event, item)"
          >
            <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 3C10.9 3 10 3.9 10 5C10 6.1 10.9 7 12 7C13.1 7 14 6.1 14 5C14 3.9 13.1 3 12 3ZM12 17C10.9 17 10 17.9 10 19C10 20.1 10.9 21 12 21C13.1 21 14 20.1 14 19C14 17.9 13.1 17 12 17ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z" /></svg>
          </button>
        </div>
        <span class="grid-name">{{ item.name }}</span>
      </div>
    </div>

    <!-- Table View -->
    <table v-else-if="viewMode === 'table'" class="oc-table oc-table-hover results-table">
      <thead>
        <tr>
          <th class="oc-table-header-cell">{{ $gettext('Name') }}</th>
          <th class="oc-table-header-cell">{{ $gettext('Path') }}</th>
          <th class="oc-table-header-cell">{{ $gettext('Type') }}</th>
          <th class="oc-table-header-cell">{{ $gettext('Size') }}</th>
          <th class="oc-table-header-cell">{{ $gettext('Modified') }}</th>
          <th v-if="hasPhotoItems" class="oc-table-header-cell">{{ $gettext('Camera') }}</th>
          <th v-if="hasPhotoItems" class="oc-table-header-cell">{{ $gettext('Date Taken') }}</th>
          <th class="oc-table-header-cell th-actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id"
          v-memo="[item.id, item.name, item.mimeType, item.size, item.mdate, item.photo?.cameraMake, item.photo?.takenDateTime]"
          @click="emit('item-click', item)"
        >
          <td class="oc-table-cell cell-name">
            <span class="item-icon">{{ getIcon(item) }}</span>
            {{ item.name }}
          </td>
          <td class="oc-table-cell cell-path">{{ getPath(item) }}</td>
          <td class="oc-table-cell">{{ item.mimeType || $gettext('folder') }}</td>
          <td class="oc-table-cell">{{ formatBytes(item.size) }}</td>
          <td class="oc-table-cell">{{ formatDate(item.mdate, undefined, getUserLocale()) }}</td>
          <td v-if="hasPhotoItems" class="oc-table-cell">{{ getCameraInfo(item) }}</td>
          <td v-if="hasPhotoItems" class="oc-table-cell">{{ getPhotoDate(item) }}</td>
          <td class="oc-table-cell cell-actions">
            <button
              type="button"
              class="oc-button-reset item-menu-btn"
              :title="$gettext('More actions')"
              :aria-label="$gettext('More actions for %{name}').replace('%{name}', item.name || '')"
              @click.stop="emit('context-menu', $event, item)"
            >
              <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 3C10.9 3 10 3.9 10 5C10 6.1 10.9 7 12 7C13.1 7 14 6.1 14 5C14 3.9 13.1 3 12 3ZM12 17C10.9 17 10 17.9 10 19C10 20.1 10.9 21 12 21C13.1 21 14 20.1 14 19C14 17.9 13.1 17 12 17ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z" /></svg>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SearchResource, ResultViewMode } from '../types'
import { useTranslations } from '../composables/useTranslations'
import { formatBytes, formatDate, getFileIcon } from '../utils/format'

const { $gettext, getUserLocale } = useTranslations()

const props = defineProps<{
  items: SearchResource[]
  viewMode: ResultViewMode
}>()

const emit = defineEmits<{
  (e: 'item-click', item: SearchResource): void
  (e: 'context-menu', event: MouseEvent, item: SearchResource): void
}>()

/**
 * Sample size for checking photo metadata presence.
 * Only checks first N items instead of scanning entire result set.
 * See hasPhotoItems computed for rationale.
 */
const PHOTO_CHECK_SAMPLE_SIZE = 20

/**
 * Check if any items have photo metadata to determine whether to show photo columns.
 *
 * Performance optimization: Only checks first PHOTO_CHECK_SAMPLE_SIZE items instead
 * of scanning the entire result set. Rationale:
 * - If photos exist in the results, they're likely to appear early (search usually
 *   returns relevant results first)
 * - Checking N items is O(1) vs O(n) for full scan
 * - False negatives are acceptable (columns just won't show for edge cases where
 *   all photos are after the sample)
 *
 * The template uses v-memo on each item row with dependency arrays containing
 * only the properties displayed in that view mode. This prevents re-renders
 * when other properties change (e.g., table row only re-renders when
 * id/name/mimeType/size/mdate/photo fields change, not on unrelated prop changes).
 */
const hasPhotoItems = computed(() => {
  const itemsToCheck = props.items.length > PHOTO_CHECK_SAMPLE_SIZE
    ? props.items.slice(0, PHOTO_CHECK_SAMPLE_SIZE)
    : props.items
  return itemsToCheck.some(item => item.photo)
})

// Helper functions
function getIcon(item: SearchResource): string {
  return getFileIcon(item.mimeType, item.isFolder || item.type === 'folder')
}

function getPath(item: SearchResource): string {
  const path = item.path || item.name || ''
  const parts = path.split('/')
  parts.pop() // Remove filename
  return parts.join('/') || '/'
}

function getCameraInfo(item: SearchResource): string {
  if (!item.photo) return '—'
  const make = item.photo.cameraMake || ''
  const model = item.photo.cameraModel || ''
  if (make && model) return `${make} ${model}`
  return make || model || '—'
}

function getPhotoDate(item: SearchResource): string {
  if (!item.photo?.takenDateTime) return '—'
  return formatDate(item.photo.takenDateTime, undefined, getUserLocale())
}
</script>

<style scoped>
.search-results {
  flex: 1;
  overflow: auto;
}

/* List View */
.results-list {
  display: flex;
  flex-direction: column;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--oc-color-border, #eee);
  cursor: pointer;
}

.list-item:hover {
  background: var(--oc-color-background-hover, #f5f5f5);
}

.item-icon {
  font-size: 1.25rem;
}

.item-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.item-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-path {
  font-size: 0.75rem;
  color: var(--oc-color-text-muted, #888);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-size,
.item-date {
  font-size: 0.8125rem;
  color: var(--oc-color-text-muted, #666);
  white-space: nowrap;
}

.item-size {
  width: 80px;
  text-align: right;
}

.item-date {
  width: 100px;
  text-align: right;
}

/* Grid View */
.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
}

.grid-item:hover {
  background: var(--oc-color-background-hover, #f5f5f5);
}

.grid-thumbnail {
  position: relative;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--oc-color-background-muted, #f0f0f0);
  border-radius: 4px;
  overflow: hidden;
}

.grid-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.grid-icon {
  font-size: 2.5rem;
}

.grid-name {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Table View */
.results-table th,
.results-table td {
  padding: 0.75rem 1rem;
  text-align: left;
}

.results-table th {
  position: sticky;
  top: 0;
}

.results-table tr {
  cursor: pointer;
}

.cell-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cell-name .item-icon {
  font-size: 1rem;
}

.cell-path {
  font-size: 0.8125rem;
  color: var(--oc-color-text-muted, #888);
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Menu button styling */
.item-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 4px;
  cursor: pointer;
  color: var(--oc-color-text-muted, #666);
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}

.item-menu-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.list-item:hover .item-menu-btn,
.results-table tr:hover .item-menu-btn {
  opacity: 1;
}

.item-menu-btn:hover {
  background: var(--oc-color-background-muted, #e0e0e0);
  color: var(--oc-color-text-default, #333);
}

.grid-menu-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  background: var(--oc-color-background-default, rgba(255, 255, 255, 0.9));
  border-radius: 4px;
  cursor: pointer;
  color: var(--oc-color-text-muted, #666);
  opacity: 0;
  transition: opacity 0.15s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.grid-menu-btn svg {
  width: 1rem;
  height: 1rem;
}

.grid-item:hover .grid-menu-btn {
  opacity: 1;
}

.grid-menu-btn:hover {
  background: var(--oc-color-background-default, #fff);
  color: var(--oc-color-text-default, #333);
}

/* Table actions column */
.th-actions {
  width: 48px;
}

.cell-actions {
  width: 48px;
  text-align: center;
}

</style>
