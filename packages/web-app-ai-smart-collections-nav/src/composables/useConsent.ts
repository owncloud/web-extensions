// Session-level consent flag: resets on full page reload. Mirrors the pattern used by
// ai-data-insights-sidebar's useInsights.ts — once the user confirms, we don't ask again
// for the rest of the SPA session.
let sessionConsentGiven = false

export function hasSessionConsent(): boolean {
  return sessionConsentGiven
}

export function giveSessionConsent(): void {
  sessionConsentGiven = true
}

/**
 * Resets the session consent flag.
 * Intended only for test isolation — do not call in production code.
 */
export function _resetSessionConsentForTesting(): void {
  sessionConsentGiven = false
}

/**
 * Sets the session consent flag to true, bypassing the consent dialog.
 * Intended only for test isolation — do not call in production code.
 */
export function _giveSessionConsentForTesting(): void {
  sessionConsentGiven = true
}
