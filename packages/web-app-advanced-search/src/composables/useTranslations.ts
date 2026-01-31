/**
 * Translation helper composable
 * Wraps vue3-gettext for use in the Advanced Search extension
 */

import { useGettext } from 'vue3-gettext'

/**
 * Get translation functions from vue3-gettext
 * Falls back to identity function if gettext is not available
 */
export function useTranslations() {
  try {
    const { $gettext, $ngettext, $pgettext } = useGettext()
    return {
      $gettext,
      $ngettext,
      $pgettext,
    }
  } catch {
    // Fallback for testing or when gettext is not initialized
    return {
      $gettext: (msg: string) => msg,
      $ngettext: (singular: string, plural: string, n: number) => (n === 1 ? singular : plural),
      $pgettext: (_context: string, msg: string) => msg,
    }
  }
}
