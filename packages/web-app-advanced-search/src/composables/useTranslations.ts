/**
 * Translation helper composable
 * Wraps vue3-gettext for use in the Advanced Search extension
 */

import { useGettext } from 'vue3-gettext'
import { useUserStore } from '@ownclouders/web-pkg'

/**
 * Get translation functions from vue3-gettext
 * Falls back to identity function if gettext is not available
 */
export function useTranslations() {
  let gettextLanguage: string | undefined
  let $gettext: (msg: string) => string
  let $ngettext: (singular: string, plural: string, n: number) => string
  let $pgettext: (context: string, msg: string) => string

  try {
    const gettext = useGettext()
    $gettext = gettext.$gettext
    $ngettext = gettext.$ngettext
    $pgettext = gettext.$pgettext
    gettextLanguage = (gettext as unknown as { current: string }).current
  } catch {
    // Fallback for testing or when gettext is not initialized
    $gettext = (msg: string) => msg
    $ngettext = (singular: string, plural: string, n: number) => (n === 1 ? singular : plural)
    $pgettext = (_context: string, msg: string) => msg
  }

  let preferredLanguage: string | undefined
  try {
    const userStore = useUserStore()
    preferredLanguage = userStore.user?.preferredLanguage
  } catch {
    // Fallback for testing or when store is not initialized
  }

  /**
   * Get the user's locale for date/number formatting.
   * Priority: user's preferredLanguage from store > gettext current language > browser default
   */
  function getUserLocale(): string | undefined {
    return preferredLanguage || gettextLanguage || undefined
  }

  return {
    $gettext,
    $ngettext,
    $pgettext,
    getUserLocale,
  }
}
