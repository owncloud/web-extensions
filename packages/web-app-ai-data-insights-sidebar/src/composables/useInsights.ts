import { ref, type Ref } from 'vue'
import { useAuthStore, useClientService, useSpacesStore, useUserStore } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import { useLlm, type LlmConfig, type LlmStatus } from './useLlm'
import { parseCSV } from '../utils/csv-parse'

const MAX_COLUMNS = 30
const MAX_SAMPLES = 5

export interface InsightsResource {
  id?: string
  name?: string
  extension?: string
  storageId?: string
  path?: string
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
  status: Ref<LlmStatus>
  isAnalyzing: Ref<boolean>
  insightsResult: Ref<InsightsResult | null>
  panelError: Ref<string | null>
  triggerInsights: () => Promise<void>
  ensureReady: () => Promise<void>
}

function inferType(samples: string[]): string {
  const nonEmpty = samples.filter((s) => s !== '')
  if (nonEmpty.length === 0) return 'string'
  const boolValues = new Set(['true', 'false', 'yes', 'no', '1', '0'])
  if (nonEmpty.every((s) => boolValues.has(s.toLowerCase()))) return 'boolean'
  if (nonEmpty.every((s) => !isNaN(parseFloat(s)) && isFinite(Number(s)))) return 'number'
  if (nonEmpty.every((s) => !isNaN(Date.parse(s)))) return 'date'
  return 'string'
}

function numericRange(samples: string[]): { min?: string; max?: string } {
  const nums = samples.map(Number).filter((n) => !isNaN(n))
  if (nums.length === 0) return {}
  return { min: String(Math.min(...nums)), max: String(Math.max(...nums)) }
}

export function useInsights(
  llmConfig: LlmConfig | null,
  resource: Ref<InsightsResource | null | undefined>
): UseInsightsResult {
  const { $gettext, current: gettextLanguage } = useGettext()
  const { status, config, ensureReady } = useLlm(llmConfig)
  const authStore = useAuthStore()
  const clientService = useClientService()
  const spacesStore = useSpacesStore()
  const userStore = useUserStore()

  const isAnalyzing = ref(false)
  const panelError = ref<string | null>(null)
  const insightsResult = ref<InsightsResult | null>(null)

  function buildHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = authStore.accessToken
    if (token) h['Authorization'] = `Bearer ${token}`
    return h
  }

  function aiErrorMessage(statusCode: number): string {
    if (statusCode === 401 || statusCode === 403) {
      return $gettext(
        'Access to the AI service was denied. Your session may have expired — try reloading the page.'
      )
    }
    if (statusCode === 404) {
      return $gettext(
        'The AI endpoint could not be found. Check the endpoint URL in admin settings.'
      )
    }
    if (statusCode === 429) {
      return $gettext('The AI service is currently busy. Please try again in a moment.')
    }
    if (statusCode >= 500) {
      return $gettext('The AI service is temporarily unavailable. Please try again later.')
    }
    return $gettext('The AI service returned an unexpected response. Please try again.')
  }

  function getUserLanguage(): string {
    return userStore.user?.preferredLanguage || gettextLanguage
  }

  async function fetchInsights(): Promise<InsightsResult> {
    const res = resource.value
    if (!res?.storageId || !res?.path) {
      throw new Error($gettext('Resource location not available'))
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

    const cfg = config.value
    if (!cfg) {
      throw new Error($gettext('Admin needs to configure the AI endpoint.'))
    }

    // Same-origin check — the proxy validates the oCIS token; forwarding it cross-origin leaks credentials
    let endpointOrigin: string
    try {
      endpointOrigin = new URL(cfg.endpoint).origin
    } catch {
      endpointOrigin = ''
    }
    if (endpointOrigin !== window.location.origin) {
      throw new Error(
        $gettext(
          'The AI endpoint must be on the same server as ownCloud. Cross-origin requests are not supported.'
        )
      )
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
    const base = cfg.endpoint.replace(/\/$/, '')

    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          {
            role: 'user',
            content: [
              `Analyze the following CSV/spreadsheet file "${res.name ?? 'this file'}".`,
              `Respond in the language with BCP 47 tag "${lang}".`,
              'Respond with a JSON object with exactly three keys:',
              '"columnTypes": an array of objects with "column" (string) and "type" (string) fields — the confirmed type for each column (number, date, boolean, or string).',
              '"ranges": an array of objects with "column" (string) and optional "min" and "max" (strings) — include only numeric or date columns.',
              '"observations": an array of 2-3 plain strings, each one natural-language observation about the data.',
              'Return only the JSON object. No markdown, no code fences, no extra text.',
              '\n\nColumn summaries:\n' + JSON.stringify(columnSummaries)
            ].join(' ')
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 512
      })
    })

    if (!r.ok) {
      throw new Error(aiErrorMessage(r.status))
    }

    const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content ?? '{}'
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text) as Record<string, unknown>
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
      Array.isArray(val)
        ? val
            .map((s) => String(s).trim())
            .filter(Boolean)
        : []

    return {
      columnTypes: toColumnInsights(parsed.columnTypes),
      ranges: toRangeInsights(parsed.ranges),
      observations: toObservations(parsed.observations)
    }
  }

  async function triggerInsights(): Promise<void> {
    if (status.value === 'unconfigured') return

    isAnalyzing.value = true
    panelError.value = null
    try {
      insightsResult.value = await fetchInsights()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        panelError.value = $gettext(
          'The AI service did not respond in time. Please try again later.'
        )
      } else if (err instanceof TypeError) {
        panelError.value = $gettext(
          'Could not reach the AI service. Check your network connection and try again.'
        )
      } else {
        panelError.value =
          err instanceof Error
            ? err.message
            : $gettext('Something went wrong while analyzing the file. Please try again.')
      }
    } finally {
      isAnalyzing.value = false
    }
  }

  return { status, isAnalyzing, insightsResult, panelError, triggerInsights, ensureReady }
}
