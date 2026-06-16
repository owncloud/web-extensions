export type DiffLineType = 'unchanged' | 'removed' | 'added'

export interface DiffLine {
  type: DiffLineType
  text: string
}

export interface DiffHunk {
  lines: DiffLine[]
}

// Guard: files larger than this skip the DP to avoid hundreds-of-MB allocation on the main thread
const MAX_DIFF_LINES = 2000

function lcsLineDiff(a: string[], b: string[]): DiffLine[] {
  const m = a.length
  const n = b.length

  if (m > MAX_DIFF_LINES || n > MAX_DIFF_LINES) {
    return []
  }

  const w = n + 1
  const dp = new Uint32Array((m + 1) * w)

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i * w + j] = dp[(i - 1) * w + (j - 1)] + 1
      } else {
        const up = dp[(i - 1) * w + j]
        const left = dp[i * w + (j - 1)]
        dp[i * w + j] = up > left ? up : left
      }
    }
  }

  // Build in reverse order with push, then flip once — avoids O((m+n)²) from unshift copies
  const result: DiffLine[] = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.push({ type: 'unchanged', text: a[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i * w + (j - 1)] >= dp[(i - 1) * w + j])) {
      result.push({ type: 'added', text: b[j - 1] })
      j--
    } else {
      result.push({ type: 'removed', text: a[i - 1] })
      i--
    }
  }
  result.reverse()
  return result
}

export function computeDiff(original: string, proposed: string, context = 3): DiffHunk[] {
  const a = original.split('\n')
  const b = proposed.split('\n')
  const lines = lcsLineDiff(a, b)

  const changedIndices = new Set<number>()
  lines.forEach((l, i) => {
    if (l.type !== 'unchanged') {
      changedIndices.add(i)
    }
  })

  if (changedIndices.size === 0) {
    return []
  }

  const visible = new Set<number>()
  changedIndices.forEach((idx) => {
    for (let k = Math.max(0, idx - context); k <= Math.min(lines.length - 1, idx + context); k++) {
      visible.add(k)
    }
  })

  const sorted = [...visible].sort((a, b) => a - b)
  const hunks: DiffHunk[] = []
  let current: DiffLine[] = []

  for (let k = 0; k < sorted.length; k++) {
    if (k > 0 && sorted[k] !== sorted[k - 1] + 1) {
      hunks.push({ lines: current })
      current = []
    }
    current.push(lines[sorted[k]])
  }
  if (current.length > 0) {
    hunks.push({ lines: current })
  }

  return hunks
}
