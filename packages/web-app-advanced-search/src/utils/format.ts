/**
 * Shared formatting utilities
 * Consolidated from duplicate implementations across components
 */

// Constants moved outside functions to avoid recreation on each call
const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const
const SIZE_DIVISOR = 1024
const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Format bytes into human-readable size string
 * @param bytes - Number of bytes (can be number or string)
 * @returns Formatted string like "1.5 MB"
 */
export function formatBytes(bytes: number | string | undefined): string {
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes
  if (!num || isNaN(num)) return '—'
  if (num === 0) return '0 B'

  const i = Math.floor(Math.log(num) / Math.log(SIZE_DIVISOR))
  return parseFloat((num / Math.pow(SIZE_DIVISOR, i)).toFixed(1)) + ' ' + SIZE_UNITS[i]
}

/**
 * Format date string for display
 * @param dateStr - ISO date string or date-like string
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDate(
  dateStr: string | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  },
  locale?: string
): string {
  if (!dateStr) return '—'

  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleDateString(locale, options)
  } catch {
    return '—'
  }
}

/**
 * Format a date string for use in KQL queries (YYYY-MM-DD format).
 *
 * KQL date fields (mtime, photo.takendatetime) expect ISO date format.
 * This function normalizes various date formats and validates them.
 *
 * @example
 * formatDateForKQL("2024-01-15")      // "2024-01-15"
 * formatDateForKQL("January 15, 2024") // "2024-01-15"
 * formatDateForKQL("2023-13-45")      // null (invalid date)
 * formatDateForKQL("")                // null
 *
 * @param date - Date string in any parseable format
 * @returns ISO date string (YYYY-MM-DD) or null if invalid/empty
 */
export function formatDateForKQL(date: string): string | null {
  if (!date || typeof date !== 'string') {
    return null
  }

  const trimmed = date.trim()
  if (!trimmed) {
    return null
  }

  // Already in YYYY-MM-DD format - but still need to validate it's a real date
  if (DATE_FORMAT_REGEX.test(trimmed)) {
    const testDate = new Date(trimmed)
    // JavaScript's Date constructor is lenient and will "fix" invalid dates:
    // new Date("2023-13-45") becomes 2024-02-14 (rolls over months/days)
    // We detect this by checking if toISOString starts with the original input.
    // If the date was "fixed", it won't match.
    if (!isNaN(testDate.getTime()) && testDate.toISOString().startsWith(trimmed)) {
      return trimmed
    }
    return null
  }

  // Try to parse other formats (e.g., "January 15, 2024", timestamps)
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]
  }

  return null
}

/**
 * Get file type icon (emoji) based on MIME type
 * @param mimeType - MIME type string
 * @param isFolder - Whether the item is a folder
 * @returns Emoji icon string
 */
export function getFileIcon(mimeType: string | undefined, isFolder?: boolean): string {
  if (isFolder) return '📁'

  const mime = mimeType || ''
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.startsWith('video/')) return '🎬'
  if (mime.startsWith('audio/')) return '🎵'
  if (mime.includes('pdf')) return '📄'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  if (mime.includes('sheet') || mime.includes('excel')) return '📊'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📽️'
  return '📄'
}

/**
 * Get space type icon
 * @param driveType - Drive/space type
 * @returns Emoji icon string
 */
export function getSpaceIcon(driveType: string): string {
  switch (driveType) {
    case 'personal': return '👤'
    case 'project': return '📁'
    case 'virtual': return '🔗'
    case 'share': return '🤝'
    default: return '📂'
  }
}

/**
 * Sanitize text for safe display in HTML contexts.
 *
 * Escapes HTML special characters to prevent XSS attacks when
 * displaying untrusted content (e.g., error messages from APIs,
 * user input, or filenames).
 *
 * Use this function when interpolating dynamic content into HTML
 * that is not using Vue's built-in escaping (e.g., v-html, innerHTML,
 * or document.createElement scenarios).
 *
 * Note: Vue templates automatically escape interpolated values in
 * {{ }} and :attribute bindings, so this is only needed for cases
 * where raw HTML rendering is used.
 *
 * @example
 * // Safe for innerHTML or v-html
 * element.innerHTML = sanitizeForDisplay(untrustedMessage)
 *
 * // Error messages from external sources
 * const safeMessage = sanitizeForDisplay(apiError.message)
 *
 * @param text - Potentially untrusted text to sanitize
 * @returns HTML-safe string with special characters escaped
 */
export function sanitizeForDisplay(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/** Translation function type for classifyError */
type TranslateFn = (text: string) => string

/**
 * Classify an error message into a user-friendly category with suggestions.
 *
 * Maps raw error strings (from HTTP responses, network errors, etc.) to
 * user-friendly titles and actionable suggestions. Checks are ordered
 * by specificity - HTTP status codes first, then error type keywords.
 *
 * Categories handled:
 * - 503/Service Unavailable: Search service down or restarting
 * - 502/Bad Gateway: Server overloaded
 * - Network/ECONNREFUSED: Connection issues
 * - Space errors: Storage not found
 * - 401/403: Authentication problems
 * - Fallback: Generic search failure
 *
 * @param error - Raw error message string (from Error.message or API response)
 * @param $gettext - Translation function (pass from useTranslations)
 * @returns Object with user-friendly title and array of suggestion strings
 */
export function classifyError(error: string | null, $gettext: TranslateFn): {
  title: string
  suggestions: string[]
} {
  const err = error || ''

  // Check HTTP status codes first (most specific)
  if (err.includes('search service') || err.includes('503') || err.includes('Service Unavailable')) {
    return {
      title: $gettext('Search Service Unavailable'),
      suggestions: [
        $gettext('The search service may be restarting or under maintenance'),
        $gettext('Wait a moment and try again'),
        $gettext('Contact your administrator if this persists')
      ]
    }
  }

  if (err.includes('502') || err.includes('Bad Gateway')) {
    return {
      title: $gettext('Search Service Unavailable'),
      suggestions: [
        $gettext('The server may be temporarily overloaded'),
        $gettext('Wait a moment and try again')
      ]
    }
  }

  // Network-level errors
  if (err.includes('network') || err.includes('Network') || err.includes('ECONNREFUSED')) {
    return {
      title: $gettext('Connection Error'),
      suggestions: [
        $gettext('Check your internet connection'),
        $gettext('The server may be temporarily unavailable'),
        $gettext('Try refreshing the page')
      ]
    }
  }

  // oCIS-specific errors
  if (err.includes('space') || err.includes('Space')) {
    return {
      title: $gettext('Storage Not Found'),
      suggestions: [
        $gettext('Your personal storage space could not be found'),
        $gettext('Try logging out and back in'),
        $gettext('Contact your administrator')
      ]
    }
  }

  // Authentication errors
  if (err.includes('401') || err.includes('Unauthorized') || err.includes('403')) {
    return {
      title: $gettext('Authentication Error'),
      suggestions: [
        $gettext('Your session may have expired'),
        $gettext('Try logging out and back in')
      ]
    }
  }

  // Fallback for unrecognized errors
  return {
    title: $gettext('Search Failed'),
    suggestions: [
      $gettext('Try refreshing the page'),
      $gettext('Wait a moment and try again')
    ]
  }
}

/**
 * Creates a debounced version of a function.
 *
 * The debounced function delays invoking fn until after `delay` milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * Useful for rate-limiting expensive operations like search or API calls
 * triggered by user input.
 *
 * @example
 * const debouncedSearch = debounce((query: string) => {
 *   performSearch(query)
 * }, 300)
 *
 * // Called rapidly on each keystroke, but performSearch only runs
 * // 300ms after the user stops typing
 * input.addEventListener('input', (e) => debouncedSearch(e.target.value))
 *
 * Generic type explanation:
 * - T extends (...args: Parameters<T>) => void
 *   This constraint ensures T is a function type. Parameters<T> extracts
 *   the argument types from T, allowing the returned function to have
 *   the same signature as the input function.
 *
 * @param fn - Function to debounce (must return void)
 * @param delay - Delay in milliseconds before fn is invoked
 * @returns Debounced function with same signature as fn
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    // Clear any pending invocation
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    // Schedule new invocation
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}
