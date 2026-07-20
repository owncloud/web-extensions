import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { KeySequence } from '../../../src/composables/keySequence'

describe('KeySequence', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('completes a two-key sequence', () => {
    const seq = new KeySequence({ sequences: ['gg', 'dd'] })
    expect(seq.press('g')).toEqual({ type: 'pending' })
    expect(seq.press('g')).toEqual({ type: 'complete', sequence: 'gg' })
  })

  it('returns none for an unrecognized second key and clears pending', () => {
    const seq = new KeySequence({ sequences: ['gg', 'dd'] })
    expect(seq.press('g')).toEqual({ type: 'pending' })
    expect(seq.press('x')).toEqual({ type: 'none' })
    // pending cleared, so 'g' again starts fresh
    expect(seq.press('g')).toEqual({ type: 'pending' })
  })

  it('returns none for a key that is not a prefix of any sequence', () => {
    const seq = new KeySequence({ sequences: ['gg', 'dd'] })
    expect(seq.press('j')).toEqual({ type: 'none' })
  })

  it('auto-clears pending key after timeout', () => {
    const seq = new KeySequence({ sequences: ['gg'], timeoutMs: 600 })
    expect(seq.press('g')).toEqual({ type: 'pending' })
    vi.advanceTimersByTime(601)
    expect(seq.press('g')).toEqual({ type: 'pending' }) // treated as fresh start, not 'gg' completion
  })

  it('reset() clears pending immediately', () => {
    const seq = new KeySequence({ sequences: ['gg'] })
    expect(seq.press('g')).toEqual({ type: 'pending' })
    seq.reset()
    expect(seq.press('g')).toEqual({ type: 'pending' })
  })

  it('supports multiple sequences sharing a first character', () => {
    const seq = new KeySequence({ sequences: ['gg', 'gp', 'gs', 'gd', 'go'] })
    expect(seq.press('g')).toEqual({ type: 'pending' })
    expect(seq.press('p')).toEqual({ type: 'complete', sequence: 'gp' })
  })
})
