import { describe, it, expect } from 'vitest'
import { isSupportedFile } from '../../src/utils/file-support'

describe('isSupportedFile', () => {
  const supported = ['pdf', 'txt', 'md']

  it('returns true for supported extensions', () => {
    expect(isSupportedFile({ extension: 'pdf' }, supported)).toBe(true)
    expect(isSupportedFile({ extension: 'txt' }, supported)).toBe(true)
    expect(isSupportedFile({ extension: 'md' }, supported)).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isSupportedFile({ extension: 'PDF' }, supported)).toBe(true)
    expect(isSupportedFile({ extension: 'TXT' }, supported)).toBe(true)
  })

  it('returns false for unsupported extensions', () => {
    expect(isSupportedFile({ extension: 'docx' }, supported)).toBe(false)
    expect(isSupportedFile({ extension: 'png' }, supported)).toBe(false)
  })

  it('returns false when extension is missing', () => {
    expect(isSupportedFile({}, supported)).toBe(false)
    expect(isSupportedFile(undefined, supported)).toBe(false)
  })
})
