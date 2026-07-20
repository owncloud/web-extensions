export type SequenceResult =
  | { type: 'complete'; sequence: string }
  | { type: 'pending' }
  | { type: 'none' }

export class KeySequence {
  private pending: string | null = null
  private timeoutId: ReturnType<typeof setTimeout> | null = null
  private readonly timeoutMs: number
  private readonly sequences: string[]
  private readonly onTimeout: ((key: string) => void) | undefined

  constructor(options?: {
    timeoutMs?: number
    sequences?: string[]
    onTimeout?: (key: string) => void
  }) {
    this.timeoutMs = options?.timeoutMs ?? 600
    this.sequences = options?.sequences ?? []
    this.onTimeout = options?.onTimeout
  }

  press(key: string): SequenceResult {
    if (this.pending === null) {
      if (this.sequences.some((s) => s[0] === key)) {
        this.pending = key
        this.startTimeout()
        return { type: 'pending' }
      }
      return { type: 'none' }
    }

    const candidate = this.pending + key
    this.clearTimeoutOnly()
    this.pending = null

    if (this.sequences.includes(candidate)) {
      return { type: 'complete', sequence: candidate }
    }
    return { type: 'none' }
  }

  reset(): void {
    this.clearTimeoutOnly()
    this.pending = null
  }

  private startTimeout(): void {
    this.clearTimeoutOnly()
    this.timeoutId = setTimeout(() => {
      const key = this.pending
      this.pending = null
      this.timeoutId = null
      if (key !== null) this.onTimeout?.(key)
    }, this.timeoutMs)
  }

  private clearTimeoutOnly(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
}
