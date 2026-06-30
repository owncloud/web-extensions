import { describe, it, expect } from 'vitest'
import { isSupportedFile } from '../../src/utils/file-support'

describe('isSupportedFile', () => {
  it('accepts txt extension', () => {
    expect(isSupportedFile({ extension: 'txt' })).toBe(true)
  })

  it('accepts md extension', () => {
    expect(isSupportedFile({ extension: 'md' })).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isSupportedFile({ extension: 'TXT' })).toBe(true)
    expect(isSupportedFile({ extension: 'MD' })).toBe(true)
  })

  it('rejects unsupported extensions', () => {
    expect(isSupportedFile({ extension: 'png' })).toBe(false)
    expect(isSupportedFile({ extension: 'docx' })).toBe(false)
    expect(isSupportedFile({ extension: 'pdf' })).toBe(false)
  })

  it('rejects resources without extension', () => {
    expect(isSupportedFile({})).toBe(false)
    expect(isSupportedFile(undefined)).toBe(false)
  })

  it('respects a custom supported list', () => {
    expect(isSupportedFile({ extension: 'csv' }, ['csv', 'json'])).toBe(true)
    expect(isSupportedFile({ extension: 'txt' }, ['csv', 'json'])).toBe(false)
  })
})
