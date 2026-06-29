import { ref, type Ref } from 'vue'
import { useClientService, useSpacesStore, useUserStore } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import { useLLM, type LLMConfig, type LLMStatus } from './useLLM'
import { parseCSV } from '../utils/csv-parse'

const MAX_COLUMNS = 30
const MAX_SAMPLES = 5
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

// ISO-8601 date prefix: YYYY-MM-DD — intentionally strict to avoid false positives
// like '5', 'Q1', or plain numbers being tagged as dates.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/

// Session-level consent flag: resets on full page reload.
// Once the user confirms, we don't ask again for the rest of the SPA session.
let sessionConsentGiven = false

/**
 * Resets the session consent flag.
 * Intended only for test isolation — do not call in production code.
 */
export function _resetSessionConsentForTesting(): void {
  sessionConsentGiven = false
}

/**
 * Sets the session consent flag to true, bypassing the consent dialog.
 * Intended only for test isolation — do not call in production code.
 */
export function _giveSessionConsentForTesting(): void {
  sessionConsentGiven = true
}

export interface InsightsResource {
  id?: string
  name?: string
  extension?: string
  storageId?: string
  path?: string
  size?: number
}

export interface ColumnInsight {
  column: string
  type: string
}

export interface RangeInsight {
  column: string
  min?: string
  max?: string
}

export interface InsightsResult {
  columnTypes: ColumnInsight[]
  ranges: RangeInsight[]
  observations: string[]
}

export interface UseInsightsResult {
  status: Ref<LLMStatus>
  isAnalyzing: Ref<boolean>
  insightsResult: Ref<InsightsResult | null>
  panelError: Ref<string | null>
  showConsentDialog: Ref<boolean>
  triggerInsights: () => Promise<void>
  confirmConsent: () => Promise<void>
  denyConsent: () => void
  ensureReady: () => Promise<void>
}

function inferType(samples: string[]): string {
  const nonEmpty = samples.filter((s) => s !== '')
  if (nonEmpty.length === 0) return 'string'
  const boolValues = new Set(['true', 'false', 'yes', 'no', '1', '0'])
  if (nonEmpty.every((s) => boolValues.has(s.toLowerCase()))) return 'boolean'
  // Check date before number: ISO_DATE_RE is strict enough not to match bare numbers.
  if (nonEmpty.every((s) => ISO_DATE_RE.test(s))) return 'date'
  if (nonEmpty.every((s) => !isNaN(parseFloat(s)) && isFinite(Number(s)))) return 'number'
  return 'string'
}

function numericRange(samples: string[]): { min?: string; max?: string } {
  const nums = samples.map(Number).filter((n) => !isNaN(n))
  if (nums.length === 0) return {}
  return { min: String(Math.min(...nums)), max: String(Math.max(...nums)) }
}

export function useInsights(
  llmConfig: LLMConfig | null,
  resource: Ref<InsightsResource | null | undefined>
): UseInsightsResult {
  const { $gettext, current: gettextLanguage } = useGettext()
  const llm = useLLM(llmConfig)
  const clientService = useClientService()
  const spacesStore = useSpacesStore()
  const userStore = useUserStore()

  const isAnalyzing = ref(false)
  const panelError = ref<string | null>(null)
  const insightsResult = ref<InsightsResult | null>(null)
  const showConsentDialog = ref(false)

  function handleLlmError(err: unknown): string {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return $gettext('The AI service did not respond in time. Please try again later.')
    }
    if (err instanceof TypeError) {
      return $gettext(
        'Could not reach the AI service. Check your network connection and try again.'
      )
    }
    if (err instanceof Error) {
      const match = /LLM request failed: (\d+)/.exec(err.message)
      if (match) {
        const code = parseInt(match[1], 10)
        if (code === 401 || code === 403) {
          return $gettext(
            'Access to the AI service was denied. Your session may have expired — try reloading the page.'
          )
        }
        if (code === 404) {
          return $gettext(
            'The AI endpoint could not be found. Check the endpoint URL in admin settings.'
          )
        }
        if (code === 429) {
          return $gettext('The AI service is currently busy. Please try again in a moment.')
        }
        if (code >= 500) {
          return $gettext('The AI service is temporarily unavailable. Please try again later.')
        }
      }
      return err.message
    }
    return $gettext('Something went wrong while analyzing the file. Please try again.')
  }

  function getUserLanguage(): string {
    return userStore.user?.preferredLanguage || gettextLanguage
  }

  async function fetchInsights(): Promise<InsightsResult> {
    const res = resource.value
    if (!res?.storageId || !res?.path) {
      throw new Error($gettext('Resource location not available'))
    }

    // File-size guard: reject before fetching to avoid buffering large files in memory.
    if (res.size !== undefined && res.size > MAX_FILE_BYTES) {
      throw new Error(
        $gettext(
          'This file is too large to analyze (limit: 5 MB). Only CSV/TSV files up to 5 MB are supported.'
        )
      )
    }

    const space = spacesStore.getSpace(res.storageId)
    if (!space) {
      throw new Error($gettext('Could not resolve file space'))
    }

    const { response } = await clientService.webdav.getFileContents(
      space,
      { path: res.path },
      { responseType: 'text' }
    )
    const csvText = response.data as string

    const delimiter = res.extension?.toLowerCase() === 'tsv' ? '\t' : ','
    const preview = parseCSV(csvText, delimiter)

    if (preview.headers.length === 0) {
      throw new Error($gettext('The file appears to be empty or has no recognizable columns.'))
    }

    // Cap columns and build compact column summaries for the prompt
    const cappedHeaders = preview.headers.slice(0, MAX_COLUMNS)
    const cappedColumns = preview.columns.slice(0, MAX_COLUMNS)

    const columnSummaries = cappedHeaders.map((name, ci) => {
      const allSamples = cappedColumns[ci]
      const type = inferType(allSamples)
      const samples = allSamples.filter((s) => s !== '').slice(0, MAX_SAMPLES)
      const summary: Record<string, unknown> = { column: name, type, samples }
      if (type === 'number') {
        const range = numericRange(allSamples)
        if (range.min !== undefined) summary.min = range.min
        if (range.max !== undefined) summary.max = range.max
      }
      return summary
    })

    const lang = getUserLanguage()
    const promptContent = [
      `Analyze the following CSV/TSV file "${res.name ?? 'this file'}".`,
      `Respond in the language with BCP 47 tag "${lang}".`,
      'Respond with a JSON object with exactly three keys:',
      '"columnTypes": an array of objects with "column" (string) and "type" (string) fields — the confirmed type for each column (number, date, boolean, or string).',
      '"ranges": an array of objects with "column" (string) and optional "min" and "max" (strings) — include only numeric or date columns.',
      '"observations": an array of 2-3 plain strings, each one natural-language observation about the data.',
      'Return only the JSON object. No markdown, no code fences, no extra text.',
      '\n\nColumn summaries:\n' + JSON.stringify(columnSummaries)
    ].join(' ')

    const responseText = await llm.complete([{ role: 'user', content: promptContent }], {
      maxTokens: 512,
      responseFormat: { type: 'json_object' }
    })

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(responseText) as Record<string, unknown>
    } catch {
      parsed = {}
    }

    const toColumnInsights = (val: unknown): ColumnInsight[] => {
      if (!Array.isArray(val)) return []
      return val
        .filter((v) => v && typeof v === 'object' && 'column' in v && 'type' in v)
        .map((v) => {
          const obj = v as Record<string, unknown>
          return { column: String(obj.column), type: String(obj.type) }
        })
    }

    const toRangeInsights = (val: unknown): RangeInsight[] => {
      if (!Array.isArray(val)) return []
      return val
        .filter((v) => v && typeof v === 'object' && 'column' in v)
        .map((v) => {
          const obj = v as Record<string, unknown>
          const ri: RangeInsight = { column: String(obj.column) }
          if (typeof obj.min === 'string') ri.min = obj.min
          if (typeof obj.max === 'string') ri.max = obj.max
          return ri
        })
    }

    const toObservations = (val: unknown): string[] =>
      Array.isArray(val) ? val.map((s) => String(s).trim()).filter(Boolean) : []

    return {
      columnTypes: toColumnInsights(parsed.columnTypes),
      ranges: toRangeInsights(parsed.ranges),
      observations: toObservations(parsed.observations)
    }
  }

  function ensureReady(): Promise<void> {
    // useLLM sets status synchronously at initialisation; nothing to do here
    return Promise.resolve()
  }

  async function doAnalyze(): Promise<void> {
    isAnalyzing.value = true
    panelError.value = null
    try {
      insightsResult.value = await fetchInsights()
    } catch (err) {
      panelError.value = handleLlmError(err)
    } finally {
      isAnalyzing.value = false
    }
  }

  async function triggerInsights(): Promise<void> {
    if (llm.status.value === 'cross-origin') {
      panelError.value = $gettext(
        'The AI endpoint must be on the same server as ownCloud. Cross-origin requests are not supported.'
      )
      return
    }
    if (llm.status.value !== 'ready') return

    if (!sessionConsentGiven) {
      showConsentDialog.value = true
      return
    }

    await doAnalyze()
  }

  async function confirmConsent(): Promise<void> {
    sessionConsentGiven = true
    showConsentDialog.value = false
    await doAnalyze()
  }

  function denyConsent(): void {
    showConsentDialog.value = false
  }

  return {
    status: llm.status,
    isAnalyzing,
    insightsResult,
    panelError,
    showConsentDialog,
    triggerInsights,
    confirmConsent,
    denyConsent,
    ensureReady
  }
}
