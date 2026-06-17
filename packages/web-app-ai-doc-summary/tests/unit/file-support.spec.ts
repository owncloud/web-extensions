import { describe, it, expect } from 'vitest'
import { isSupportedFile } from '../../src/utils/file-support'

describe('isSupportedFile', () => {
  it('accepts supported extensions', () => {
    expect(isSupportedFile({ extension: 'pdf' })).toBe(true)
    expect(isSupportedFile({ extension: 'md' })).toBe(true)
    expect(isSupportedFile({ extension: 'txt' })).toBe(true)
  })

  it('rejects unsupported extensions', () => {
    expect(isSupportedFile({ extension: 'png' })).toBe(false)
    expect(isSupportedFile({ extension: 'docx' })).toBe(false)
    expect(isSupportedFile({ extension: 'DOCX' })).toBe(false)
  })

  it('rejects resources without an extension', () => {
    expect(isSupportedFile({})).toBe(false)
    expect(isSupportedFile(undefined)).toBe(false)
  })
})
