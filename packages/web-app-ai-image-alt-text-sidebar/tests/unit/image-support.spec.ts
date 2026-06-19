import { describe, it, expect } from 'vitest'
import { isSupportedImage } from '../../src/utils/image-support'

describe('isSupportedImage', () => {
  it('accepts jpg', () => {
    expect(isSupportedImage({ extension: 'jpg' })).toBe(true)
  })
  it('accepts jpeg', () => {
    expect(isSupportedImage({ extension: 'jpeg' })).toBe(true)
  })
  it('accepts png', () => {
    expect(isSupportedImage({ extension: 'png' })).toBe(true)
  })
  it('accepts webp', () => {
    expect(isSupportedImage({ extension: 'webp' })).toBe(true)
  })
  it('accepts gif', () => {
    expect(isSupportedImage({ extension: 'gif' })).toBe(true)
  })
  it('is case-insensitive (JPG)', () => {
    expect(isSupportedImage({ extension: 'JPG' })).toBe(true)
  })
  it('rejects pdf', () => {
    expect(isSupportedImage({ extension: 'pdf' })).toBe(false)
  })
  it('rejects svg', () => {
    expect(isSupportedImage({ extension: 'svg' })).toBe(false)
  })
  it('rejects resource without extension', () => {
    expect(isSupportedImage({})).toBe(false)
  })
  it('rejects undefined', () => {
    expect(isSupportedImage(undefined)).toBe(false)
  })
})
