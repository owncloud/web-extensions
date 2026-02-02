<template>
  <div class="search-stats">
    <div
      class="stats-header"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      aria-controls="search-stats-content"
      @click="toggleExpanded"
      @keydown.enter="toggleExpanded"
      @keydown.space.prevent="toggleExpanded"
    >
      <span class="stats-icon" aria-hidden="true">{{ expanded ? '▼' : '▶' }}</span>
      <h4>{{ $gettext('Search Status') }}</h4>
      <span v-if="loading" class="loading-indicator" aria-live="polite">{{ $gettext('Loading...') }}</span>
    </div>

    <div v-if="expanded" id="search-stats-content" class="stats-content">
      <!-- Index Status -->
      <div class="stats-section" role="region" :aria-label="$gettext('Index Status')">
        <h5 tabindex="0">{{ $gettext('Index Status') }}</h5>
        <div class="stats-grid">
          <div class="stat-item" tabindex="0" role="listitem">
            <span class="stat-label">{{ $gettext('Full-Text Search') }}</span>
            <span :class="['stat-value', stats.fullTextEnabled ? 'enabled' : 'disabled']">
              {{ stats.fullTextEnabled ? $gettext('Enabled') : $gettext('Disabled') }}
            </span>
          </div>
          <div class="stat-item" tabindex="0" role="listitem">
            <span class="stat-label">{{ $gettext('Tika Extraction') }}</span>
            <span :class="['stat-value', stats.tikaEnabled ? 'enabled' : 'disabled']">
              {{ stats.tikaEnabled ? $gettext('Enabled') : $gettext('Disabled') }}
            </span>
          </div>
          <div class="stat-item" tabindex="0" role="listitem">
            <span class="stat-label">{{ $gettext('OCR (Image Text)') }}</span>
            <span :class="['stat-value', stats.ocrEnabled ? 'enabled' : 'disabled']">
              {{ stats.ocrEnabled ? $gettext('Enabled') : $gettext('Disabled') }}
            </span>
          </div>
          <div class="stat-item" tabindex="0" role="listitem">
            <span class="stat-label">{{ $gettext('Index Engine') }}</span>
            <span class="stat-value">{{ stats.indexEngine }}</span>
          </div>
          <div class="stat-item" tabindex="0" role="listitem">
            <span class="stat-label">{{ $gettext('Total Indexed Files') }}</span>
            <span class="stat-value">{{ stats.totalIndexedFiles !== null ? stats.totalIndexedFiles.toLocaleString() : $gettext('Counting...') }}</span>
          </div>
        </div>
      </div>

      <!-- Space Stats -->
      <div class="stats-section" role="region" :aria-label="$gettext('Available Spaces')">
        <h5 tabindex="0">{{ $gettext('Available Spaces') }}</h5>
        <div class="stats-grid" role="list">
          <div class="stat-item" tabindex="0" role="listitem">
            <span class="stat-label">{{ $gettext('Total Spaces') }}</span>
            <span class="stat-value">{{ stats.totalSpaces }}</span>
          </div>
          <div class="stat-item" tabindex="0" role="listitem">
            <span class="stat-label">{{ $gettext('Personal Space') }}</span>
            <span class="stat-value">{{ stats.personalSpaceName || $gettext('N/A') }}</span>
          </div>
        </div>
        <div v-if="stats.spaces && stats.spaces.length > 0" class="spaces-list" role="list" :aria-label="$gettext('Space list')">
          <div v-for="space in stats.spaces" :key="space.id" class="space-item" tabindex="0" role="listitem">
            <span class="space-icon" aria-hidden="true">{{ getSpaceIcon(space.driveType) }}</span>
            <span class="space-name">{{ space.name }}</span>
            <span class="space-type">{{ space.driveType }}</span>
            <span v-if="space.used" class="space-used">{{ formatBytes(space.used) }} {{ $gettext('used') }}</span>
          </div>
        </div>
      </div>

      <!-- Server Info -->
      <div class="stats-section" role="region" :aria-label="$gettext('Server Information')">
        <h5 tabindex="0">{{ $gettext('Server Information') }}</h5>
        <div class="stats-grid" role="list">
          <div class="stat-item" tabindex="0" role="listitem">
            <span class="stat-label">{{ $gettext('Server URL') }}</span>
            <span class="stat-value path">{{ stats.serverUrl }}</span>
          </div>
          <div v-if="stats.version" class="stat-item" tabindex="0" role="listitem">
            <span class="stat-label">{{ $gettext('oCIS Version') }}</span>
            <span class="stat-value">{{ stats.version }}</span>
          </div>
        </div>
      </div>

      <!-- Refresh Button -->
      <div class="stats-actions">
        <button class="refresh-btn" :disabled="loading" @click="loadStats">
          {{ loading ? $gettext('Loading...') : $gettext('Refresh Stats') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useClientService, useConfigStore, useSpacesStore } from '@ownclouders/web-pkg'
import { useTranslations } from '../composables/useTranslations'
import { formatBytes, getSpaceIcon } from '../utils/format'

const { $gettext } = useTranslations()

// API Response Types
interface GraphDrive {
  id: string
  name?: string
  driveType?: string
  quota?: { used?: number }
}

interface GraphDrivesResponse {
  value?: GraphDrive[]
}

interface OcisConfig {
  options?: {
    fullTextSearch?: { enabled?: boolean; ocr?: boolean }
    ocr?: boolean
  }
}

interface OcsCapabilities {
  ocs?: {
    data?: {
      capabilities?: {
        search?: { ocr?: boolean }
        files?: { content_search?: { ocr?: boolean } }
      }
      version?: {
        string?: string
        major?: number
        minor?: number
        micro?: number
      }
    }
  }
}

interface SpaceInfo {
  id: string
  name: string
  driveType: string
  used?: number
}

interface SearchStatsData {
  fullTextEnabled: boolean
  tikaEnabled: boolean
  ocrEnabled: boolean
  indexEngine: string
  totalIndexedFiles: number | null
  totalSpaces: number
  personalSpaceName: string | null
  spaces: SpaceInfo[]
  serverUrl: string
  version: string | null
}

const clientService = useClientService()
const configStore = useConfigStore()
const spacesStore = useSpacesStore()

const expanded = ref(false)
const loading = ref(false)
const stats = reactive<SearchStatsData>({
  fullTextEnabled: false,
  tikaEnabled: false,
  ocrEnabled: false,
  indexEngine: 'Bleve (Scorch)',
  totalIndexedFiles: null,
  totalSpaces: 0,
  personalSpaceName: null,
  spaces: [],
  serverUrl: '',
  version: null,
})

// Watch for expansion and load stats
watch(expanded, (isExpanded) => {
  if (isExpanded && stats.totalSpaces === 0) {
    loadStats()
  }
})

function toggleExpanded() {
  expanded.value = !expanded.value
}

function getServerUrl(): string {
  let serverUrl = configStore.serverUrl || ''
  if (!serverUrl && typeof window !== 'undefined') {
    serverUrl = window.location.origin
  }
  return serverUrl.replace(/\/$/, '')
}

function mapDriveToSpaceInfo(drive: GraphDrive): SpaceInfo {
  return {
    id: drive.id,
    name: drive.name || 'Unknown',
    driveType: drive.driveType || 'unknown',
    used: drive.quota?.used,
  }
}

async function fetchSpaces(serverUrl: string): Promise<void> {
  try {
    const response = await clientService.httpAuthenticated.get(`${serverUrl}/graph/v1.0/me/drives`)
    const data = response.data as GraphDrivesResponse
    const drives = data?.value || []

    stats.totalSpaces = drives.length
    stats.spaces = drives.map(mapDriveToSpaceInfo)
    const personalSpace = drives.find((d) => d.driveType === 'personal')
    stats.personalSpaceName = personalSpace?.name || null
  } catch {
    // Fall back to spacesStore if available
    const spaces = (spacesStore.spaces || []) as GraphDrive[]
    stats.totalSpaces = spaces.length
    stats.spaces = spaces.map((s: GraphDrive) => mapDriveToSpaceInfo(s))
    const personalSpace = spaces.find((s: GraphDrive) => s.driveType === 'personal')
    stats.personalSpaceName = personalSpace?.name || null
  }
}

async function fetchSearchConfig(serverUrl: string): Promise<void> {
  try {
    const response = await clientService.httpAuthenticated.get(`${serverUrl}/config.json`)
    const config = response.data as OcisConfig

    if (config?.options?.fullTextSearch) {
      stats.fullTextEnabled = config.options.fullTextSearch.enabled !== false
    } else {
      stats.fullTextEnabled = true
    }

    stats.tikaEnabled = stats.fullTextEnabled

    if (config?.options?.fullTextSearch?.ocr !== undefined) {
      stats.ocrEnabled = config.options.fullTextSearch.ocr === true
    } else if (config?.options?.ocr !== undefined) {
      stats.ocrEnabled = config.options.ocr === true
    } else {
      stats.ocrEnabled = false
    }
  } catch {
    stats.fullTextEnabled = true
    stats.tikaEnabled = true
    stats.ocrEnabled = false
  }
}

async function fetchCapabilities(serverUrl: string): Promise<void> {
  try {
    const response = await clientService.httpAuthenticated.get(
      `${serverUrl}/ocs/v1.php/cloud/capabilities?format=json`
    )
    const data = response.data as OcsCapabilities
    const caps = data?.ocs?.data?.capabilities

    if (caps?.search?.ocr !== undefined) {
      stats.ocrEnabled = caps.search.ocr === true
    } else if (caps?.files?.content_search?.ocr !== undefined) {
      stats.ocrEnabled = caps.files.content_search.ocr === true
    }

    const version = data?.ocs?.data?.version
    if (version?.string) {
      stats.version = version.string
    } else if (version?.major !== undefined) {
      stats.version = `${version.major}.${version.minor}.${version.micro}`
    }
  } catch {
    // Use defaults already set
  }
}

/**
 * Count total indexed files by performing a wildcard search.
 *
 * Uses regex-based counting of <d:response> elements instead of full XML
 * parsing for performance - proper parsing would be slower for large results.
 * Each <d:response> element represents one indexed file.
 *
 * NOTE: This function depends on spaces being loaded first (needs personalSpace.id).
 *
 * @param serverUrl - Base server URL
 */
async function countIndexedFiles(serverUrl: string): Promise<void> {
  const personalSpace = stats.spaces.find(s => s.driveType === 'personal') || stats.spaces[0]
  if (!personalSpace) return

  try {
    // Wildcard search to count all indexed files (up to 10000)
    const searchBody = `<?xml version="1.0" encoding="UTF-8"?>
<oc:search-files xmlns:oc="http://owncloud.org/ns" xmlns:d="DAV:">
  <oc:search>
    <oc:pattern>*</oc:pattern>
    <oc:limit>10000</oc:limit>
  </oc:search>
  <d:prop>
    <oc:fileid/>
  </d:prop>
</oc:search-files>`

    const response = await clientService.httpAuthenticated.request({
      method: 'REPORT',
      url: `${serverUrl}/dav/spaces/${encodeURIComponent(personalSpace.id)}`,
      headers: { 'Content-Type': 'application/xml' },
      data: searchBody
    })

    const xmlText = typeof response.data === 'string'
      ? response.data
      : new XMLSerializer().serializeToString(response.data)

    // Count <d:response> elements using regex (faster than DOM parsing for large results)
    const responseMatches = xmlText.match(/<d:response>/gi) || []
    stats.totalIndexedFiles = responseMatches.length
  } catch {
    stats.totalIndexedFiles = null
  }
}

/**
 * Load all search statistics in an optimized two-phase approach.
 *
 * Phase 1 (parallel): Fetch spaces, search config, and capabilities simultaneously.
 *   These API calls are independent and can run concurrently for faster loading.
 *
 * Phase 2 (sequential): Count indexed files.
 *   This must run after Phase 1 because it needs the space ID from fetchSpaces().
 *
 * This pattern reduces total load time from ~4 sequential requests to ~2 round trips.
 */
async function loadStats(): Promise<void> {
  loading.value = true

  try {
    const serverUrl = getServerUrl()
    stats.serverUrl = serverUrl

    // Phase 1: Run independent API calls in parallel
    await Promise.all([
      fetchSpaces(serverUrl),
      fetchSearchConfig(serverUrl),
      fetchCapabilities(serverUrl)
    ])

    // Phase 2: countIndexedFiles depends on spaces being loaded (needs space ID)
    await countIndexedFiles(serverUrl)
  } finally {
    loading.value = false
  }
}

</script>

<style scoped>
.search-stats {
  margin-top: 1rem;
  border: 1px solid var(--oc-color-border, #ddd);
  border-radius: 4px;
  background: var(--oc-color-background-muted, #f9f9f9);
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  user-select: none;
}

.stats-header:hover {
  background: var(--oc-color-background-hover, #f0f0f0);
}

.stats-header h4 {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  flex: 1;
}

.stats-icon {
  font-size: 0.75rem;
  color: #666;
}

.loading-indicator {
  font-size: 0.75rem;
  color: var(--oc-color-primary, #0066cc);
}

.stats-content {
  padding: 0 1rem 1rem;
  border-top: 1px solid var(--oc-color-border, #ddd);
}

.stats-section {
  margin-top: 1rem;
}

.stats-section h5 {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.stat-label {
  font-size: 0.75rem;
  color: #888;
  font-weight: 500;
}

.stat-value {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #333;
}

.stat-value.enabled {
  color: #2e7d32;
}

.stat-value.disabled {
  color: #c62828;
}

.stat-value.path {
  font-family: monospace;
  font-size: 0.8125rem;
  word-break: break-all;
}

.spaces-list {
  margin-top: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: white;
  max-height: 200px;
  overflow-y: auto;
}

.space-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f0f0f0;
  font-size: 0.875rem;
}

.space-item:last-child {
  border-bottom: none;
}

.space-icon {
  font-size: 1rem;
}

.space-name {
  flex: 1;
  font-weight: 500;
}

.space-type {
  font-size: 0.75rem;
  color: #888;
  padding: 0.125rem 0.5rem;
  background: #f0f0f0;
  border-radius: 10px;
}

.space-used {
  font-size: 0.75rem;
  color: #666;
}

.stats-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

.refresh-btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  background: var(--oc-color-primary, #0066cc);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.refresh-btn:hover {
  background: var(--oc-color-primary-hover, #0055aa);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
