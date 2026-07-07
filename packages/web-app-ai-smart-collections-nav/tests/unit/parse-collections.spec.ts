import { describe, it, expect } from 'vitest'
import { parseStrictCollections, parseLenientCollectionLines } from '../../src/utils/parse-collections'

describe('parseStrictCollections', () => {
  it('parses an object with an "assignments" array', () => {
    const raw = JSON.stringify({
      assignments: [
        { fileId: 'f1', collection: 'Invoices' },
        { fileId: 'f2', collection: 'Contracts' }
      ]
    })
    expect(parseStrictCollections(raw)).toEqual([
      { fileId: 'f1', collection: 'Invoices' },
      { fileId: 'f2', collection: 'Contracts' }
    ])
  })

  it('also accepts a bare top-level array', () => {
    const raw = JSON.stringify([{ fileId: 'f1', collection: 'Invoices' }])
    expect(parseStrictCollections(raw)).toEqual([{ fileId: 'f1', collection: 'Invoices' }])
  })

  it('trims whitespace around fileId and collection', () => {
    const raw = JSON.stringify({ assignments: [{ fileId: '  f1  ', collection: '  Invoices  ' }] })
    expect(parseStrictCollections(raw)).toEqual([{ fileId: 'f1', collection: 'Invoices' }])
  })

  it('filters out entries with a non-string fileId or collection', () => {
    const raw = JSON.stringify({
      assignments: [
        { fileId: 'f1', collection: 'Invoices' },
        { fileId: 42, collection: 'Contracts' },
        { fileId: 'f3', collection: null }
      ]
    })
    expect(parseStrictCollections(raw)).toEqual([{ fileId: 'f1', collection: 'Invoices' }])
  })

  it('filters out entries missing fileId or collection entirely', () => {
    const raw = JSON.stringify({ assignments: [{ fileId: 'f1' }, { collection: 'Invoices' }] })
    expect(parseStrictCollections(raw)).toEqual([])
  })

  it('filters out entries that are blank after trimming', () => {
    const raw = JSON.stringify({ assignments: [{ fileId: '   ', collection: 'Invoices' }] })
    expect(parseStrictCollections(raw)).toEqual([])
  })

  it('filters out non-object array entries', () => {
    const raw = JSON.stringify({ assignments: ['not an object', null, 42] })
    expect(parseStrictCollections(raw)).toEqual([])
  })

  it('returns an empty array when "assignments" is missing from the object', () => {
    const raw = JSON.stringify({ foo: 'bar' })
    expect(parseStrictCollections(raw)).toEqual([])
  })

  it('returns an empty array when "assignments" is not an array', () => {
    const raw = JSON.stringify({ assignments: 'not an array' })
    expect(parseStrictCollections(raw)).toEqual([])
  })

  it('returns an empty array when the parsed value is null', () => {
    expect(parseStrictCollections('null')).toEqual([])
  })

  it('returns an empty array when the parsed value is a primitive', () => {
    expect(parseStrictCollections('42')).toEqual([])
    expect(parseStrictCollections('"just a string"')).toEqual([])
  })

  it('throws when the response is not valid JSON at all', () => {
    expect(() => parseStrictCollections('this is not json')).toThrow()
  })

  it('throws on JSON with trailing markdown code fences', () => {
    expect(() => parseStrictCollections('```json\n{"assignments":[]}\n```')).toThrow()
  })
})

describe('parseLenientCollectionLines', () => {
  it('parses one "fileId: collection" assignment per line', () => {
    const raw = 'f1: Invoices\nf2: Contracts'
    expect(parseLenientCollectionLines(raw)).toEqual([
      { fileId: 'f1', collection: 'Invoices' },
      { fileId: 'f2', collection: 'Contracts' }
    ])
  })

  it('also accepts a "fileId - collection" separator', () => {
    expect(parseLenientCollectionLines('f1 - Invoices')).toEqual([{ fileId: 'f1', collection: 'Invoices' }])
  })

  it('also accepts a "fileId,collection" separator', () => {
    expect(parseLenientCollectionLines('f1,Invoices')).toEqual([{ fileId: 'f1', collection: 'Invoices' }])
  })

  it('does not split on hyphens embedded in the fileId itself', () => {
    const raw = 'seed-invoice-1: Invoices\nseed-contract-1: Contracts\nseed-notes-1: Meeting notes'
    expect(parseLenientCollectionLines(raw)).toEqual([
      { fileId: 'seed-invoice-1', collection: 'Invoices' },
      { fileId: 'seed-contract-1', collection: 'Contracts' },
      { fileId: 'seed-notes-1', collection: 'Meeting notes' }
    ])
  })

  it('still splits on a "fileId - collection" separator when the fileId contains hyphens', () => {
    expect(parseLenientCollectionLines('seed-invoice-1 - Invoices')).toEqual([
      { fileId: 'seed-invoice-1', collection: 'Invoices' }
    ])
  })

  it('strips leading bullet/numbering punctuation from the fileId', () => {
    expect(parseLenientCollectionLines('- f1: Invoices')).toEqual([{ fileId: 'f1', collection: 'Invoices' }])
    expect(parseLenientCollectionLines('* f1: Invoices')).toEqual([{ fileId: 'f1', collection: 'Invoices' }])
    expect(parseLenientCollectionLines('1. f1: Invoices')).toEqual([{ fileId: 'f1', collection: 'Invoices' }])
  })

  it('skips blank lines', () => {
    expect(parseLenientCollectionLines('f1: Invoices\n\n\nf2: Contracts')).toEqual([
      { fileId: 'f1', collection: 'Invoices' },
      { fileId: 'f2', collection: 'Contracts' }
    ])
  })

  it('skips lines with no recognizable separator', () => {
    expect(parseLenientCollectionLines('this line has no separator at all')).toEqual([])
  })

  it('skips a line whose fileId reduces to nothing but bullet punctuation', () => {
    // "-" is both the leading bullet AND the only separator candidate, so after
    // `match[1].replace(/^[-*\d.)\s]+/, '')` strips it, fileId is '' and the line is dropped.
    expect(parseLenientCollectionLines('- : Invoices')).toEqual([])
  })

  it('skips lines with no leading fileId content at all before the separator', () => {
    expect(parseLenientCollectionLines(': Invoices')).toEqual([])
  })

  it('returns only the valid lines from a mix of well-formed and malformed input', () => {
    const raw = ['f1: Invoices', 'no separator here', '', 'f2: Contracts', ':  '].join('\n')
    expect(parseLenientCollectionLines(raw)).toEqual([
      { fileId: 'f1', collection: 'Invoices' },
      { fileId: 'f2', collection: 'Contracts' }
    ])
  })

  it('returns an empty array for empty input', () => {
    expect(parseLenientCollectionLines('')).toEqual([])
  })
})
