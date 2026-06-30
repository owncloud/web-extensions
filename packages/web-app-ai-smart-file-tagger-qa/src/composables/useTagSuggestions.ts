import { ref, type Ref } from 'vue'
import * as pdfjs from 'pdfjs-dist'
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { useClientService, useSpacesStore } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import { useLLM, type LLMConfig } from './useLLM'
import { isSupportedForContentExtraction, getFileMimeType } from '../utils/file-support'

const MAX_CONTENT_CHARS = 12_000

export interface TagSuggestion {
  name: string
  confidence: number | null
  selected: boolean
}

export type TagSuggestionsStatus = 'unconfigured' | 'loading' | 'ready' | 'error'

export interface TagResource {
  id?: string
  fileId?: string
  name?: string
  extension?: string
  mimeType?: string
  storageId?: string
  path?: string
}

export interface UseTagSuggestionsReturn {
  status: Ref<TagSuggestionsStatus>
  tags: Ref<TagSuggestion[]>
  isGenerating: Ref<boolean>
  error: Ref<string | null>
  fetchSuggestions(): Promise<void>
  applyTags(): Promise<void>
}

export function useTagSuggestions(
  resource: Ref<TagResource | null | undefined>,
  llmConfig: LLMConfig | null
): UseTagSuggestionsReturn {
  const { $gettext } = useGettext()
  const llm = useLLM(llmConfig)
  const clientService = useClientService()
  const spacesStore = useSpacesStore()

  const status = ref<TagSuggestionsStatus>(llmConfig ? 'loading' : 'unconfigured')
  const tags = ref<TagSuggestion[]>([])
  const isGenerating = ref(false)
  const error = ref<string | null>(null)

  async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
    // Assign the worker to globalThis to run PDF.js in the main thread (fake worker mode).
    // This avoids Worker/CSP restrictions already present in the oCIS container.
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
      if (text.length >= MAX_CONTENT_CHARS) break
    }
    return text.slice(0, MAX_CONTENT_CHARS)
  }

  async function fetchFileContent(): Promise<string> {
    const res = resource.value
    if (!res?.storageId || !res?.path) {
      throw new Error($gettext('Resource location not available'))
    }
    const space = spacesStore.getSpace(res.storageId)
    if (!space) throw new Error($gettext('Could not resolve file space'))

    const ext = res.extension?.toLowerCase() ?? ''

    if (ext === 'txt' || ext === 'md') {
      const { response } = await clientService.webdav.getFileContents(
        space,
        { path: res.path },
        { responseType: 'text' }
      )
      return (response.data as string).slice(0, MAX_CONTENT_CHARS)
    }

    const { response } = await clientService.webdav.getFileContents(
      space,
      { path: res.path },
      { responseType: 'arraybuffer' }
    )
    return extractPdfText(response.data as ArrayBuffer)
  }

  function buildUserPrompt(contentMode: boolean, content: string): string {
    const res = resource.value
    if (contentMode) {
      return [
        `Suggest 3-5 descriptive tags for this file.`,
        `File name: "${res?.name ?? 'unknown'}"`,
        `File content:\n${content}`,
        `Return ONLY a JSON object: {"tags":[{"name":"tag-name","confidence":0.9},...]}`,
        `Each tag: max 30 chars, lowercase, no spaces (use hyphens). No markdown, no explanation.`
      ].join('\n')
    }
    return [
      `Suggest 3-5 descriptive tags for this file.`,
      `File name: "${res?.name ?? 'unknown'}"`,
      `File type: ${getFileMimeType(res ?? {})}`,
      `Return ONLY a JSON object: {"tags":[{"name":"tag-name","confidence":0.9},...]}`,
      `Each tag: max 30 chars, lowercase, no spaces (use hyphens). No markdown, no explanation.`
    ].join('\n')
  }

  function parseTagsFromResponse(text: string): TagSuggestion[] {
    const clean = text.replace(/^```[a-z]*\n?/m, '').replace(/```\s*$/m, '').trim()
    try {
      const parsed = JSON.parse(clean) as { tags?: Array<{ name?: string; confidence?: number }> }
      if (Array.isArray(parsed.tags) && parsed.tags.length > 0) {
        return parsed.tags
          .filter((t) => typeof t.name === 'string' && t.name.trim().length > 0)
          .map((t) => ({
            name: t.name!.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 30),
            confidence: typeof t.confidence === 'number' ? Math.min(1, Math.max(0, t.confidence)) : null,
            selected: true
          }))
          .slice(0, 5)
      }
    } catch { /* fall through to plain-text parse */ }

    // Plain-text fallback: split by comma, newline, or semicolon
    return text
      .split(/[,\n;]+/)
      .map((s) => s.replace(/^[-*•\s"'`#]+|["'`\s]+$/g, '').toLowerCase().replace(/\s+/g, '-'))
      .filter((s) => s.length > 0 && s.length <= 30)
      .slice(0, 5)
      .map((name) => ({ name, confidence: null, selected: true }))
  }

  async function fetchSuggestions(): Promise<void> {
    if (!llmConfig || llm.status.value !== 'ready') {
      status.value = 'unconfigured'
      return
    }

    isGenerating.value = true
    status.value = 'loading'
    error.value = null
    tags.value = []

    try {
      let content = ''
      let contentMode = false

      if (isSupportedForContentExtraction(resource.value ?? {})) {
        content = await fetchFileContent()
        contentMode = true
      }

      const responseText = await llm.complete(
        [{ role: 'user', content: buildUserPrompt(contentMode, content) }],
        { maxTokens: 256, temperature: 0.3 }
      )

      const parsed = parseTagsFromResponse(responseText)
      if (parsed.length === 0) {
        throw new Error($gettext('No tags were suggested. Please try again.'))
      }
      tags.value = parsed
      status.value = 'ready'
    } catch (err) {
      status.value = 'error'
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        error.value = $gettext(
          'The AI service did not respond in time. Please try again later.'
        )
      } else if (err instanceof TypeError) {
        error.value = $gettext(
          'Could not reach the AI service. Check your network connection and try again.'
        )
      } else {
        error.value =
          err instanceof Error
            ? err.message
            : $gettext('Something went wrong while suggesting tags. Please try again.')
      }
    } finally {
      isGenerating.value = false
    }
  }

  async function applyTags(): Promise<void> {
    const res = resource.value
    const resourceId = res?.fileId ?? res?.id
    if (!resourceId) throw new Error($gettext('Resource ID not available'))

    const selectedTagNames = tags.value.filter((t) => t.selected).map((t) => t.name)
    if (selectedTagNames.length === 0) return

    await clientService.graphAuthenticated.tags.assignTags({
      resourceId,
      tags: selectedTagNames
    })
  }

  return { status, tags, isGenerating, error, fetchSuggestions, applyTags }
}
