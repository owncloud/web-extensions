import { ref, type Ref } from 'vue'
import * as pdfjs from 'pdfjs-dist'
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { useAuthStore, useClientService, useSpacesStore, useUserStore } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import { useLlm, type LlmConfig, type LlmStatus } from './useLlm'

const TEXT_EXTENSIONS = new Set(['txt', 'md'])
const MAX_CONTENT_CHARS = 12_000

export interface SummaryResource {
  id?: string
  name?: string
  extension?: string
  storageId?: string
  path?: string
}

export interface SummaryResult {
  overview: string
  keyPoints: string[]
}

export interface UseSummaryResult {
  status: Ref<LlmStatus>
  isGenerating: Ref<boolean>
  summaryResult: Ref<SummaryResult | null>
  panelError: Ref<string | null>
  triggerSummary: () => Promise<void>
  ensureReady: () => Promise<void>
}

export function useSummary(
  llmConfig: LlmConfig | null,
  resource: Ref<SummaryResource | null | undefined>
): UseSummaryResult {
  const { $gettext, current: gettextLanguage } = useGettext()
  const { status, config, ensureReady } = useLlm(llmConfig)
  const authStore = useAuthStore()
  const clientService = useClientService()
  const spacesStore = useSpacesStore()
  const userStore = useUserStore()

  const isGenerating = ref(false)
  const panelError = ref<string | null>(null)
  const summaryResult = ref<SummaryResult | null>(null)

  function buildHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = authStore.accessToken
    if (token) {
      h['Authorization'] = `Bearer ${token}`
    }
    return h
  }

  async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
    // Run the PDF.js worker in the main thread (fake worker mode).
    // pdfjs checks globalThis.pdfjsWorker?.WorkerMessageHandler before attempting
    // to spawn a real Worker, so this bypasses all Worker/CSP restrictions entirely.
    // Assigned here rather than at module level to avoid clobbering a real Worker
    // that another app (e.g. the preview panel) may have already registered.
    ;(globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = pdfjsWorker
    const pdf = await pdfjs.getDocument({ data: buffer }).promise
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .filter((item): item is TextItem => 'str' in item)
        .map((item) => item.str)
        .join(' ')
      text = text ? text + '\n\n' + pageText : pageText
      if (text.length >= MAX_CONTENT_CHARS) {
        break
      }
    }
    return text
  }

  async function fetchFileText(): Promise<string> {
    const res = resource.value
    if (!res?.storageId || !res?.path) {
      throw new Error($gettext('Resource location not available'))
    }

    const space = spacesStore.getSpace(res.storageId)
    if (!space) {
      throw new Error($gettext('Could not resolve file space'))
    }

    const ext = res.extension?.toLowerCase() ?? ''

    if (TEXT_EXTENSIONS.has(ext)) {
      const { response } = await clientService.webdav.getFileContents(
        space,
        { path: res.path },
        { responseType: 'text' }
      )
      return (response.data as string).slice(0, MAX_CONTENT_CHARS)
    }

    // PDF: fetch bytes and extract text with PDF.js
    const { response } = await clientService.webdav.getFileContents(
      space,
      { path: res.path },
      { responseType: 'arraybuffer' }
    )
    const text = await extractPdfText(response.data as ArrayBuffer)
    return text.slice(0, MAX_CONTENT_CHARS)
  }

  function aiErrorMessage(status: number): string {
    if (status === 401 || status === 403) {
      return $gettext(
        'Access to the AI service was denied. Your session may have expired — try reloading the page.'
      )
    }
    if (status === 404) {
      return $gettext(
        'The AI endpoint could not be found. Check the endpoint URL in admin settings.'
      )
    }
    if (status === 429) {
      return $gettext('The AI service is currently busy. Please try again in a moment.')
    }
    if (status >= 500) {
      return $gettext('The AI service is temporarily unavailable. Please try again later.')
    }

    return $gettext('The AI service returned an unexpected response. Please try again.')
  }

  function getUserLanguage(): string {
    return userStore.user?.preferredLanguage || gettextLanguage
  }

  async function fetchSummary(): Promise<SummaryResult> {
    const fileText = await fetchFileText()
    const cfg = config.value
    if (!cfg) {
      throw new Error($gettext('Admin needs to configure the AI endpoint.'))
    }
    const base = cfg.endpoint.replace(/\/$/, '')
    const lang = getUserLanguage()
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          {
            role: 'user',
            content: [
              `Summarize the following document "${resource.value?.name ?? 'this document'}".`,
              `Respond in the language with BCP 47 tag "${lang}".`,
              'Respond with a JSON object with exactly two keys:',
              '"overview": a 2-3 sentence paragraph describing what the document is about.',
              '"keyPoints": an array of 3-4 plain strings, each one key takeaway.',
              'Example: { "overview": "This report covers Q1 financial results.", "keyPoints": ["Revenue grew 12%.", "Costs reduced by 8%."] }',
              'Return only the JSON object. No markdown, no code fences, no extra text.',
              '\n\nDocument content:\n' + fileText
            ].join(' ')
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 512
      })
    })
    if (!res.ok) {
      throw new Error(aiErrorMessage(res.status))
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content ?? '{}'
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text) as Record<string, unknown>
    } catch {
      parsed = {}
    }
    const toStrings = (val: unknown): string[] =>
      Array.isArray(val)
        ? val
            .map((s) =>
              String(s)
                .replace(/^[>|<\s]+/, '')
                .trim()
            )
            .filter(Boolean)
        : []
    return {
      overview: typeof parsed.overview === 'string' ? parsed.overview.trim() : '',
      keyPoints: toStrings(parsed.keyPoints)
    }
  }

  async function triggerSummary(): Promise<void> {
    if (status.value === 'unconfigured') {
      return
    }

    isGenerating.value = true
    panelError.value = null
    try {
      summaryResult.value = await fetchSummary()
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
            : $gettext('Something went wrong while generating the summary. Please try again.')
      }
    } finally {
      isGenerating.value = false
    }
  }

  return { status, isGenerating, summaryResult, panelError, triggerSummary, ensureReady }
}
