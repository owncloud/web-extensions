import type { IconFillType } from '@ownclouders/web-pkg'

export type Lane = 'draft' | 'in-review' | 'final'

export const LANE_ORDER: Lane[] = ['draft', 'in-review', 'final']

export const DEFAULT_LANE: Lane = 'draft'

export interface LaneMeta {
  lane: Lane
  // Canonical English label: the wire vocabulary sent to/expected from the LLM and the
  // fallback line-parser keyword. UI components translate lane text themselves via a
  // literal $pgettext() call per lane, so gettext string extraction keeps working.
  label: string
  icon: { name: string; fillType: IconFillType }
}

export const LANE_META: Record<Lane, LaneMeta> = {
  draft: { lane: 'draft', label: 'Draft', icon: { name: 'edit-2', fillType: 'line' } },
  'in-review': {
    lane: 'in-review',
    label: 'In Review',
    icon: { name: 'eye', fillType: 'line' }
  },
  final: { lane: 'final', label: 'Final', icon: { name: 'checkbox-circle', fillType: 'line' } }
}

export function isLane(value: unknown): value is Lane {
  return value === 'draft' || value === 'in-review' || value === 'final'
}

// Order matters: 'final' and 'in-review' keywords are checked before the 'draft' catch-all
// so a line like "final draft" (an LLM hedging) resolves to the more decisive lane.
export function laneFromKeyword(text: string): Lane | undefined {
  const normalized = text.toLowerCase()
  if (/\bfinal\b|\bapproved\b|\bdone\b/.test(normalized)) return 'final'
  if (/\bin[- ]?review\b|\breview\b/.test(normalized)) return 'in-review'
  if (/\bdraft\b/.test(normalized)) return 'draft'
  return undefined
}

/**
 * Fallback parser for a non-JSON LLM response: one "<fileId-or-name>: <lane>" line per file,
 * mirroring the try/catch-then-raw-text pattern in useFolderBrief.fetchBrief.
 */
export function parseLaneLines(text: string): Map<string, Lane> {
  const result = new Map<string, Lane>()
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const separatorIndex = line.lastIndexOf(':')
    if (separatorIndex === -1) continue
    const key = line
      .slice(0, separatorIndex)
      .trim()
      .replace(/^[-*\d.\s]+/, '')
    const lane = laneFromKeyword(line.slice(separatorIndex + 1))
    if (key && lane) {
      result.set(key, lane)
    }
  }
  return result
}
