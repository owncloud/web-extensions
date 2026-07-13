export interface ClusterableFile {
  fileId: string
  name: string
  excerpt?: string
}

/**
 * Collapses whitespace and replaces embedded double quotes with a Unicode look-alike so
 * user-controlled file names/excerpts can never break out of a double-quoted prompt field.
 */
function sanitizeForPrompt(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/"/g, '”').trim()
}

/**
 * Plain-text fallback format instructions, shared between the structured prompt (as an
 * embedded fallback the model can use if it cannot produce JSON) and any standalone use.
 * One line per file: "fileId: collection label".
 */
export function buildLenientClusteringPrompt(files: ClusterableFile[]): string {
  const fileList = files.map((f) => `${f.fileId}\t${sanitizeForPrompt(f.name)}`).join('\n')
  return [
    'If you cannot produce valid JSON, respond instead with one line per file in the exact',
    'format `fileId: collection label` (no extra punctuation, no markdown). Every file must',
    'appear on exactly one line.',
    '\n\nFiles (fileId, name):\n' + fileList
  ].join(' ')
}

/**
 * Builds the clustering prompt sent to the LLM: primary instructions ask for a JSON object
 * (response_format: json_object requires a top-level object, not a bare array) containing an
 * "assignments" array of {fileId, collection}. The lenient plain-text format is embedded as a
 * fallback the model may use if it cannot comply with the JSON instructions, so a single
 * request/response round-trip covers both branches of the degrade ladder.
 */
export function buildClusteringPrompt(files: ClusterableFile[], lang: string): string {
  const fileList = files
    .map((f) => {
      const excerpt = f.excerpt ? ` — excerpt: "${sanitizeForPrompt(f.excerpt)}"` : ''
      return `- fileId: ${f.fileId}, name: "${sanitizeForPrompt(f.name)}"${excerpt}`
    })
    .join('\n')

  return [
    'Group the following files into a small number of thematic collections (e.g. "Invoices",',
    '"Contracts", "Meeting notes") based on their file name and, when available, a short',
    'content excerpt.',
    `Respond in the language with BCP 47 tag "${lang}".`,
    'Respond with a JSON object with exactly one key, "assignments": an array of objects, each',
    'with "fileId" (string, copied verbatim from the input) and "collection" (string, a short',
    'human-readable label). Every file must appear in exactly one assignment. Reuse the exact',
    'same collection label for files that belong together — do not invent near-duplicate labels',
    '(e.g. "Invoice" vs "Invoices") for what is really one group.',
    'Return only the JSON object. No markdown, no code fences, no extra text.',
    buildLenientClusteringPrompt(files),
    '\n\nFiles:\n' + fileList
  ].join(' ')
}
