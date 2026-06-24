import { describe, it, expect } from 'vitest'
import { parseCSV } from '../../src/utils/csv-parse'

describe('parseCSV', () => {
  it('returns empty result for empty input', () => {
    expect(parseCSV('')).toEqual({ headers: [], columns: [] })
  })

  it('parses headers and a single data row', () => {
    const { headers, columns } = parseCSV('name,age\nAlice,30')
    expect(headers).toEqual(['name', 'age'])
    expect(columns).toEqual([['Alice'], ['30']])
  })

  it('handles quoted fields containing commas', () => {
    const { headers, columns } = parseCSV('city,label\n"Portland, OR",home')
    expect(columns[0]).toEqual(['Portland, OR'])
  })

  it('unescapes doubled double-quotes inside quoted fields (RFC-4180)', () => {
    const { headers, columns } = parseCSV('note\n"say ""hello"""')
    expect(columns[0]).toEqual(['say "hello"'])
  })

  it('handles CRLF line endings', () => {
    const { headers, columns } = parseCSV('a,b\r\n1,2\r\n3,4')
    expect(headers).toEqual(['a', 'b'])
    expect(columns[0]).toEqual(['1', '3'])
    expect(columns[1]).toEqual(['2', '4'])
  })

  it('respects maxRows and does not include the header row in the limit', () => {
    const rows = Array.from({ length: 5 }, (_, i) => `${i},val`).join('\n')
    const csv = 'id,v\n' + rows
    const { columns } = parseCSV(csv, ',', 3)
    expect(columns[0].length).toBeLessThanOrEqual(3)
  })

  it('parses TSV when delimiter is set to tab', () => {
    const { headers, columns } = parseCSV('x\ty\n10\t20', '\t')
    expect(headers).toEqual(['x', 'y'])
    expect(columns[0]).toEqual(['10'])
  })
})
