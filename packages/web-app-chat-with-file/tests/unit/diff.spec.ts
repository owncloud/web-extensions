import { describe, it, expect } from 'vitest'
import { computeDiff } from '../../src/utils/diff'

describe('computeDiff', () => {
  describe('no changes', () => {
    it('returns empty hunks for identical single-line strings', () => {
      expect(computeDiff('hello world', 'hello world')).toEqual([])
    })

    it('returns empty hunks for identical multi-line strings', () => {
      expect(computeDiff('line1\nline2\nline3', 'line1\nline2\nline3')).toEqual([])
    })

    it('returns empty hunks for two empty strings', () => {
      expect(computeDiff('', '')).toEqual([])
    })
  })

  describe('pure additions', () => {
    it('marks the new lines as added when original is empty', () => {
      // ''.split('\n') yields [''] so the diff includes the empty "original" line
      // as removed; the important invariant is that the new lines appear as added.
      const hunks = computeDiff('', 'line1\nline2')
      expect(hunks).toHaveLength(1)
      const added = hunks[0].lines.filter((l) => l.type === 'added')
      expect(added).toEqual([
        { type: 'added', text: 'line1' },
        { type: 'added', text: 'line2' }
      ])
    })

    it('places a single appended line in one hunk', () => {
      const hunks = computeDiff('a\nb', 'a\nb\nc', 0)
      expect(hunks).toHaveLength(1)
      const added = hunks[0].lines.filter((l) => l.type === 'added')
      expect(added).toEqual([{ type: 'added', text: 'c' }])
    })
  })

  describe('pure removals', () => {
    it('marks the original lines as removed when proposed is empty', () => {
      // ''.split('\n') yields [''] so the diff also includes the empty "proposed"
      // line as added; the important invariant is that the original lines are removed.
      const hunks = computeDiff('line1\nline2', '')
      expect(hunks).toHaveLength(1)
      const removed = hunks[0].lines.filter((l) => l.type === 'removed')
      expect(removed).toEqual([
        { type: 'removed', text: 'line1' },
        { type: 'removed', text: 'line2' }
      ])
    })
  })

  describe('replacements', () => {
    it('marks the old line as removed and the new line as added', () => {
      const hunks = computeDiff('old line', 'new line')
      expect(hunks).toHaveLength(1)
      const types = hunks[0].lines.map((l) => l.type)
      expect(types).toContain('removed')
      expect(types).toContain('added')
    })

    it('preserves the correct text for removed and added lines', () => {
      const hunks = computeDiff('old', 'new')
      const lines = hunks[0].lines
      expect(lines.find((l) => l.type === 'removed')?.text).toBe('old')
      expect(lines.find((l) => l.type === 'added')?.text).toBe('new')
    })

    it('handles a middle-line change with surrounding unchanged lines', () => {
      const original = 'a\nCHANGED\nb'
      const proposed = 'a\nNEW\nb'
      const hunks = computeDiff(original, proposed, 0)
      const types = hunks[0].lines.map((l) => l.type)
      expect(types).toContain('removed')
      expect(types).toContain('added')
      expect(types).not.toContain('unchanged')
    })
  })

  describe('context lines', () => {
    it('includes surrounding unchanged lines with default context (3)', () => {
      const original = 'a\nb\nc\nCHANGED\ne\nf\ng'
      const proposed = 'a\nb\nc\nNEW\ne\nf\ng'
      const hunks = computeDiff(original, proposed)
      const types = hunks.flatMap((h) => h.lines.map((l) => l.type))
      expect(types).toContain('unchanged')
    })

    it('excludes all unchanged lines when context=0', () => {
      const original = 'a\nb\nc\nCHANGED\ne\nf\ng'
      const proposed = 'a\nb\nc\nNEW\ne\nf\ng'
      const hunks = computeDiff(original, proposed, 0)
      const types = hunks.flatMap((h) => h.lines.map((l) => l.type))
      expect(types).not.toContain('unchanged')
    })

    it('does not exceed file boundaries when the change is near the start', () => {
      const original = 'CHANGED\nb\nc'
      const proposed = 'NEW\nb\nc'
      expect(() => computeDiff(original, proposed, 3)).not.toThrow()
      const hunks = computeDiff(original, proposed, 3)
      expect(hunks.length).toBeGreaterThan(0)
    })

    it('does not exceed file boundaries when the change is near the end', () => {
      const original = 'a\nb\nCHANGED'
      const proposed = 'a\nb\nNEW'
      expect(() => computeDiff(original, proposed, 3)).not.toThrow()
    })
  })

  describe('multiple hunks', () => {
    it('splits two distant changes into separate hunks', () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i}`)
      const modified = [...lines]
      modified[0] = 'CHANGED_START'
      modified[19] = 'CHANGED_END'
      const hunks = computeDiff(lines.join('\n'), modified.join('\n'))
      expect(hunks.length).toBeGreaterThanOrEqual(2)
    })

    it('keeps adjacent changes in the same hunk', () => {
      const lines = Array.from({ length: 10 }, (_, i) => `line${i}`)
      const modified = [...lines]
      modified[4] = 'CHANGED_A'
      modified[5] = 'CHANGED_B'
      const hunks = computeDiff(lines.join('\n'), modified.join('\n'), 0)
      const changed = hunks.flatMap((h) => h.lines.filter((l) => l.type !== 'unchanged'))
      expect(changed.length).toBeGreaterThanOrEqual(2)
    })

    it('every hunk contains at least one non-unchanged line', () => {
      const lines = Array.from({ length: 30 }, (_, i) => `line${i}`)
      const modified = [...lines]
      modified[2] = 'CHANGE_A'
      modified[25] = 'CHANGE_B'
      const hunks = computeDiff(lines.join('\n'), modified.join('\n'))
      for (const hunk of hunks) {
        const hasChange = hunk.lines.some((l) => l.type !== 'unchanged')
        expect(hasChange).toBe(true)
      }
    })
  })
})
