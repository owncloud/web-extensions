<template>
  <div class="search-filters" role="search" :aria-label="$gettext('Search filters')">
    <!-- Standard Filters Section -->
    <div class="filter-section">
      <h4
        class="section-title"
        role="button"
        tabindex="0"
        :aria-expanded="showStandard"
        aria-controls="standard-filters"
        @click="showStandard = !showStandard"
        @keydown.enter="showStandard = !showStandard"
        @keydown.space.prevent="showStandard = !showStandard"
      >
        <span aria-hidden="true">{{ showStandard ? '▼' : '▶' }}</span> {{ $gettext('Standard Filters') }}
      </h4>
      
      <div v-if="showStandard" id="standard-filters" class="filter-group">
        <!-- Name -->
        <div class="filter-row">
          <label for="filter-name">{{ $gettext('Name') }}</label>
          <input
            id="filter-name"
            type="text"
            :value="filters.standard.name || ''"
            :placeholder="$gettext('File name (wildcards: * ?)')"
            @input="emit('update:standard', { ...filters.standard, name: ($event.target as HTMLInputElement).value || undefined })"
            @keyup.enter="emit('search')"
          />
        </div>

        <!-- Type -->
        <div class="filter-row">
          <label for="filter-type">{{ $gettext('Type') }}</label>
          <select
            id="filter-type"
            :value="filters.standard.type || ''"
            @change="emit('update:standard', { ...filters.standard, type: ($event.target as HTMLSelectElement).value as '' | 'file' | 'folder' })"
          >
            <option value="">{{ $gettext('All') }}</option>
            <option value="file">{{ $gettext('Files only') }}</option>
            <option value="folder">{{ $gettext('Folders only') }}</option>
          </select>
        </div>

        <!-- Media Type -->
        <div class="filter-row">
          <label for="filter-media-type">{{ $gettext('Media Type') }}</label>
          <select
            id="filter-media-type"
            :value="filters.standard.mediaType || ''"
            @change="emit('update:standard', { ...filters.standard, mediaType: ($event.target as HTMLSelectElement).value || undefined })"
          >
            <option v-for="mt in mediaTypes" :key="mt.value" :value="mt.value">
              {{ mt.label }}
            </option>
          </select>
        </div>

        <!-- Size Range -->
        <div class="filter-row">
          <label for="filter-size-min">{{ $gettext('Size') }}</label>
          <div class="range-inputs">
            <input
              id="filter-size-min"
              type="number"
              min="0"
              :value="filters.standard.sizeRange?.min || ''"
              :placeholder="$gettext('Min (bytes)')"
              @input="updateSizeRange('min', ($event.target as HTMLInputElement).value)"
              @keyup.enter="emit('search')"
            />
            <span>{{ $gettext('to') }}</span>
            <input
              id="filter-size-max"
              type="number"
              min="0"
              :value="filters.standard.sizeRange?.max || ''"
              :placeholder="$gettext('Max (bytes)')"
              :aria-label="$gettext('Size maximum')"
              @input="updateSizeRange('max', ($event.target as HTMLInputElement).value)"
              @keyup.enter="emit('search')"
            />
          </div>
        </div>

        <!-- Modified Date -->
        <div class="filter-row">
          <label for="filter-modified-start">{{ $gettext('Modified') }}</label>
          <div class="range-inputs">
            <input
              id="filter-modified-start"
              type="date"
              :value="filters.standard.modifiedRange?.start || ''"
              @input="updateModifiedRange('start', ($event.target as HTMLInputElement).value)"
              @keyup.enter="emit('search')"
            />
            <span>{{ $gettext('to') }}</span>
            <input
              id="filter-modified-end"
              type="date"
              :value="filters.standard.modifiedRange?.end || ''"
              :aria-label="$gettext('Modified date end')"
              @input="updateModifiedRange('end', ($event.target as HTMLInputElement).value)"
              @keyup.enter="emit('search')"
            />
          </div>
        </div>

        <!-- Tags -->
        <div class="filter-row">
          <label for="filter-tags">{{ $gettext('Tags') }}</label>
          <input
            id="filter-tags"
            type="text"
            :value="filters.standard.tags || ''"
            :placeholder="$gettext('Comma-separated tags')"
            @input="emit('update:standard', { ...filters.standard, tags: ($event.target as HTMLInputElement).value || undefined })"
            @keyup.enter="emit('search')"
          />
        </div>

        <!-- Content -->
        <div class="filter-row">
          <label for="filter-content">{{ $gettext('Content') }}</label>
          <input
            id="filter-content"
            type="text"
            :value="filters.standard.content || ''"
            :placeholder="$gettext('Full-text content search')"
            @input="emit('update:standard', { ...filters.standard, content: ($event.target as HTMLInputElement).value || undefined })"
            @keyup.enter="emit('search')"
          />
        </div>
      </div>
    </div>

    <!-- Photo/EXIF Filters Section -->
    <div class="filter-section">
      <h4
        class="section-title"
        role="button"
        tabindex="0"
        :aria-expanded="showPhoto"
        aria-controls="photo-filters"
        @click="showPhoto = !showPhoto"
        @keydown.enter="showPhoto = !showPhoto"
        @keydown.space.prevent="showPhoto = !showPhoto"
      >
        <span aria-hidden="true">{{ showPhoto ? '▼' : '▶' }}</span> {{ $gettext('Photo / EXIF Filters') }}
      </h4>

      <div v-if="showPhoto" id="photo-filters" class="filter-group">
        <!-- Error message for camera data fetch -->
        <div v-if="photoDataError" class="photo-data-error">
          {{ photoDataError }}
        </div>

        <!-- Camera Make -->
        <div class="filter-row">
          <label for="filter-camera-make">{{ $gettext('Camera Make') }}</label>
          <select
            id="filter-camera-make"
            :value="filters.photo.cameraMake || ''"
            @change="emit('update:photo', { ...filters.photo, cameraMake: ($event.target as HTMLSelectElement).value || undefined })"
          >
            <option value="">{{ $gettext('Any') }}</option>
            <option v-for="make in cameraMakes" :key="make" :value="make">{{ make }}</option>
          </select>
        </div>

        <!-- Camera Model -->
        <div class="filter-row">
          <label for="filter-camera-model">{{ $gettext('Camera Model') }}</label>
          <select
            id="filter-camera-model"
            :value="filters.photo.cameraModel || ''"
            @change="emit('update:photo', { ...filters.photo, cameraModel: ($event.target as HTMLSelectElement).value || undefined })"
          >
            <option value="">{{ $gettext('Any') }}</option>
            <option v-for="model in cameraModels" :key="model" :value="model">{{ model }}</option>
          </select>
        </div>

        <!-- Date Taken -->
        <div class="filter-row">
          <label for="filter-date-taken-start">{{ $gettext('Date Taken') }}</label>
          <div class="range-inputs">
            <input
              id="filter-date-taken-start"
              type="date"
              :value="filters.photo.takenDateRange?.start || ''"
              @input="updateTakenDateRange('start', ($event.target as HTMLInputElement).value)"
              @keyup.enter="emit('search')"
            />
            <span>{{ $gettext('to') }}</span>
            <input
              id="filter-date-taken-end"
              type="date"
              :value="filters.photo.takenDateRange?.end || ''"
              :aria-label="$gettext('Date taken end')"
              @input="updateTakenDateRange('end', ($event.target as HTMLInputElement).value)"
              @keyup.enter="emit('search')"
            />
          </div>
        </div>

        <!-- ISO -->
        <div class="filter-row">
          <label for="filter-iso-min">{{ $gettext('ISO') }}</label>
          <div class="range-inputs">
            <input
              id="filter-iso-min"
              type="number"
              min="0"
              :value="filters.photo.isoRange?.min || ''"
              :placeholder="$gettext('Min')"
              @input="updateIsoRange('min', ($event.target as HTMLInputElement).value)"
              @keyup.enter="emit('search')"
            />
            <span>{{ $gettext('to') }}</span>
            <input
              id="filter-iso-max"
              type="number"
              min="0"
              :value="filters.photo.isoRange?.max || ''"
              :placeholder="$gettext('Max')"
              :aria-label="$gettext('ISO maximum')"
              @input="updateIsoRange('max', ($event.target as HTMLInputElement).value)"
              @keyup.enter="emit('search')"
            />
          </div>
        </div>

        <!-- Aperture -->
        <div class="filter-row">
          <label for="filter-aperture-min">{{ $gettext('Aperture (f/)') }}</label>
          <div class="range-inputs">
            <input
              id="filter-aperture-min"
              type="number"
              step="0.1"
              min="0"
              :value="filters.photo.fNumberRange?.min || ''"
              :placeholder="$gettext('Min')"
              @input="updateFNumberRange('min', ($event.target as HTMLInputElement).value)"
              @keyup.enter="emit('search')"
            />
            <span>{{ $gettext('to') }}</span>
            <input
              id="filter-aperture-max"
              type="number"
              step="0.1"
              min="0"
              :value="filters.photo.fNumberRange?.max || ''"
              :placeholder="$gettext('Max')"
              :aria-label="$gettext('Aperture maximum')"
              @input="updateFNumberRange('max', ($event.target as HTMLInputElement).value)"
              @keyup.enter="emit('search')"
            />
          </div>
        </div>

        <!-- Focal Length -->
        <div class="filter-row">
          <label for="filter-focal-length-min">{{ $gettext('Focal Length (mm)') }}</label>
          <div class="range-inputs">
            <input
              id="filter-focal-length-min"
              type="number"
              min="0"
              :value="filters.photo.focalLengthRange?.min || ''"
              :placeholder="$gettext('Min')"
              @input="updateFocalLengthRange('min', ($event.target as HTMLInputElement).value)"
              @keyup.enter="emit('search')"
            />
            <span>{{ $gettext('to') }}</span>
            <input
              id="filter-focal-length-max"
              type="number"
              min="0"
              :value="filters.photo.focalLengthRange?.max || ''"
              :placeholder="$gettext('Max')"
              :aria-label="$gettext('Focal length maximum')"
              @input="updateFocalLengthRange('max', ($event.target as HTMLInputElement).value)"
              @keyup.enter="emit('search')"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- KQL Query Section -->
    <div class="filter-section">
      <h4
        class="section-title"
        role="button"
        tabindex="0"
        :aria-expanded="showKQL"
        aria-controls="kql-section"
        @click="showKQL = !showKQL"
        @keydown.enter="showKQL = !showKQL"
        @keydown.space.prevent="showKQL = !showKQL"
      >
        <span aria-hidden="true">{{ showKQL ? '▼' : '▶' }}</span> {{ $gettext('KQL Query') }}
      </h4>

      <div v-if="showKQL" id="kql-section" class="kql-group">
        <div class="kql-input-row">
          <input
            id="filter-kql-query"
            type="text"
            class="kql-input"
            :value="kqlQuery"
            :placeholder="$gettext('Enter KQL query (e.g., name:*.pdf AND mediatype:document)')"
            :aria-label="$gettext('KQL Query')"
            @input="emit('kql-input', ($event.target as HTMLInputElement).value)"
            @keyup.enter="emit('search')"
          />
          <button
            class="kql-apply-btn"
            :title="$gettext('Parse KQL and populate filters')"
            @click="emit('apply-kql')"
          >
            ↑ {{ $gettext('Apply to Filters') }}
          </button>
        </div>
        <p class="kql-hint">
          {{ $gettext('Paste or type KQL directly. Click "Apply to Filters" to populate filter fields.') }}
        </p>
      </div>
    </div>
  </div>
</template>

<!--
  Type Assertion Note:

  Throughout this template, you'll see type assertions like:
    ($event.target as HTMLInputElement).value
    ($event.target as HTMLSelectElement).value

  These are necessary because Vue's event typing provides $event.target as
  generic EventTarget type. TypeScript can't infer from the template that
  it's specifically an input or select element, so we must cast explicitly
  to access .value property.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { SearchFilters } from '../types'
import { KNOWN_CAMERA_MAKES, COMMON_MEDIA_TYPES } from '../types'
import { useTranslations } from '../composables/useTranslations'

const { $gettext } = useTranslations()

const props = defineProps<{
  filters: SearchFilters
  fetchCameraMakes?: () => Promise<string[]>
  fetchCameraModels?: () => Promise<string[]>
  kqlQuery?: string
}>()

const emit = defineEmits<{
  (e: 'update:standard', value: SearchFilters['standard']): void
  (e: 'update:photo', value: SearchFilters['photo']): void
  (e: 'search'): void
  (e: 'kql-input', value: string): void
  (e: 'apply-kql'): void
}>()

// Local state for section collapse
const showStandard = ref(true)
const showPhoto = ref(false)
const showKQL = ref(true)

// Camera makes/models from search index
const discoveredCameraMakes = ref<string[]>([])
const discoveredCameraModels = ref<string[]>([])
const loadingPhotoData = ref(false)
const photoDataError = ref<string | null>(null)

// Merge static and discovered camera makes
const cameraMakes = computed(() => {
  const all = new Set([...KNOWN_CAMERA_MAKES, ...discoveredCameraMakes.value])
  return Array.from(all).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
})

// Camera models (only from search, no static list)
const cameraModels = computed(() => {
  return [...discoveredCameraModels.value].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
})

const mediaTypes = COMMON_MEDIA_TYPES

// Fetch camera makes and models when photo section is expanded
// Check loadingPhotoData to prevent duplicate concurrent requests
watch(showPhoto, async (isShown) => {
  if (isShown && discoveredCameraMakes.value.length === 0 && !loadingPhotoData.value) {
    loadingPhotoData.value = true
    photoDataError.value = null
    try {
      // Fetch both in parallel with individual error handling
      const [makesResult, modelsResult] = await Promise.allSettled([
        props.fetchCameraMakes?.() ?? Promise.resolve([]),
        props.fetchCameraModels?.() ?? Promise.resolve([])
      ])

      if (makesResult.status === 'fulfilled') {
        discoveredCameraMakes.value = makesResult.value
      } else {
        console.error('[SearchFilters] Failed to fetch camera makes:', makesResult.reason)
      }

      if (modelsResult.status === 'fulfilled') {
        discoveredCameraModels.value = modelsResult.value
      } else {
        console.error('[SearchFilters] Failed to fetch camera models:', modelsResult.reason)
      }

      // Set error if both failed
      if (makesResult.status === 'rejected' && modelsResult.status === 'rejected') {
        photoDataError.value = 'Failed to load camera data. Autocomplete may be limited.'
      }
    } catch (err) {
      console.error('[SearchFilters] Unexpected error fetching camera data:', err)
      photoDataError.value = 'Failed to load camera data. Autocomplete may be limited.'
    } finally {
      loadingPhotoData.value = false
    }
  }
})

// Type-safe range update helper
type RangeType = 'numeric' | 'float' | 'date'

// Valid range keys for each filter category
type StandardRangeKey = 'sizeRange' | 'modifiedRange'
type PhotoRangeKey = 'takenDateRange' | 'isoRange' | 'fNumberRange' | 'focalLengthRange'

// Overloaded function signatures for type safety
function updateRange(
  category: 'standard',
  rangeKey: StandardRangeKey,
  field: 'min' | 'max' | 'start' | 'end',
  value: string,
  type?: RangeType
): void
function updateRange(
  category: 'photo',
  rangeKey: PhotoRangeKey,
  field: 'min' | 'max' | 'start' | 'end',
  value: string,
  type?: RangeType
): void
function updateRange(
  category: 'standard' | 'photo',
  rangeKey: StandardRangeKey | PhotoRangeKey,
  field: 'min' | 'max' | 'start' | 'end',
  value: string,
  type: RangeType = 'numeric'
): void {
  const filters = category === 'standard' ? props.filters.standard : props.filters.photo
  // Type assertion is safe here because rangeKey is constrained by the overload signatures
  const current = (filters as Record<string, unknown>)[rangeKey] as Record<string, unknown> | undefined
    || (type === 'date' ? { start: '', end: '' } : {})

  let parsedValue: string | number | undefined
  if (type === 'date') {
    parsedValue = value || ''
  } else if (type === 'float') {
    parsedValue = value ? parseFloat(value) : undefined
  } else {
    parsedValue = value ? parseInt(value, 10) : undefined
  }

  const updated = { ...current, [field]: parsedValue }

  // Validate date ranges: auto-swap if start > end
  if (type === 'date' && updated.start && updated.end) {
    const startDate = new Date(updated.start as string)
    const endDate = new Date(updated.end as string)
    if (startDate > endDate) {
      // Swap the values
      const temp = updated.start
      updated.start = updated.end
      updated.end = temp
    }
  }

  if (category === 'standard') {
    emit('update:standard', { ...props.filters.standard, [rangeKey]: updated })
  } else {
    emit('update:photo', { ...props.filters.photo, [rangeKey]: updated })
  }
}

// Convenience wrappers for template readability
const updateSizeRange = (field: 'min' | 'max', value: string) =>
  updateRange('standard', 'sizeRange', field, value, 'numeric')

const updateModifiedRange = (field: 'start' | 'end', value: string) =>
  updateRange('standard', 'modifiedRange', field, value, 'date')

const updateTakenDateRange = (field: 'start' | 'end', value: string) =>
  updateRange('photo', 'takenDateRange', field, value, 'date')

const updateIsoRange = (field: 'min' | 'max', value: string) =>
  updateRange('photo', 'isoRange', field, value, 'numeric')

const updateFNumberRange = (field: 'min' | 'max', value: string) =>
  updateRange('photo', 'fNumberRange', field, value, 'float')

const updateFocalLengthRange = (field: 'min' | 'max', value: string) =>
  updateRange('photo', 'focalLengthRange', field, value, 'float')
</script>

<style scoped>
.search-filters {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.filter-section {
  border-bottom: 1px solid var(--oc-color-border, #e0e0e0);
  padding-bottom: 1rem;
}

.filter-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.section-title {
  margin: 0 0 0.75rem 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--oc-color-text-default, #333);
  cursor: pointer;
  user-select: none;
}

.section-title:hover {
  color: var(--oc-color-primary, #0066cc);
}

.filter-group {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}

.filter-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.filter-row label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--oc-color-text-muted, #666);
}

.filter-row input,
.filter-row select {
  padding: 0.5rem;
  border: 1px solid var(--oc-color-border, #ddd);
  color: inherit;
  border-radius: 4px;
  font-size: 0.875rem;
}

.filter-row input {
  background: var(--oc-color-background-default, #fff);
}

.filter-row select {
  background: var(--oc-color-background-default, #fff);
}

.filter-row input:focus,
.filter-row select:focus {
  outline: none;
  border-color: var(--oc-color-primary, #0066cc);
}

.range-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.range-inputs input {
  flex: 1;
  min-width: 0;
}

.range-inputs span {
  color: var(--oc-color-text-muted, #999);
  font-size: 0.8125rem;
}

/* KQL Section */
.kql-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.kql-input-row {
  display: flex;
  gap: 0.5rem;
}

.kql-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  font-family: monospace;
  font-size: 0.875rem;
  border: 1px solid var(--oc-color-border, #ddd);
  border-radius: 4px;
  background: var(--oc-color-background-default, #fff);
  color: var(--oc-color-text-default, #333);
}

.kql-input:focus {
  outline: none;
  border-color: var(--oc-color-primary, #0066cc);
}

.kql-apply-btn {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  background: var(--oc-color-primary, #0066cc);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}

.kql-apply-btn:hover {
  background: var(--oc-color-primary-hover, #0055aa);
}

.kql-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--oc-color-text-muted, #888);
}

.photo-data-error {
  grid-column: 1 / -1;
  padding: 0.5rem 0.75rem;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  color: #856404;
  font-size: 0.8125rem;
}

</style>

<!-- Unscoped: -webkit-autofill overrides must not have Vue scoped attribute selectors -->
<style>
.search-filters input:-webkit-autofill,
.search-filters input:-webkit-autofill:hover,
.search-filters input:-webkit-autofill:focus,
.search-filters input:-webkit-autofill:active {
  -webkit-text-fill-color: var(--oc-color-text-default, #333) !important;
  -webkit-box-shadow: 0 0 0px 1000px var(--oc-color-background-default, #fff) inset !important;
  transition: background-color 5000s ease-in-out 0s !important;
}
</style>
