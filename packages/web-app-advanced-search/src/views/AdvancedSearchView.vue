<template>
  <div class="advanced-search-app" role="main" :aria-label="$gettext('Advanced Search')">
    <!-- Header -->
    <div class="search-header">
      <h1>{{ $gettext('Advanced Search') }}</h1>
      <div class="header-actions">
        <button
          type="button"
          class="oc-button oc-rounded oc-button-m oc-button-justify-content-center oc-button-gap-m oc-button-passive oc-button-passive-outline"
          :aria-expanded="showSavedQueries"
          @click="showSavedQueries = !showSavedQueries"
        >
          <span class="oc-icon oc-icon-m oc-icon-passive" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12.414 5H21C21.5523 5 22 5.44772 22 6V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H10.414L12.414 5Z" /></svg></span>
          <span>{{ $gettext('Saved Searches') }} ({{ savedQueries.length }})</span>
        </button>
        <button
          v-if="activeFilters.length > 0"
          type="button"
          class="oc-button oc-rounded oc-button-m oc-button-justify-content-center oc-button-gap-m oc-button-passive oc-button-passive-outline"
          @click="showSaveDialog = true"
        >
          <span class="oc-icon oc-icon-m oc-icon-passive" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7 19V13H17V19H19V7.828L16.172 5H5V19H7ZM4 3H17L21 7V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4C3 3.44772 3.44772 3 4 3ZM9 15V19H15V15H9Z" /></svg></span>
          <span>{{ $gettext('Save Search') }}</span>
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
        <button type="button" class="oc-button oc-rounded oc-button-m oc-button-justify-content-center oc-button-gap-m oc-button-primary oc-button-primary-filled search-btn" :disabled="loading" @click="handleSearch">
          <span class="oc-icon oc-icon-m oc-icon-passive" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M18.031 16.617L22.314 20.899L20.899 22.314L16.617 18.031C15.0237 19.3082 13.042 20.0029 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20.0029 13.042 19.3082 15.0237 18.031 16.617ZM16.025 15.875C17.2941 14.5699 18.0029 12.8204 18 11C18 7.132 14.867 4 11 4C7.132 4 4 7.132 4 11C4 14.867 7.132 18 11 18C12.8204 18.0029 14.5699 17.2941 15.875 16.025L16.025 15.875Z" /></svg></span>
          <span>{{ $gettext('Search') }}</span>
        </button>
      </div>
      <button
        type="button"
        class="oc-button oc-rounded oc-button-m oc-button-justify-content-center oc-button-gap-m oc-button-passive oc-button-passive-outline"
        :aria-expanded="showFilters"
        aria-controls="filters-panel"
        @click="showFilters = !showFilters"
      >
        <span class="oc-icon oc-icon-m oc-icon-passive" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M10 18H14V16H10V18ZM3 6V8H21V6H3ZM6 13H18V11H6V13Z" /></svg></span>
        <span>{{ $gettext('Advanced') }}</span>
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
      <button type="button" class="oc-button oc-rounded oc-button-s oc-button-justify-content-center oc-button-gap-m oc-button-passive oc-button-passive-raw clear-all-btn" @click="clearFilters">
        <span>{{ $gettext('Clear All') }}</span>
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
        <div class="view-controls item-inline-filter oc-flex-inline" role="group" :aria-label="$gettext('View mode')">
          <button
            type="button"
            :class="['oc-button oc-rounded oc-button-m oc-button-justify-content-center oc-button-gap-m oc-button-passive oc-button-passive-raw item-inline-filter-option', { 'item-inline-filter-option-selected': state.viewMode === 'list' }]"
            :title="$gettext('List view')"
            @click="setViewMode('list')"
          >
            <span class="oc-icon oc-icon-s" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 4H21V6H3V4ZM3 11H21V13H3V11ZM3 18H21V20H3V18Z" /></svg></span>
          </button>
          <button
            type="button"
            :class="['oc-button oc-rounded oc-button-m oc-button-justify-content-center oc-button-gap-m oc-button-passive oc-button-passive-raw item-inline-filter-option', { 'item-inline-filter-option-selected': state.viewMode === 'grid' }]"
            :title="$gettext('Grid view')"
            @click="setViewMode('grid')"
          >
            <span class="oc-icon oc-icon-s" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 3H11V11H3V3ZM3 13H11V21H3V13ZM13 3H21V11H13V3ZM13 13H21V21H13V13ZM5 5V9H9V5H5ZM5 15V19H9V15H5ZM15 5V9H19V5H15ZM15 15V19H19V15H15Z" /></svg></span>
          </button>
          <button
            type="button"
            :class="['oc-button oc-rounded oc-button-m oc-button-justify-content-center oc-button-gap-m oc-button-passive oc-button-passive-raw item-inline-filter-option', { 'item-inline-filter-option-selected': state.viewMode === 'table' }]"
            :title="$gettext('Table view')"
            @click="setViewMode('table')"
          >
            <span class="oc-icon oc-icon-s" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 8H20V5H4V8ZM4 14H20V11H4V14ZM4 20H20V17H4V20ZM2 3.993C2 3.445 2.455 3 2.992 3H21.008C21.556 3 22 3.445 22 3.993V20.007C22 20.555 21.545 21 21.008 21H2.992C2.444 21 2 20.555 2 20.007V3.993Z" /></svg></span>
          </button>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="loading-state">
        <span class="oc-spinner oc-spinner-m"></span>
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
        <button type="button" class="oc-button oc-rounded oc-button-m oc-button-justify-content-center oc-button-gap-m oc-button-primary oc-button-primary-filled" @click="retrySearch">
          <span class="oc-icon oc-icon-m oc-icon-passive" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5.463 4.433A9.961 9.961 0 0 1 12 2c5.523 0 10 4.477 10 10 0 2.136-.67 4.116-1.81 5.74L17 12h3a8 8 0 0 0-11.196-7.328l-.341.76zm13.074 15.134A9.961 9.961 0 0 1 12 22C6.477 22 2 17.523 2 12c0-2.136.67-4.116 1.81-5.74L7 12H4a8 8 0 0 0 11.196 7.328l.341-.76z" /></svg></span>
          <span>{{ $gettext('Try Again') }}</span>
        </button>
      </div>

      <!-- Empty state -->
      <div v-else-if="state.results && state.results.items.length === 0" class="empty-state">
        <span class="empty-icon" aria-hidden="true"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M18.031 16.617L22.314 20.899L20.899 22.314L16.617 18.031C15.0237 19.3082 13.042 20.0029 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20.0029 13.042 19.3082 15.0237 18.031 16.617ZM16.025 15.875C17.2941 14.5699 18.0029 12.8204 18 11C18 7.132 14.867 4 11 4C7.132 4 4 7.132 4 11C4 14.867 7.132 18 11 18C12.8204 18.0029 14.5699 17.2941 15.875 16.025L16.025 15.875Z" /></svg></span>
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
        <button type="button" class="oc-button oc-rounded oc-button-m oc-button-justify-content-center oc-button-gap-m oc-button-passive oc-button-passive-outline" :disabled="loading" @click="loadMore">
          <span>{{ $gettext('Load More') }}</span>
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
          class="oc-button-reset close-btn"
          :aria-label="$gettext('Close saved searches')"
          @click="showSavedQueries = false"
        ><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 10.586L16.95 5.636L18.364 7.05L13.414 12L18.364 16.95L16.95 18.364L12 13.414L7.05 18.364L5.636 16.95L10.586 12L5.636 7.05L7.05 5.636L12 10.586Z" /></svg></button>
      </div>
      <div v-if="savedQueries.length === 0" class="no-saved">
        <p>{{ $gettext('No saved searches yet') }}</p>
        <p class="hint">{{ $gettext('Create a search and click "Save Search" to save it.') }}</p>
      </div>
      <ul v-else class="saved-list">
        <li
          v-for="(query, index) in savedQueries"
          :key="query.id"
          class="saved-item"
        >
          <button
            :ref="el => { if (index === 0) firstSavedQueryBtn = el as HTMLButtonElement }"
            class="oc-button-reset saved-name"
            @click="loadSavedQuery(query)"
          >
            {{ query.name }}
          </button>
          <span class="saved-date">{{ formatDate(query.savedAt, undefined, getUserLocale()) }}</span>
          <button class="oc-button-reset delete-btn" :aria-label="$gettext('Delete')" @click="deleteQuery(query.id)"><svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM18 8H6V20H18V8ZM9 11H11V17H9V11ZM13 11H15V17H13V11ZM9 4V6H15V4H9Z" /></svg></button>
        </li>
      </ul>
    </div>

    <!-- Save dialog -->
    <div
      v-if="showSaveDialog"
      class="oc-modal-background"
      role="presentation"
      @click.self="showSaveDialog = false"
      @keydown.escape="showSaveDialog = false"
    >
      <div
        class="oc-modal oc-modal-primary"
        role="dialog"
        aria-modal="true"
        :aria-label="$gettext('Save Search')"
      >
        <h2 class="oc-modal-title">{{ $gettext('Save Search') }}</h2>
        <div class="oc-modal-body">
          <input
            ref="saveQueryInput"
            v-model="saveQueryName"
            type="text"
            :placeholder="$gettext('Enter a name for this search')"
            :aria-label="$gettext('Search name')"
            class="save-input"
            @keyup.enter="handleSaveQuery"
          />
        </div>
        <div class="oc-modal-body-actions">
          <button type="button" class="oc-button oc-rounded oc-button-m oc-button-justify-content-center oc-button-gap-m oc-button-passive oc-button-passive-outline" @click="showSaveDialog = false">
            <span>{{ $gettext('Cancel') }}</span>
          </button>
          <button
            type="button"
            class="oc-button oc-rounded oc-button-m oc-button-justify-content-center oc-button-gap-m oc-button-primary oc-button-primary-filled"
            :disabled="!saveQueryName.trim()"
            @click="handleSaveQuery"
          >
            <span>{{ $gettext('Save') }}</span>
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
import { useThemeStore } from '@ownclouders/web-pkg'
import type { SavedQuery, SearchResource } from '../types'
import { formatDate, classifyError, debounce } from '../utils/format'
import SearchFilters from '../components/SearchFilters.vue'
import FilterChip from '../components/FilterChip.vue'
import SearchResults from '../components/SearchResults.vue'
import SearchStats from '../components/SearchStats.vue'
import ResultContextMenu from '../components/ResultContextMenu.vue'

// Translations
const { $gettext, $ngettext, getUserLocale } = useTranslations()

// Theme detection for native controls (color-scheme)
const themeStore = useThemeStore()
const isDark = computed(() => themeStore.currentTheme?.isDark ?? false)

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

function handleItemClick(): void {
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

// Sync color-scheme on document root so browser-native popups (datalist, select) respect dark mode
function syncColorScheme() {
  document.documentElement.style.setProperty('color-scheme', isDark.value ? 'dark' : 'light')
}

// Load saved query if route param present
onMounted(() => {
  syncColorScheme()

  if (props.queryId) {
    const query = getQuery(props.queryId)
    if (query) {
      loadSavedQuery(query)
    }
  }
})

// Update color-scheme when theme changes
watch(isDark, syncColorScheme)

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
  color: var(--oc-color-text-default, #333);
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
  background: var(--oc-color-background-default, #fff);
  color: var(--oc-color-text-default, #333);
}

.search-input:focus {
  border-color: var(--oc-color-primary, #0066cc);
}

.search-btn {
  border-radius: 0 4px 4px 0;
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
  color: var(--oc-color-text-muted, #666);
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

/* Inline filter toggle */
.item-inline-filter {
  gap: 2px;
  background: var(--oc-color-background-muted, #f0f0f0);
  border-radius: 100px;
  padding: 2px;
}
.item-inline-filter-option {
  border-radius: 100px !important;
  transition: background-color 0.15s ease;
}
.item-inline-filter-option-selected {
  background-color: var(--oc-color-swatch-primary-default, #0070c0) !important;
  color: var(--oc-color-text-inverse, #fff) !important;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.item-inline-filter-option:not(.item-inline-filter-option-selected):hover {
  background-color: rgba(0, 0, 0, 0.05);
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
  display: block;
  margin-bottom: 1rem;
  color: var(--oc-color-text-muted, #666);
}

.empty-icon svg {
  width: 3rem;
  height: 3rem;
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
  background: var(--oc-color-background-default, #fff);
  color: var(--oc-color-text-default, #333);
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
  border-bottom: 1px solid var(--oc-color-border, #ddd);
}

.panel-header h3 {
  margin: 0;
}

.close-btn {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--oc-color-text-muted, #666);
}

.close-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.no-saved {
  padding: 2rem;
  text-align: center;
  color: var(--oc-color-text-muted, #666);
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
  border-bottom: 1px solid var(--oc-color-border, #eee);
}

.saved-name {
  flex: 1;
  text-align: left;
  font-size: 0.9375rem;
  cursor: pointer;
  color: var(--oc-color-primary, #0066cc);
}

.saved-name:hover {
  text-decoration: underline;
}

.saved-date {
  font-size: 0.75rem;
  color: var(--oc-color-text-muted, #999);
}

.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.5;
  color: var(--oc-color-swatch-danger-default, #c00);
}

.delete-btn svg {
  width: 1rem;
  height: 1rem;
}

.delete-btn:hover {
  opacity: 1;
}

.save-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--oc-color-border, #ddd);
  border-radius: 4px;
  font-size: 1rem;
  margin-bottom: 1rem;
  box-sizing: border-box;
  background: var(--oc-color-background-default, Canvas);
  color: var(--oc-color-text-default, CanvasText);
}


</style>

<!-- Unscoped: -webkit-autofill overrides must not have Vue scoped attribute selectors -->
<style>
.advanced-search-app input:-webkit-autofill,
.advanced-search-app input:-webkit-autofill:hover,
.advanced-search-app input:-webkit-autofill:focus,
.advanced-search-app input:-webkit-autofill:active {
  -webkit-text-fill-color: var(--oc-color-text-default, #333) !important;
  -webkit-box-shadow: 0 0 0px 1000px var(--oc-color-background-default, #fff) inset !important;
  transition: background-color 5000s ease-in-out 0s !important;
}
</style>
