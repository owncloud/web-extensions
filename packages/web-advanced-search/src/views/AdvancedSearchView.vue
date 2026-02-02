<template>
  <div class="advanced-search-app" role="main" :aria-label="$gettext('Advanced Search')">
    <!-- Header -->
    <div class="search-header">
      <h1>{{ $gettext('Advanced Search') }}</h1>
      <div class="header-actions">
        <button
          class="btn btn-secondary"
          :aria-expanded="showSavedQueries"
          @click="showSavedQueries = !showSavedQueries"
        >
          <span aria-hidden="true">📁</span> {{ $gettext('Saved Searches') }} ({{ savedQueries.length }})
        </button>
        <button
          v-if="activeFilters.length > 0"
          class="btn btn-secondary"
          @click="showSaveDialog = true"
        >
          <span aria-hidden="true">💾</span> {{ $gettext('Save Search') }}
        </button>
      </div>
    </div>

    <!-- Main search input -->
    <div class="search-bar">
      <div class="search-input-wrapper">
        <input
          id="advanced-search-input"
          v-model="searchTerm"
          type="text"
          class="search-input"
          :placeholder="$gettext('Search files... (or use filters below)')"
          :aria-label="$gettext('Search files')"
          @keyup.enter="handleSearch"
        />
        <button class="search-btn" :disabled="loading" @click="handleSearch">
          <span aria-hidden="true">{{ loading ? '⏳' : '🔍' }}</span> {{ $gettext('Search') }}
        </button>
      </div>
      <button
        class="toggle-filters-btn"
        :aria-expanded="showFilters"
        aria-controls="filters-panel"
        @click="showFilters = !showFilters"
      >
        <span aria-hidden="true">{{ showFilters ? '▼' : '▶' }}</span> {{ $gettext('Advanced') }}
      </button>
    </div>

    <!-- Active filter chips -->
    <div v-if="activeFilters.length > 0" class="active-filters" role="group" :aria-label="$gettext('Active filters')">
      <FilterChip
        v-for="filter in activeFilters"
        :key="filter.id"
        :filter="filter"
        @remove="removeFilter(filter.id)"
      />
      <button class="clear-all-btn" @click="clearFilters">
        {{ $gettext('Clear All') }}
      </button>
    </div>

    <!-- Filter panel (collapsible) -->
    <div v-if="showFilters" id="filters-panel" class="filters-panel">
      <SearchFilters
        :filters="state.filters"
        :fetch-camera-makes="fetchCameraMakes"
        :fetch-camera-models="fetchCameraModels"
        :kql-query="kqlQuery"
        @update:standard="updateStandardFilters"
        @update:photo="updatePhotoFilters"
        @search="handleSearch"
        @kql-input="onKqlInput"
        @apply-kql="applyKqlToFilters"
      />
    </div>

    <!-- Results section -->
    <div class="results-section" role="region" :aria-label="$gettext('Search results')">
      <!-- Results header -->
      <div v-if="state.results" class="results-header">
        <span class="results-count" role="status" aria-live="polite">
          {{ $ngettext('%{count} result', '%{count} results', state.results.totalCount ?? state.results.items.length).replace('%{count}', String(state.results.totalCount ?? state.results.items.length)) }}
        </span>
        <div class="view-controls">
          <button
            :class="['view-btn', { active: state.viewMode === 'list' }]"
            :title="$gettext('List view')"
            @click="setViewMode('list')"
          >
            ☰
          </button>
          <button
            :class="['view-btn', { active: state.viewMode === 'grid' }]"
            :title="$gettext('Grid view')"
            @click="setViewMode('grid')"
          >
            ⊞
          </button>
          <button
            :class="['view-btn', { active: state.viewMode === 'table' }]"
            :title="$gettext('Table view')"
            @click="setViewMode('table')"
          >
            ▦
          </button>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="loading-state">
        <span class="spinner"></span>
        {{ $gettext('Searching...') }}
      </div>

      <!-- Error state -->
      <div v-else-if="state.error" class="error-state">
        <div class="error-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <circle cx="12" cy="16" r="0.5" fill="currentColor" />
          </svg>
        </div>
        <h2 class="error-title">{{ errorTitle }}</h2>
        <p class="error-message">{{ state.error }}</p>
        <div v-if="errorSuggestions.length > 0" class="error-suggestions">
          <p class="suggestions-label">{{ $gettext('Things to try:') }}</p>
          <ul>
            <li v-for="(suggestion, index) in errorSuggestions" :key="index">{{ suggestion }}</li>
          </ul>
        </div>
        <button class="retry-button" @click="retrySearch">
          <span class="retry-icon">↻</span>
          {{ $gettext('Try Again') }}
        </button>
      </div>

      <!-- Empty state -->
      <div v-else-if="state.results && state.results.items.length === 0" class="empty-state">
        <span class="empty-icon">🔍</span>
        <p>{{ $gettext('No results found') }}</p>
        <p class="empty-hint">{{ $gettext('Try adjusting your search terms or filters') }}</p>
      </div>

      <!-- Results display -->
      <SearchResults
        v-else-if="state.results && state.results.items.length > 0"
        :items="state.results.items"
        :view-mode="state.viewMode"
        @item-click="handleItemClick"
        @context-menu="openContextMenu"
      />

      <!-- Load more -->
      <div v-if="state.results?.hasMore" class="load-more">
        <button class="btn btn-secondary" :disabled="loading" @click="loadMore">
          {{ $gettext('Load More') }}
        </button>
      </div>
    </div>

    <!-- Search Status -->
    <SearchStats />

    <!-- Saved queries sidebar -->
    <div v-if="showSavedQueries" class="saved-queries-panel">
      <div class="panel-header">
        <h3>{{ $gettext('Saved Searches') }}</h3>
        <button
          ref="savedQueriesCloseBtn"
          class="close-btn"
          :aria-label="$gettext('Close saved searches')"
          @click="showSavedQueries = false"
        >×</button>
      </div>
      <div v-if="savedQueries.length === 0" class="no-saved">
        <p>{{ $gettext('No saved searches yet') }}</p>
        <p class="hint">{{ $gettext('Create a search and click "Save Search" to save it.') }}</p>
      </div>
      <ul v-else class="saved-list" role="list">
        <li
          v-for="(query, index) in savedQueries"
          :key="query.id"
          class="saved-item"
          role="listitem"
        >
          <button
            :ref="el => { if (index === 0) firstSavedQueryBtn = el as HTMLButtonElement }"
            class="saved-name"
            @click="loadSavedQuery(query)"
          >
            {{ query.name }}
          </button>
          <span class="saved-date">{{ formatDate(query.savedAt) }}</span>
          <button class="delete-btn" @click="deleteQuery(query.id)">🗑️</button>
        </li>
      </ul>
    </div>

    <!-- Save dialog -->
    <div
      v-if="showSaveDialog"
      class="modal-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="$gettext('Save Search')"
      @click.self="showSaveDialog = false"
      @keydown.escape="showSaveDialog = false"
    >
      <div class="modal-dialog">
        <h3>{{ $gettext('Save Search') }}</h3>
        <input
          ref="saveQueryInput"
          v-model="saveQueryName"
          type="text"
          :placeholder="$gettext('Enter a name for this search')"
          :aria-label="$gettext('Search name')"
          class="save-input"
          @keyup.enter="handleSaveQuery"
        />
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showSaveDialog = false">
            {{ $gettext('Cancel') }}
          </button>
          <button
            class="btn btn-primary"
            :disabled="!saveQueryName.trim()"
            @click="handleSaveQuery"
          >
            {{ $gettext('Save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <ResultContextMenu
      :visible="contextMenuVisible"
      :item="contextMenuItem"
      :position="contextMenuPosition"
      @close="closeContextMenu"
      @action="handleContextAction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useAdvancedSearch } from '../composables/useAdvancedSearch'
import { useSearchHistory } from '../composables/useSearchHistory'
import { useTranslations } from '../composables/useTranslations'
import type { SavedQuery, SearchResource } from '../types'
import { formatDate, classifyError, debounce } from '../utils/format'
import SearchFilters from '../components/SearchFilters.vue'
import FilterChip from '../components/FilterChip.vue'
import SearchResults from '../components/SearchResults.vue'
import SearchStats from '../components/SearchStats.vue'
import ResultContextMenu from '../components/ResultContextMenu.vue'

// Translations
const { $gettext, $ngettext } = useTranslations()

// Props (for saved query route)
const props = defineProps<{
  queryId?: string
}>()

// Composables
const {
  state,
  kqlQuery,
  activeFilters,
  executeSearch,
  loadMore,
  clearFilters,
  removeFilter,
  setViewMode,
  updateStandardFilters,
  updatePhotoFilters,
  setKqlQuery,
  parseKqlToFilters,
  fetchCameraMakes,
  fetchCameraModels,
} = useAdvancedSearch()

const {
  savedQueries,
  saveQuery,
  deleteQuery,
  getQuery,
} = useSearchHistory()

// Local state
const searchTerm = ref('')
const showFilters = ref(true)
const showSavedQueries = ref(false)
const showSaveDialog = ref(false)
const saveQueryName = ref('')

// Refs for focus management (accessibility)
const firstSavedQueryBtn = ref<HTMLButtonElement | null>(null)
const savedQueriesCloseBtn = ref<HTMLButtonElement | null>(null)
const saveQueryInput = ref<HTMLInputElement | null>(null)

// Context menu state
const contextMenuVisible = ref(false)
const contextMenuItem = ref<SearchResource | null>(null)
const contextMenuPosition = ref({ x: 0, y: 0 })

// Computed
const loading = computed(() => state.loading)

// Error classification - compute once to avoid duplicate string checks
// Translations are now handled inside classifyError
const errorInfo = computed(() => classifyError(state.error, $gettext))
const errorTitle = computed(() => errorInfo.value.title)
const errorSuggestions = computed(() => errorInfo.value.suggestions)

// URL helper functions
function getServerUrl(): string {
  return (window.location.origin).replace(/\/$/, '')
}

function encodePath(path: string): string {
  return path.split('/').map(s => encodeURIComponent(s)).join('/')
}

function buildDavUrl(item: SearchResource): string {
  const serverUrl = getServerUrl()
  const spaceId = item.spaceId || ''
  const itemPath = item.path || item.name || ''
  return `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}${encodePath(itemPath)}`
}

// Debounced filter term update (300ms delay to avoid excessive reactivity)
// Includes guard to prevent redundant updates when loading saved queries
const updateFilterTerm = debounce((term: string) => {
  // Only update if value actually changed (avoids circular updates)
  if (state.filters.term !== term) {
    state.filters.term = term
  }
}, 300)

// Watch for search term changes with debounce
watch(searchTerm, (newTerm) => {
  updateFilterTerm(newTerm)
})

// Methods
async function handleSearch(): Promise<void> {
  await executeSearch()
}

function retrySearch(): void {
  state.error = null
  executeSearch()
}

function handleItemClick(_item: SearchResource): void {
  // File navigation handled via context menu actions (Open in Files)
}

// Context menu functions
function openContextMenu(event: MouseEvent, item: SearchResource): void {
  event.preventDefault()
  event.stopPropagation()
  contextMenuItem.value = item
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true
}

function closeContextMenu(): void {
  contextMenuVisible.value = false
  contextMenuItem.value = null
}

async function handleContextAction(action: string, item: SearchResource): Promise<void> {
  switch (action) {
    case 'download':
      await downloadItem(item)
      break
    case 'openInFiles':
      openInFiles(item)
      break
    case 'copyLink':
      await copyItemLink(item)
      break
    case 'delete':
      await confirmAndDelete(item)
      break
  }
}

async function downloadItem(item: SearchResource): Promise<void> {
  let url: string | null = null
  try {
    const response = await fetch(buildDavUrl(item), { credentials: 'include' })

    if (!response.ok) {
      // Provide specific error messages based on status
      if (response.status === 404) {
        throw new Error($gettext('File not found. It may have been moved or deleted.'))
      } else if (response.status === 403) {
        throw new Error($gettext('Permission denied. You may not have access to this file.'))
      } else if (response.status === 401) {
        throw new Error($gettext('Session expired. Please log in again.'))
      } else {
        throw new Error($gettext('Download failed (%{status} %{statusText})').replace('%{status}', String(response.status)).replace('%{statusText}', response.statusText))
      }
    }

    const blob = await response.blob()
    url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = item.name || 'download'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    const message = err instanceof Error ? err.message : $gettext('Unknown error occurred')
    console.error('Failed to download:', err)
    alert($gettext('Download failed: %{message}').replace('%{message}', message))
  } finally {
    // Always clean up the Blob URL to prevent memory leaks
    if (url) {
      URL.revokeObjectURL(url)
    }
  }
}

function openInFiles(item: SearchResource): void {
  const serverUrl = getServerUrl()
  const fileId = item.fileId || item.id || ''
  const filePath = item.path || item.name || ''
  const driveAlias = item.driveAlias || 'personal/home'

  // Build paths for preview URL
  const fullPath = `${driveAlias}${filePath}`
  const lastSlash = filePath.lastIndexOf('/')
  const folderPath = lastSlash > 0 ? filePath.substring(0, lastSlash) : ''
  const parentId = item.parentReference?.id || item.parentId || ''

  // Build preview URL with context parameters
  const params = new URLSearchParams({
    fileId,
    contextRouteName: 'files-spaces-generic',
    'contextRouteParams.driveAliasAndItem': `${driveAlias}${folderPath}`
  })
  if (parentId) {
    params.set('contextRouteQuery.fileId', parentId)
  }

  window.open(`${serverUrl}/preview/${encodePath(fullPath)}?${params}`, '_blank')
}

async function copyItemLink(item: SearchResource): Promise<void> {
  try {
    const fileId = item.fileId || item.id || ''
    if (!fileId) {
      throw new Error($gettext('File ID not available'))
    }

    const link = `${getServerUrl()}/f/${encodeURIComponent(fileId)}`

    // Check if clipboard API is available
    if (!navigator.clipboard) {
      throw new Error($gettext('Clipboard API not available. Try using HTTPS.'))
    }

    await navigator.clipboard.writeText(link)
    alert($gettext('Link copied to clipboard!'))
  } catch (err) {
    let message = $gettext('Unknown error')
    if (err instanceof Error) {
      // Handle specific clipboard errors
      if (err.name === 'NotAllowedError') {
        message = $gettext('Clipboard access denied. Please allow clipboard permissions.')
      } else {
        message = err.message
      }
    }
    console.error('Failed to copy link:', err)
    alert($gettext('Failed to copy link: %{message}').replace('%{message}', message))
  }
}

async function confirmAndDelete(item: SearchResource): Promise<void> {
  if (!confirm($gettext('Are you sure you want to delete "%{name}"?').replace('%{name}', item.name || ''))) return

  try {
    const response = await fetch(buildDavUrl(item), {
      method: 'DELETE',
      credentials: 'include'
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error($gettext('File not found. It may have already been deleted.'))
      } else if (response.status === 403) {
        throw new Error($gettext('Permission denied. You may not have permission to delete this file.'))
      } else if (response.status === 401) {
        throw new Error($gettext('Session expired. Please log in again.'))
      } else if (response.status === 423) {
        throw new Error($gettext('File is locked. Please try again later.'))
      } else {
        throw new Error($gettext('Delete failed (%{status} %{statusText})').replace('%{status}', String(response.status)).replace('%{statusText}', response.statusText))
      }
    }

    // Refresh search results
    await executeSearch()
  } catch (err) {
    const message = err instanceof Error ? err.message : $gettext('Unknown error occurred')
    console.error('Failed to delete:', err)
    alert($gettext('Delete failed: %{message}').replace('%{message}', message))
  }
}

function loadSavedQuery(query: SavedQuery): void {
  // Deep clone the filters using JSON (structuredClone can't handle Vue reactive proxies)
  state.filters = JSON.parse(JSON.stringify(query.filters))
  searchTerm.value = query.filters.term || ''
  showSavedQueries.value = false

  // Execute the search
  executeSearch()
}

function handleSaveQuery(): void {
  if (!saveQueryName.value.trim()) return

  saveQuery(saveQueryName.value.trim(), state.filters)
  saveQueryName.value = ''
  showSaveDialog.value = false
}

// KQL input handlers
function onKqlInput(value: string): void {
  setKqlQuery(value)
}

function applyKqlToFilters(): void {
  const currentKql = state.kqlQuery || kqlQuery.value
  parseKqlToFilters(currentKql)
  // Update the search term input to match
  searchTerm.value = state.filters.term || ''
}

// App identifier - must match the directory name in oCIS assets path
const APP_ID = 'advanced-search'

// Inject CSS stylesheet (oCIS doesn't auto-load external app CSS)
// Path follows oCIS convention: /assets/apps/{app-id}/style.css
function injectStylesheet() {
  const styleId = `${APP_ID}-styles`
  if (document.getElementById(styleId)) return

  const link = document.createElement('link')
  link.id = styleId
  link.rel = 'stylesheet'
  link.href = `/assets/apps/${APP_ID}/style.css`
  document.head.appendChild(link)
}

// Load saved query if route param present
onMounted(() => {
  injectStylesheet()

  if (props.queryId) {
    const query = getQuery(props.queryId)
    if (query) {
      loadSavedQuery(query)
    }
  }
})

// Focus management: when Saved Searches panel opens, focus the first item or close button
watch(showSavedQueries, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      if (firstSavedQueryBtn.value) {
        firstSavedQueryBtn.value.focus()
      } else if (savedQueriesCloseBtn.value) {
        savedQueriesCloseBtn.value.focus()
      }
    })
  }
})

// Focus management: when Save dialog opens, focus the input field
watch(showSaveDialog, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      if (saveQueryInput.value) {
        saveQueryInput.value.focus()
      }
    })
  }
})
</script>

<style scoped>
.advanced-search-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
  background: var(--oc-color-background-default, #fff);
  overflow: auto;
}

/* Header */
.search-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.search-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

/* Search bar */
.search-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  gap: 0;
}

.search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid var(--oc-color-border, #ddd);
  border-radius: 4px 0 0 4px;
  outline: none;
}

.search-input:focus {
  border-color: var(--oc-color-primary, #0066cc);
}

.search-btn {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: var(--oc-color-primary, #0066cc);
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
}

.search-btn:hover {
  background: var(--oc-color-primary-hover, #0055aa);
}

.search-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.toggle-filters-btn {
  padding: 0.75rem 1rem;
  background: var(--oc-color-background-muted, #f5f5f5);
  border: 1px solid var(--oc-color-border, #ddd);
  border-radius: 4px;
  cursor: pointer;
}

/* Active filters */
.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
  align-items: center;
}

.clear-all-btn {
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
  background: none;
  border: none;
  color: var(--oc-color-text-muted, #666);
  cursor: pointer;
  text-decoration: underline;
}

.clear-all-btn:hover {
  color: var(--oc-color-text-default, #333);
}

/* Filter panel */
.filters-panel {
  background: var(--oc-color-background-muted, #f9f9f9);
  border: 1px solid var(--oc-color-border, #ddd);
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

/* Results section */
.results-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--oc-color-border, #ddd);
  margin-bottom: 1rem;
}

.results-count {
  font-weight: 500;
}

.view-controls {
  display: flex;
  gap: 0.25rem;
}

.view-btn {
  width: 2rem;
  height: 2rem;
  background: var(--oc-color-background-muted, #f5f5f5);
  border: 1px solid var(--oc-color-border, #ddd);
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.view-btn.active {
  background: var(--oc-color-primary, #0066cc);
  color: white;
  border-color: var(--oc-color-primary, #0066cc);
}

/* States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  color: var(--oc-color-text-muted, #666);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-hint {
  font-size: 0.875rem;
}

.error-state {
  max-width: 500px;
  margin: 0 auto;
}

.error-icon {
  color: var(--oc-color-danger, #cc0000);
  margin-bottom: 1rem;
}

.error-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--oc-color-danger, #cc0000);
  margin: 0 0 0.5rem 0;
}

.error-message {
  font-size: 0.9375rem;
  color: var(--oc-color-text-muted, #666);
  margin: 0 0 1rem 0;
}

.error-suggestions {
  text-align: left;
  background: var(--oc-color-background-muted, #f9f9f9);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.suggestions-label {
  font-weight: 500;
  margin: 0 0 0.5rem 0;
  color: var(--oc-color-text-default, #333);
}

.error-suggestions ul {
  margin: 0;
  padding-left: 1.25rem;
}

.error-suggestions li {
  margin: 0.25rem 0;
  font-size: 0.875rem;
}

.retry-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: var(--oc-color-primary, #0066cc);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-button:hover {
  background: var(--oc-color-primary-hover, #0055aa);
}

.retry-icon {
  font-size: 1.25rem;
}

.spinner {
  display: inline-block;
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid #ddd;
  border-top-color: var(--oc-color-primary, #0066cc);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Load more */
.load-more {
  display: flex;
  justify-content: center;
  padding: 1rem;
}

/* Saved queries panel */
.saved-queries-panel {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 320px;
  background: white;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #ddd;
}

.panel-header h3 {
  margin: 0;
}

.close-btn {
  width: 2rem;
  height: 2rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
}

.no-saved {
  padding: 2rem;
  text-align: center;
  color: #666;
}

.hint {
  font-size: 0.875rem;
}

.saved-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.saved-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #eee;
}

.saved-name {
  flex: 1;
  text-align: left;
  background: none;
  border: none;
  font-size: 0.9375rem;
  cursor: pointer;
  color: var(--oc-color-primary, #0066cc);
}

.saved-name:hover {
  text-decoration: underline;
}

.saved-date {
  font-size: 0.75rem;
  color: #999;
}

.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.5;
}

.delete-btn:hover {
  opacity: 1;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-dialog {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  width: 320px;
  max-width: 90vw;
}

.modal-dialog h3 {
  margin: 0 0 1rem 0;
}

.save-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  margin-bottom: 1rem;
  box-sizing: border-box;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* Buttons */
.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9375rem;
}

.btn-primary {
  background: var(--oc-color-primary, #0066cc);
  color: white;
  border: none;
}

.btn-primary:hover {
  background: var(--oc-color-primary-hover, #0055aa);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--oc-color-background-muted, #f5f5f5);
  border: 1px solid var(--oc-color-border, #ddd);
  color: var(--oc-color-text-default, #333);
}

.btn-secondary:hover {
  background: #e9e9e9;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
