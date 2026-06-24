import { describe, it, expect } from 'vitest'
import { isSupportedFile } from '../../src/utils/file-support'

const SUPPORTED_EXTS = ['csv', 'tsv']

describe('isSupportedFile', () => {
  it('accepts .csv extension', () => {
    expect(isSupportedFile({ extension: 'csv' }, SUPPORTED_EXTS)).toBe(true)
  })

  it('accepts .tsv extension', () => {
    expect(isSupportedFile({ extension: 'tsv' }, SUPPORTED_EXTS)).toBe(true)
  })

  it('accepts uppercase CSV extension (case-insensitive)', () => {
    expect(isSupportedFile({ extension: 'CSV' }, SUPPORTED_EXTS)).toBe(true)
  })

  it('accepts uppercase TSV extension (case-insensitive)', () => {
    expect(isSupportedFile({ extension: 'TSV' }, SUPPORTED_EXTS)).toBe(true)
  })

  it('rejects .pdf extension', () => {
    expect(isSupportedFile({ extension: 'pdf' }, SUPPORTED_EXTS)).toBe(false)
  })

  it('rejects .txt extension', () => {
    expect(isSupportedFile({ extension: 'txt' }, SUPPORTED_EXTS)).toBe(false)
  })

  it('rejects .jpg extension', () => {
    expect(isSupportedFile({ extension: 'jpg' }, SUPPORTED_EXTS)).toBe(false)
  })

  it('rejects a resource with no extension property', () => {
    expect(isSupportedFile({}, SUPPORTED_EXTS)).toBe(false)
  })

  it('rejects undefined resource', () => {
    expect(isSupportedFile(undefined, SUPPORTED_EXTS)).toBe(false)
  })
})
