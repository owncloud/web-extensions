import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { useResourcesStore, useUserStore } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import type { Resource } from '@ownclouders/web-client'
import { useLLM, type LLMConfig, type LLMStatus } from './useLLM'
import { useExcerpt } from './useExcerpt'
import { DEFAULT_LANE, isLane, parseLaneLines, type Lane } from '../utils/lane'

// Batched into a single prompt per classification run rather than one call per file, to keep
// latency and request volume bounded for large project spaces. Files beyond the cap are left
// unclassified and default to Draft via the `lanes` fallback (surfaced through `truncated`).
const MAX_FILES = 60
const MAX_PROMPT_EXCERPT_CHARS = 400

export type BoardLanes = Record<Lane, Resource[]>

export interface UseBoardClassificationResult {
  status: Ref<LLMStatus>
  lanes: ComputedRef<BoardLanes>
  isClassifying: Ref<boolean>
  panelError: Ref<string | null>
  truncated: Ref<boolean>
  classify: () => Promise<void>
}

interface ClassificationEntry {
  fileId: string
  lane: Lane
}

export function useBoardClassification(llmConfig: LLMConfig | null): UseBoardClassificationResult {
  const { $gettext, current: gettextLanguage } = useGettext()
  const llm = useLLM(llmConfig)
  const { fetchExcerpt } = useExcerpt()
  const resourcesStore = useResourcesStore()
  const userStore = useUserStore()

  const isClassifying = ref(false)
  const panelError = ref<string | null>(null)
  const truncated = ref(false)
  const classification = ref<Map<string, Lane>>(new Map())

  const files = computed<Resource[]>(() =>
    resourcesStore.activeResources.filter((resource) => !resource.isFolder)
  )

  const lanes = computed<BoardLanes>(() => {
    const grouped: BoardLanes = { draft: [], 'in-review': [], final: [] }
    for (const file of files.value) {
      const lane = classification.value.get(file.id) ?? DEFAULT_LANE
      grouped[lane].push(file)
    }
    return grouped
  })

  function getUserLanguage(): string {
    return userStore.user?.preferredLanguage || gettextLanguage
  }

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
    return $gettext('Something went wrong while classifying the project space. Please try again.')
  }

  async function buildPromptLines(candidates: Resource[]): Promise<string[]> {
    const lines: string[] = []
    for (const resource of candidates) {
      const excerpt = await fetchExcerpt(resource)
      const trimmedExcerpt = excerpt?.trim().replace(/\s+/g, ' ').slice(0, MAX_PROMPT_EXCERPT_CHARS)
      lines.push(
        trimmedExcerpt
          ? `- id: ${resource.id} | name: ${resource.name} | excerpt: ${trimmedExcerpt}`
          : `- id: ${resource.id} | name: ${resource.name}`
      )
    }
    return lines
  }

  function parseClassification(raw: string, candidates: Resource[]): Map<string, Lane> {
    const result = new Map<string, Lane>()
    let entries: ClassificationEntry[] = []
    try {
      const parsed = JSON.parse(raw) as unknown
      const list = Array.isArray(parsed)
        ? parsed
        : (parsed as { classifications?: unknown })?.classifications
      if (Array.isArray(list)) {
        entries = list
          .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
          .filter((v) => typeof v.fileId === 'string' && isLane(v.lane))
          .map((v) => ({ fileId: v.fileId as string, lane: v.lane as Lane }))
      }
    } catch {
      entries = []
    }

    if (entries.length > 0) {
      for (const entry of entries) {
        result.set(entry.fileId, entry.lane)
      }
      return result
    }

    // Malformed/non-JSON response: fall back to "<fileId-or-name>: <lane>" line parsing.
    const byLine = parseLaneLines(raw)
    for (const candidate of candidates) {
      const lane = byLine.get(candidate.id) ?? (candidate.name ? byLine.get(candidate.name) : undefined)
      if (lane) {
        result.set(candidate.id, lane)
      }
    }
    return result
  }

  async function doClassify(): Promise<void> {
    const candidates = files.value.slice(0, MAX_FILES)
    truncated.value = files.value.length > candidates.length

    if (candidates.length === 0) {
      classification.value = new Map()
      return
    }

    const lang = getUserLanguage()
    const lines = await buildPromptLines(candidates)
    const prompt = [
      'Classify each of the following project files into exactly one lane: "draft", "in-review", or "final",',
      'based on its file name and content excerpt (when present).',
      `Any explanatory text must be written in the language with BCP 47 tag "${lang}" — lane values themselves must stay in English.`,
      'Return a JSON object with exactly one key "classifications": an array of objects,',
      'each with a "fileId" (must match the "id" given below verbatim) and a "lane" (one of "draft", "in-review", "final").',
      'Return only the JSON object. No markdown, no code fences, no extra text.',
      '\n\nFiles:\n' + lines.join('\n')
    ].join(' ')

    const responseText = await llm.complete([{ role: 'user', content: prompt }], {
      maxTokens: 1024,
      responseFormat: { type: 'json_object' }
    })

    classification.value = parseClassification(responseText, candidates)
  }

  async function classify(): Promise<void> {
    if (llm.status.value === 'cross-origin') {
      panelError.value = $gettext(
        'The AI endpoint must be on the same server as ownCloud. Cross-origin requests are not supported.'
      )
      return
    }
    if (llm.status.value !== 'ready') {
      // Unconfigured: every file defaults to Draft via the `lanes` fallback, no error shown.
      classification.value = new Map()
      return
    }

    isClassifying.value = true
    panelError.value = null
    try {
      await doClassify()
    } catch (err) {
      panelError.value = handleLlmError(err)
    } finally {
      isClassifying.value = false
    }
  }

  return { status: llm.status, lanes, isClassifying, panelError, truncated, classify }
}
