export interface CollectionAssignment {
  fileId: string
  collection: string
}

function toAssignments(value: unknown): CollectionAssignment[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (v): v is Record<string, unknown> =>
        !!v &&
        typeof v === 'object' &&
        typeof (v as Record<string, unknown>).fileId === 'string' &&
        typeof (v as Record<string, unknown>).collection === 'string'
    )
    .map((v) => ({
      fileId: (v.fileId as string).trim(),
      collection: (v.collection as string).trim()
    }))
    .filter((a) => a.fileId !== '' && a.collection !== '')
}

/**
 * Strict parser: expects the LLM response to be a JSON object of the shape
 * `{ "assignments": [{ "fileId": string, "collection": string }, ...] }` (per
 * response_format: json_object, which requires a top-level object, not a bare array).
 * A bare top-level array is also accepted for robustness. Throws if the response isn't
 * valid JSON at all — callers should fall back to parseLenientCollectionLines in that case.
 */
export function parseStrictCollections(raw: string): CollectionAssignment[] {
  const parsed = JSON.parse(raw) as unknown

  if (Array.isArray(parsed)) {
    return toAssignments(parsed)
  }
  if (parsed && typeof parsed === 'object') {
    return toAssignments((parsed as Record<string, unknown>).assignments)
  }
  return []
}

/**
 * Lenient fallback parser for the "one collection label per line" degrade format:
 * `fileId: collection label` (also tolerates `fileId - collection` and `fileId,collection`).
 * Malformed or blank lines are skipped silently rather than failing the whole batch.
 */
export function parseLenientCollectionLines(raw: string): CollectionAssignment[] {
  const assignments: CollectionAssignment[] = []

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    // Colon/comma are matched first since they're unambiguous. A bare hyphen is only treated
    // as a delimiter when surrounded by whitespace ("fileId - collection") — real fileIds
    // routinely contain embedded hyphens (e.g. UUID-based oCIS ids), and matching those would
    // split the fileId itself apart instead of finding the intended separator.
    const match = line.match(/^(.+?)\s*[:,]\s*(.+)$/) ?? line.match(/^(.+?)\s+-\s+(.+)$/)
    if (!match) continue

    const fileId = match[1].trim().replace(/^[-*\d.)\s]+/, '')
    const collection = match[2].trim()
    if (!fileId || !collection) continue

    assignments.push({ fileId, collection })
  }

  return assignments
}
