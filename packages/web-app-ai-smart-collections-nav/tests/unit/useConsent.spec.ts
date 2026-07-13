import { describe, it, expect, afterEach } from 'vitest'
import {
  hasSessionConsent,
  giveSessionConsent,
  _resetSessionConsentForTesting,
  _giveSessionConsentForTesting
} from '../../src/composables/useConsent'

afterEach(() => {
  _resetSessionConsentForTesting()
})

describe('useConsent', () => {
  it('starts with no consent given', () => {
    expect(hasSessionConsent()).toBe(false)
  })

  it('reflects consent given via giveSessionConsent', () => {
    giveSessionConsent()
    expect(hasSessionConsent()).toBe(true)
  })

  it('resets consent via _resetSessionConsentForTesting', () => {
    giveSessionConsent()
    _resetSessionConsentForTesting()
    expect(hasSessionConsent()).toBe(false)
  })

  it('grants consent via _giveSessionConsentForTesting', () => {
    _giveSessionConsentForTesting()
    expect(hasSessionConsent()).toBe(true)
  })
})
