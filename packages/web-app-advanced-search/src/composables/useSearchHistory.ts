/**
 * Composable for managing saved search queries
 * Uses localStorage for persistence
 */

import { ref } from 'vue'
import type { SavedQuery, SearchFilters } from '../types'
import { useTranslations } from './useTranslations'

const STORAGE_KEY = 'ocis-advanced-search-saved-queries'

/** Result type for storage operations */
interface StorageResult {
  success: boolean
  error?: string
}

/** Last storage error for user feedback (raw, not translated) */
let lastStorageError: string | null = null
let lastStorageErrorKey: 'corrupted' | 'load_failed' | 'quota' | 'save_failed' | null = null

/**
 * Load saved queries from localStorage
 */
function loadFromStorage(): SavedQuery[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Validate that it's an array
      if (!Array.isArray(parsed)) {
        lastStorageError = 'Corrupted data: expected array'
        lastStorageErrorKey = 'corrupted'
        return []
      }
      return parsed
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    lastStorageError = message
    lastStorageErrorKey = 'load_failed'
    console.error('[SearchHistory] Failed to load saved queries:', err)
  }
  return []
}

/**
 * Save queries to localStorage
 * @returns Result indicating success or failure with error message
 */
function saveToStorage(queries: SavedQuery[]): StorageResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queries))
    lastStorageError = null
    lastStorageErrorKey = null
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    // Check for quota exceeded
    if (err instanceof Error && err.name === 'QuotaExceededError') {
      lastStorageError = message
      lastStorageErrorKey = 'quota'
    } else {
      lastStorageError = message
      lastStorageErrorKey = 'save_failed'
    }
    console.error('[SearchHistory] Failed to save queries:', err)
    return { success: false, error: lastStorageError }
  }
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Composable for managing search history and saved queries
 */
export function useSearchHistory() {
  const { $gettext } = useTranslations()

  // Reactive state
  const savedQueries = ref<SavedQuery[]>(loadFromStorage())

  // Recent searches (not persisted across sessions, for autocomplete)
  const recentSearches = ref<string[]>([])
  const MAX_RECENT = 10

  // Expose storage error state with translation
  const storageError = ref<string | null>(null)

  // Translate storage error on access
  function getTranslatedStorageError(): string | null {
    if (!lastStorageErrorKey) return null
    switch (lastStorageErrorKey) {
      case 'corrupted':
        return $gettext('Saved searches data is corrupted and could not be loaded.')
      case 'load_failed':
        return $gettext('Failed to load saved searches.')
      case 'quota':
        return $gettext('Storage quota exceeded. Try deleting some saved searches.')
      case 'save_failed':
        return $gettext('Failed to save. Please try again.')
      default:
        return lastStorageError
    }
  }

  // Initialize with translated error if present
  if (lastStorageErrorKey) {
    storageError.value = getTranslatedStorageError()
  }

  /**
   * Save a query with a name
   * @returns The saved query, or null if save failed
   */
  function saveQuery(name: string, filters: SearchFilters): SavedQuery | null {
    const query: SavedQuery = {
      id: generateId(),
      name,
      // Use JSON for deep clone (structuredClone can't handle Vue reactive proxies)
      filters: JSON.parse(JSON.stringify(filters)),
      savedAt: new Date().toISOString(),
    }

    // Build new array without mutating state yet (avoids race condition on rollback)
    const newQueries = [query, ...savedQueries.value]
    const result = saveToStorage(newQueries)

    if (!result.success) {
      // Don't modify state on failure - leave it unchanged
      storageError.value = result.error || $gettext('Failed to save query')
      return null
    }

    // Only update state after successful save
    savedQueries.value = newQueries
    storageError.value = null
    return query
  }

  /**
   * Delete a saved query
   * @returns true if deleted successfully
   */
  function deleteQuery(id: string): boolean {
    const index = savedQueries.value.findIndex(q => q.id === id)
    if (index === -1) {
      return false
    }

    // Build new array without mutating state yet (avoids race condition on rollback)
    const newQueries = savedQueries.value.filter(q => q.id !== id)
    const result = saveToStorage(newQueries)

    if (!result.success) {
      // Don't modify state on failure - leave it unchanged
      storageError.value = result.error || $gettext('Failed to delete query')
      return false
    }

    // Only update state after successful save
    savedQueries.value = newQueries
    storageError.value = null
    return true
  }

  /**
   * Update a saved query's name
   * @returns true if renamed successfully
   */
  function renameQuery(id: string, newName: string): boolean {
    const index = savedQueries.value.findIndex(q => q.id === id)
    if (index === -1) {
      return false
    }

    // Build new array without mutating state yet (avoids race condition on rollback)
    const newQueries = savedQueries.value.map(q =>
      q.id === id ? { ...q, name: newName } : q
    )
    const result = saveToStorage(newQueries)

    if (!result.success) {
      // Don't modify state on failure - leave it unchanged
      storageError.value = result.error || $gettext('Failed to rename query')
      return false
    }

    // Only update state after successful save
    savedQueries.value = newQueries
    storageError.value = null
    return true
  }

  /**
   * Clear storage error
   */
  function clearStorageError(): void {
    storageError.value = null
  }

  /**
   * Get a saved query by ID
   */
  function getQuery(id: string): SavedQuery | undefined {
    return savedQueries.value.find(q => q.id === id)
  }

  /**
   * Add to recent searches (for autocomplete)
   */
  function addToRecent(term: string): void {
    if (!term || !term.trim()) return

    // Remove if already exists
    const existing = recentSearches.value.indexOf(term)
    if (existing !== -1) {
      recentSearches.value.splice(existing, 1)
    }

    // Add to front
    recentSearches.value.unshift(term)

    // Trim to max
    if (recentSearches.value.length > MAX_RECENT) {
      recentSearches.value = recentSearches.value.slice(0, MAX_RECENT)
    }
  }

  /**
   * Clear recent searches
   */
  function clearRecent(): void {
    recentSearches.value = []
  }

  /**
   * Check if a query name is already used
   */
  function isNameTaken(name: string): boolean {
    return savedQueries.value.some(q => q.name.toLowerCase() === name.toLowerCase())
  }

  /**
   * Export all saved queries as JSON
   */
  function exportQueries(): string {
    return JSON.stringify(savedQueries.value, null, 2)
  }

  /**
   * Import queries from JSON
   */
  function importQueries(json: string): number {
    try {
      const imported = JSON.parse(json) as SavedQuery[]
      let count = 0

      for (const query of imported) {
        // Validate structure
        if (query.name && query.filters) {
          // Generate new ID to avoid conflicts
          query.id = generateId()
          query.savedAt = new Date().toISOString()
          savedQueries.value.push(query)
          count++
        }
      }

      if (count > 0) {
        saveToStorage(savedQueries.value)
      }

      return count
    } catch (err) {
      console.error('[SearchHistory] Import failed:', err)
      return 0
    }
  }

  return {
    // State
    savedQueries,
    recentSearches,
    storageError,

    // Methods
    saveQuery,
    deleteQuery,
    renameQuery,
    getQuery,
    addToRecent,
    clearRecent,
    clearStorageError,
    isNameTaken,
    exportQueries,
    importQueries,
  }
}
