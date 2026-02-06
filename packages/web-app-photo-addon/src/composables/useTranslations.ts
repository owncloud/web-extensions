/**
 * Translation helper composable
 * Wraps vue3-gettext for use in the Photo Addon extension
 */

import { useGettext } from 'vue3-gettext'

/**
 * Get translation functions from vue3-gettext
 * Falls back to identity function if gettext is not available
 */
export function useTranslations() {
  let $gettext: (msg: string) => string

  try {
    const gettext = useGettext()
    $gettext = gettext.$gettext
  } catch {
    // Fallback for testing or when gettext is not initialized
    $gettext = (msg: string) => msg
  }

  /**
   * Get month names array for the current locale
   */
  function getMonthNames(): string[] {
    return [
      $gettext('January'),
      $gettext('February'),
      $gettext('March'),
      $gettext('April'),
      $gettext('May'),
      $gettext('June'),
      $gettext('July'),
      $gettext('August'),
      $gettext('September'),
      $gettext('October'),
      $gettext('November'),
      $gettext('December'),
    ]
  }

  /**
   * Get orientation label from EXIF orientation value
   */
  function getOrientationLabel(orientation: number): string {
    const labels: Record<number, string> = {
      1: $gettext('Normal'),
      2: $gettext('Flipped horizontally'),
      3: $gettext('Rotated 180°'),
      4: $gettext('Flipped vertically'),
      5: $gettext('Rotated 90° CW + flipped'),
      6: $gettext('Rotated 90° CW'),
      7: $gettext('Rotated 90° CCW + flipped'),
      8: $gettext('Rotated 90° CCW'),
    }
    return labels[orientation] || String(orientation)
  }

  return {
    $gettext,
    getMonthNames,
    getOrientationLabel,
  }
}
