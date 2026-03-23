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
        <oc-icon name="arrow-right-s" size="small" class="section-toggle-icon" :class="{ 'section-toggle-icon-open': showStandard }" /> {{ $gettext('Standard Filters') }}
      </h4>
      
      <div v-if="showStandard" id="standard-filters" class="filter-group">
        <!-- Dropdown selectors row: Type, Media Type, Tags -->
        <div class="filter-row-inline">
          <FilterSelect
            :model-value="filters.standard.type || ''"
            :options="typeOptions"
            :label="$gettext('Type')"
            default-value=""
            :aria-label="$gettext('File type filter')"
            @update:model-value="(v: string | number) => emit('update:standard', { ...filters.standard, type: (v as '' | 'file' | 'folder') })"
          />
          <FilterSelect
            :model-value="filters.standard.mediaType || ''"
            :options="mediaTypeOptions"
            :label="$gettext('Media Type')"
            default-value=""
            allow-custom
            :custom-placeholder="$gettext('Type or select media type')"
            :aria-label="$gettext('Media type filter')"
            @update:model-value="(v: string | number) => emit('update:standard', { ...filters.standard, mediaType: (String(v) || undefined) })"
          />
          <FilterSelect
            :model-value="filters.standard.tags || ''"
            :options="tagOptions"
            :label="$gettext('Tags')"
            default-value=""
            allow-custom
            :custom-placeholder="$gettext('Type or select tag')"
            :aria-label="$gettext('Tags filter')"
            @update:model-value="(v: string | number) => emit('update:standard', { ...filters.standard, tags: (String(v) || undefined) })"
          />
        </div>

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

        <!-- Range fields: Size and Modified side by side, vertically stacked -->
        <div class="filter-ranges">
          <div class="filter-row">
            <label for="filter-size-min">{{ $gettext('Size') }}</label>
            <div class="range-inputs-vertical">
              <input
                id="filter-size-min"
                type="text"
                :value="formatSizeDisplay(filters.standard.sizeRange?.min)"
                :placeholder="$gettext('Min (e.g. 1M)')"
                @change="updateSizeRange('min', ($event.target as HTMLInputElement).value)"
                @keyup.enter="emit('search')"
              />
              <span class="range-separator">{{ $gettext('to') }}</span>
              <input
                id="filter-size-max"
                type="text"
                :value="formatSizeDisplay(filters.standard.sizeRange?.max)"
                :placeholder="$gettext('Max (e.g. 10M)')"
                :aria-label="$gettext('Size maximum')"
                @change="updateSizeRange('max', ($event.target as HTMLInputElement).value)"
                @keyup.enter="emit('search')"
              />
            </div>
          </div>

          <div class="filter-row">
            <label for="filter-modified-start">{{ $gettext('Modified') }}</label>
            <div class="range-inputs-vertical">
              <input
                id="filter-modified-start"
                type="date"
                max="9999-12-31"
                :value="filters.standard.modifiedRange?.start || ''"
                @change="updateModifiedRange('start', ($event.target as HTMLInputElement).value)"
                @keyup.enter="emit('search')"
              />
              <span class="range-separator">{{ $gettext('to') }}</span>
              <input
                id="filter-modified-end"
                type="date"
                max="9999-12-31"
                :value="filters.standard.modifiedRange?.end || ''"
                :aria-label="$gettext('Modified date end')"
                @change="updateModifiedRange('end', ($event.target as HTMLInputElement).value)"
                @keyup.enter="emit('search')"
              />
            </div>
          </div>
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
        <oc-icon name="arrow-right-s" size="small" class="section-toggle-icon" :class="{ 'section-toggle-icon-open': showPhoto }" /> {{ $gettext('Photo / EXIF Filters') }}
      </h4>

      <div v-if="showPhoto" id="photo-filters" class="filter-group">
        <!-- Error message for camera data fetch -->
        <div v-if="photoDataError" class="photo-data-error">
          {{ photoDataError }}
        </div>

        <!-- Dropdown selectors row: Camera Make, Camera Model -->
        <div class="filter-row-inline">
          <FilterSelect
            :model-value="filters.photo.cameraMake || ''"
            :options="cameraMakeOptions"
            :label="$gettext('Camera Make')"
            default-value=""
            allow-custom
            :custom-placeholder="$gettext('Type or select camera make')"
            :aria-label="$gettext('Camera make filter')"
            @update:model-value="(v: string | number) => emit('update:photo', { ...filters.photo, cameraMake: (String(v) || undefined) })"
          />
          <FilterSelect
            :model-value="filters.photo.cameraModel || ''"
            :options="cameraModelOptions"
            :label="$gettext('Camera Model')"
            default-value=""
            allow-custom
            :custom-placeholder="$gettext('Type or select camera model')"
            :aria-label="$gettext('Camera model filter')"
            @update:model-value="(v: string | number) => emit('update:photo', { ...filters.photo, cameraModel: (String(v) || undefined) })"
          />
        </div>

        <!-- Image Caption (AI-generated) — only shown when backend has caption data -->
        <div v-if="captionSearchAvailable" class="filter-row">
          <label for="filter-caption">{{ $gettext('Image Caption') }}</label>
          <input
            id="filter-caption"
            type="text"
            :value="filters.photo.objectCaption || ''"
            :placeholder="$gettext('e.g., a dog sitting on a beach')"
            @input="emit('update:photo', { ...filters.photo, objectCaption: ($event.target as HTMLInputElement).value || undefined })"
            @keyup.enter="emit('search')"
          />
        </div>

        <!-- Object Detection Label — only shown when backend has caption data -->
        <div v-if="captionSearchAvailable" class="filter-row">
          <label for="filter-object-label">{{ $gettext('Object Detection') }}</label>
          <input
            id="filter-object-label"
            type="text"
            :value="filters.photo.objectLabel || ''"
            :placeholder="$gettext('e.g., dog, car, person')"
            @input="emit('update:photo', { ...filters.photo, objectLabel: ($event.target as HTMLInputElement).value || undefined })"
            @keyup.enter="emit('search')"
          />
        </div>

        <!-- Range fields: Date Taken, ISO, Aperture, Focal Length — vertically stacked -->
        <div class="filter-ranges">
          <div class="filter-row">
            <label for="filter-date-taken-start">{{ $gettext('Date Taken') }}</label>
            <div class="range-inputs-vertical">
              <input
                id="filter-date-taken-start"
                type="date"
                max="9999-12-31"
                :value="filters.photo.takenDateRange?.start || ''"
                @change="updateTakenDateRange('start', ($event.target as HTMLInputElement).value)"
                @keyup.enter="emit('search')"
              />
              <span class="range-separator">{{ $gettext('to') }}</span>
              <input
                id="filter-date-taken-end"
                type="date"
                max="9999-12-31"
                :value="filters.photo.takenDateRange?.end || ''"
                :aria-label="$gettext('Date taken end')"
                @change="updateTakenDateRange('end', ($event.target as HTMLInputElement).value)"
                @keyup.enter="emit('search')"
              />
            </div>
          </div>

          <div class="filter-row">
            <label for="filter-iso-min">{{ $gettext('ISO') }}</label>
            <div class="range-inputs-vertical">
              <input
                id="filter-iso-min"
                type="number"
                min="0"
                :value="filters.photo.isoRange?.min || ''"
                :placeholder="$gettext('Min')"
                @input="updateIsoRange('min', ($event.target as HTMLInputElement).value)"
                @keyup.enter="emit('search')"
              />
              <span class="range-separator">{{ $gettext('to') }}</span>
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

          <div class="filter-row">
            <label for="filter-aperture-min">{{ $gettext('Aperture (f/)') }}</label>
            <div class="range-inputs-vertical">
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
              <span class="range-separator">{{ $gettext('to') }}</span>
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

          <div class="filter-row">
            <label for="filter-focal-length-min">{{ $gettext('Focal Length (mm)') }}</label>
            <div class="range-inputs-vertical">
              <input
                id="filter-focal-length-min"
                type="number"
                min="0"
                :value="filters.photo.focalLengthRange?.min || ''"
                :placeholder="$gettext('Min')"
                @input="updateFocalLengthRange('min', ($event.target as HTMLInputElement).value)"
                @keyup.enter="emit('search')"
              />
              <span class="range-separator">{{ $gettext('to') }}</span>
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
        <oc-icon name="arrow-right-s" size="small" class="section-toggle-icon" :class="{ 'section-toggle-icon-open': showKQL }" /> {{ $gettext('KQL Query') }}
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
            type="button"
            class="oc-button oc-rounded oc-button-s oc-button-justify-content-center oc-button-gap-m oc-button-primary oc-button-primary-filled"
            :title="$gettext('Parse KQL and populate filters')"
            @click="emit('apply-kql')"
          >
            <span>{{ $gettext('Apply to Filters') }}</span>
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
import { ref, computed, watch, onMounted } from 'vue'
import type { SearchFilters } from '../types'
import { KNOWN_CAMERA_MAKES, COMMON_MEDIA_TYPES } from '../types'
import { useTranslations } from '../composables/useTranslations'
import FilterSelect from './FilterSelect.vue'

const { $gettext } = useTranslations()

const props = defineProps<{
  filters: SearchFilters
  fetchCameraMakes?: () => Promise<string[]>
  fetchCameraModels?: () => Promise<string[]>
  captionSearchAvailable?: boolean
  fetchTags?: () => Promise<string[]>
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

// Tags from Graph API
const discoveredTags = ref<string[]>([])
const loadingTags = ref(false)

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

// FilterSelect option arrays
const typeOptions = computed(() => [
  { value: '', label: $gettext('All') },
  { value: 'file', label: $gettext('Files only') },
  { value: 'folder', label: $gettext('Folders only') },
])

const mediaTypeIconConfig: Record<string, { icon: string; color: string }> = {
  '': { icon: 'resource-type-file', color: 'var(--oc-color-text-muted)' },
  'image': { icon: 'resource-type-image', color: 'var(--oc-color-icon-image)' },
  'video': { icon: 'resource-type-video', color: 'var(--oc-color-icon-video)' },
  'audio': { icon: 'resource-type-audio', color: 'var(--oc-color-icon-audio)' },
  'document': { icon: 'resource-type-document', color: 'var(--oc-color-icon-document)' },
  'spreadsheet': { icon: 'resource-type-spreadsheet', color: 'var(--oc-color-icon-spreadsheet)' },
  'presentation': { icon: 'resource-type-presentation', color: 'var(--oc-color-icon-presentation)' },
  'pdf': { icon: 'resource-type-pdf', color: 'var(--oc-color-icon-pdf)' },
  'archive': { icon: 'resource-type-archive', color: 'var(--oc-color-icon-archive)' },
  'folder': { icon: 'resource-type-folder', color: 'var(--oc-color-icon-folder)' },
}

const mediaTypeOptions = computed(() =>
  mediaTypes.map(mt => {
    const cfg = mediaTypeIconConfig[mt.value] || mediaTypeIconConfig['']
    return { value: mt.value, label: mt.label, icon: cfg.icon, iconColor: cfg.color }
  })
)

const tagOptions = computed(() => [
  { value: '', label: $gettext('Any'), icon: 'price-tag-3', iconColor: 'var(--oc-color-text-muted)' },
  ...discoveredTags.value.map(tag => ({ value: tag, label: tag, icon: 'price-tag-3', iconColor: 'var(--oc-color-swatch-primary-default)' })),
])

const cameraMakeOptions = computed(() => [
  { value: '', label: $gettext('Any') },
  ...cameraMakes.value.map(make => ({ value: make, label: make })),
])

const cameraModelOptions = computed(() => [
  { value: '', label: $gettext('Any') },
  ...cameraModels.value.map(model => ({ value: model, label: model })),
])

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

// Fetch tags on mount (standard section is open by default)
onMounted(async () => {
  if (!loadingTags.value && discoveredTags.value.length === 0) {
    loadingTags.value = true
    try {
      discoveredTags.value = await (props.fetchTags?.() ?? Promise.resolve([]))
    } catch (err) {
      console.error('[SearchFilters] Failed to fetch tags:', err)
    } finally {
      loadingTags.value = false
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

  if (category === 'standard') {
    emit('update:standard', { ...props.filters.standard, [rangeKey]: updated })
  } else {
    emit('update:photo', { ...props.filters.photo, [rangeKey]: updated })
  }
}

/**
 * Parse human-readable size input (e.g., "1M", "500K", "2G") into bytes.
 * Falls back to plain number parsing for raw byte values.
 */
function parseSizeInput(value: string): string {
  const trimmed = value.trim().toUpperCase()
  if (!trimmed) return ''
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?)B?$/i)
  if (match) {
    const num = parseFloat(match[1])
    const unit = match[2]
    const multipliers: Record<string, number> = { '': 1, 'K': 1024, 'M': 1048576, 'G': 1073741824, 'T': 1099511627776 }
    return String(Math.round(num * (multipliers[unit] || 1)))
  }
  // If it's already a plain number, return as-is
  const num = parseFloat(trimmed)
  return isNaN(num) ? '' : String(Math.round(num))
}

/**
 * Format bytes back to human-readable shorthand for display in the input.
 */
function formatSizeDisplay(bytes: number | string | undefined): string {
  if (bytes === undefined || bytes === '') return ''
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes
  if (isNaN(num) || num === 0) return num === 0 ? '0' : ''
  if (num >= 1073741824 && num % 1073741824 === 0) return `${num / 1073741824}G`
  if (num >= 1048576 && num % 1048576 === 0) return `${num / 1048576}M`
  if (num >= 1024 && num % 1024 === 0) return `${num / 1024}K`
  return String(num)
}

// Convenience wrappers for template readability
const updateSizeRange = (field: 'min' | 'max', value: string) =>
  updateRange('standard', 'sizeRange', field, parseSizeInput(value), 'numeric')

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
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.section-toggle-icon {
  transition: transform 0.2s ease;
}

.section-toggle-icon-open {
  transform: rotate(90deg);
}

.section-title:hover {
  color: var(--oc-color-primary, #0066cc);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.filter-row-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.filter-row-inline > * {
  flex: 1 1 150px;
  min-width: 0;
  max-width: 220px;
}

.filter-ranges {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 220px));
  gap: 1rem;
}

.range-inputs-vertical {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.range-inputs-vertical input {
  width: 100%;
  box-sizing: border-box;
  height: 2.125rem;
}

.range-separator {
  font-size: 0.75rem;
  color: var(--oc-color-text-muted, #999);
  text-align: left;
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

.filter-row input {
  padding: 0.5rem;
  border: 1px solid var(--oc-color-border, #ddd);
  color: inherit;
  border-radius: 4px;
  font-size: 0.875rem;
  background: var(--oc-color-background-default, #fff);
}

.filter-row input:focus {
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

.kql-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--oc-color-text-muted, #888);
}

.photo-data-error {
  grid-column: 1 / -1;
  padding: 0.5rem 0.75rem;
  background: var(--oc-color-swatch-warning-muted, #fff3cd);
  border: 1px solid var(--oc-color-swatch-warning-default, #ffc107);
  border-radius: 4px;
  color: var(--oc-color-swatch-warning-default, #856404);
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
