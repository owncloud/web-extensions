import { describe, it, expect } from 'vitest'
import { computeDiff, diffToText } from '../../src/utils/diff'

describe('computeDiff', () => {
  it('returns empty array for identical content', () => {
    expect(computeDiff('a\nb\nc', 'a\nb\nc')).toEqual([])
  })

  it('detects an added line', () => {
    const hunks = computeDiff('a\nb', 'a\nb\nc')
    const lines = hunks.flatMap((h) => h.lines)
    expect(lines.some((l) => l.type === 'added' && l.text === 'c')).toBe(true)
  })

  it('detects a removed line', () => {
    const hunks = computeDiff('a\nb\nc', 'a\nc')
    const lines = hunks.flatMap((h) => h.lines)
    expect(lines.some((l) => l.type === 'removed' && l.text === 'b')).toBe(true)
  })

  it('returns empty array when either side exceeds MAX_DIFF_LINES (2000)', () => {
    const longText = Array.from({ length: 2001 }, (_, i) => `line ${i}`).join('\n')
    expect(computeDiff(longText, 'short')).toEqual([])
    expect(computeDiff('short', longText)).toEqual([])
  })

  it('groups nearby changes into a single hunk', () => {
    const old = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n')
    const updated = old.replace('line 10', 'line TEN')
    const hunks = computeDiff(old, updated)
    expect(hunks.length).toBe(1)
  })

  it('splits distant changes into separate hunks', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`)
    const updated = [...lines]
    updated[0] = 'changed-first'
    updated[49] = 'changed-last'
    const hunks = computeDiff(lines.join('\n'), updated.join('\n'))
    expect(hunks.length).toBeGreaterThan(1)
  })

  it('handles empty old content (new lines are added)', () => {
    const hunks = computeDiff('', 'a\nb')
    const lines = hunks.flatMap((h) => h.lines)
    expect(lines.some((l) => l.type === 'added' && l.text === 'a')).toBe(true)
    expect(lines.some((l) => l.type === 'added' && l.text === 'b')).toBe(true)
  })

  it('handles empty new content (old lines are removed)', () => {
    const hunks = computeDiff('a\nb', '')
    const lines = hunks.flatMap((h) => h.lines)
    expect(lines.some((l) => l.type === 'removed' && l.text === 'a')).toBe(true)
    expect(lines.some((l) => l.type === 'removed' && l.text === 'b')).toBe(true)
  })
})

describe('diffToText', () => {
  it('prefixes added lines with "+"', () => {
    const hunks = computeDiff('a', 'a\nb')
    expect(diffToText(hunks)).toContain('+ b')
  })

  it('prefixes removed lines with "-"', () => {
    const hunks = computeDiff('a\nb', 'a')
    expect(diffToText(hunks)).toContain('- b')
  })

  it('prefixes unchanged context lines with two spaces', () => {
    const hunks = computeDiff('a\nb\nc', 'a\nB\nc')
    const text = diffToText(hunks)
    expect(text).toContain('  a')
    expect(text).toContain('  c')
  })

  it('separates hunks with "..."', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`)
    const updated = [...lines]
    updated[0] = 'changed-first'
    updated[49] = 'changed-last'
    const hunks = computeDiff(lines.join('\n'), updated.join('\n'))
    expect(diffToText(hunks)).toContain('...')
  })

  it('returns empty string for empty hunks array', () => {
    expect(diffToText([])).toBe('')
  })
})
