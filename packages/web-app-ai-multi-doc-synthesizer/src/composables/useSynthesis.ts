import { ref, type Ref } from 'vue'
import { useClientService, useSpacesStore } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import { useLLM, type LLMConfig, type ChatMessage } from './useLLM'

const SUPPORTED_TEXT_EXTS = new Set(['txt', 'md'])
const MAX_CONTENT_CHARS = 10_000

// Maximum number of file-fetch or per-file LLM requests to run concurrently.
const CONCURRENCY_LIMIT = 3

export interface SynthesisResource {
  id?: string
  name?: string
  extension?: string
  storageId?: string
  path?: string
}

export interface SynthesisResult {
  themes: string[]
  differences: string[]
  actionItems: string[]
}

export interface UseSynthesisResult {
  isSynthesizing: Ref<boolean>
  synthesisResult: Ref<SynthesisResult | null>
  panelError: Ref<string | null>
  truncationWarning: Ref<string | null>
  triggerSynthesis: () => Promise<void>
  saveAsMarkdown: () => Promise<string>
}

interface FetchedContent {
  name: string
  content: string
  truncated: boolean
}

/**
 * Run an array of async tasks with a maximum concurrency of `limit`.
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let index = 0

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const i = index++
      results[i] = await tasks[i]()
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export function useSynthesis(
  llmConfig: LLMConfig | null,
  resources: Ref<SynthesisResource[]>
): UseSynthesisResult {
  const { $gettext, $ngettext } = useGettext()
  const clientService = useClientService()
  const spacesStore = useSpacesStore()

  const isSynthesizing = ref(false)
  const synthesisResult = ref<SynthesisResult | null>(null)
  const panelError = ref<string | null>(null)
  const truncationWarning = ref<string | null>(null)

  // Only create useLLM when configured; avoids any request on unconfigured installations.
  const llm = llmConfig !== null ? useLLM(llmConfig) : null

  async function fetchFileContent(res: SynthesisResource): Promise<FetchedContent> {
    if (!res.storageId || !res.path) {
      throw new Error($gettext('Resource location not available'))
    }
    const space = spacesStore.getSpace(res.storageId)
    if (!space) {
      throw new Error($gettext('Could not resolve file space'))
    }
    const ext = res.extension?.toLowerCase() ?? ''
    if (!SUPPORTED_TEXT_EXTS.has(ext)) {
      throw new Error(`${$gettext('Unsupported file type')}: .${ext}`)
    }
    const { response } = await clientService.webdav.getFileContents(
      space,
      { path: res.path },
      { responseType: 'text' }
    )
    // response.data is untyped by the WebDAV client; plain text was requested above.
    const fullText = (response as { data: string }).data
    const truncated = fullText.length > MAX_CONTENT_CHARS
    return {
      name: res.name ?? res.path,
      content: truncated ? fullText.slice(0, MAX_CONTENT_CHARS) : fullText,
      truncated
    }
  }

  function parseSynthesisResult(raw: unknown): SynthesisResult {
    const obj =
      typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const toStringArray = (val: unknown): string[] =>
      Array.isArray(val)
        ? val
            .filter((s): s is string => typeof s === 'string')
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    return {
      themes: toStringArray(obj.themes),
      differences: toStringArray(obj.differences),
      actionItems: toStringArray(obj.actionItems)
    }
  }

  const SYNTHESIS_SCHEMA = JSON.stringify({
    themes: ['shared topic across documents'],
    differences: ['key difference between documents'],
    actionItems: ['concrete action item']
  })

  async function synthesizeSinglePass(contents: FetchedContent[]): Promise<SynthesisResult> {
    const docBlocks = contents
      .map(
        (f, i) =>
          `--- Document ${i + 1}: ${f.name} ---\n${f.content}\n--- End of Document ${i + 1} ---`
      )
      .join('\n\n')

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'You are an expert document analyst. Analyze the provided documents and extract cross-document insights.'
      },
      {
        role: 'user',
        content: [
          'Analyze the following documents and identify:',
          '1. "themes": shared themes or topics appearing across multiple documents',
          '2. "differences": key differences or contrasting points between documents',
          '3. "actionItems": concrete action items mentioned or implied across all documents',
          '',
          docBlocks
        ].join('\n')
      }
    ]
    const raw = await llm!.completeJSON<unknown>(messages, SYNTHESIS_SCHEMA)
    return parseSynthesisResult(raw)
  }

  function summarizeOne(content: FetchedContent): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: `Briefly summarize this document in 3-5 bullet points. Document: "${content.name}"\n\n${content.content}`
      }
    ]
    return llm!.complete(messages, { maxTokens: 300 })
  }

  async function synthesizeTwoPass(contents: FetchedContent[]): Promise<SynthesisResult> {
    // Pass 1: summarize each document individually with concurrency limit.
    const tasks = contents.map((c) => () => summarizeOne(c))
    const summaries = await runWithConcurrency(tasks, CONCURRENCY_LIMIT)

    const summaryBlocks = contents
      .map((f, i) => `--- Summary of "${f.name}" ---\n${summaries[i]}\n---`)
      .join('\n\n')

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are an expert document analyst. Synthesize the provided document summaries.'
      },
      {
        role: 'user',
        content: [
          'Based on these document summaries, identify:',
          '1. "themes": shared themes across all documents',
          '2. "differences": key differences between the documents',
          '3. "actionItems": concrete action items extracted from the documents',
          '',
          summaryBlocks
        ].join('\n')
      }
    ]
    const raw = await llm!.completeJSON<unknown>(messages, SYNTHESIS_SCHEMA)
    return parseSynthesisResult(raw)
  }

  async function triggerSynthesis(): Promise<void> {
    if (llm === null) {
      return // unconfigured; the action should be hidden, but guard defensively
    }

    isSynthesizing.value = true
    panelError.value = null
    truncationWarning.value = null

    try {
      const tasks = resources.value.map((r) => () => fetchFileContent(r))
      const contents = await runWithConcurrency(tasks, CONCURRENCY_LIMIT)

      // Warn the user if any files were truncated
      const truncatedCount = contents.filter((c) => c.truncated).length
      if (truncatedCount > 0) {
        truncationWarning.value = $ngettext(
          'Note: 1 file was truncated to %{limit} characters for analysis.',
          'Note: %{n} files were truncated to %{limit} characters for analysis.',
          truncatedCount,
          { n: truncatedCount, limit: MAX_CONTENT_CHARS.toLocaleString() }
        )
      }

      const totalChars = contents.reduce((s, c) => s + c.content.length, 0)

      // Use single-pass when the combined content is small enough for a single prompt.
      // Without capability probing, we use a conservative 8k-char budget (fits ~4k tokens).
      const SINGLE_PASS_CHAR_LIMIT = 8_000
      synthesisResult.value =
        totalChars <= SINGLE_PASS_CHAR_LIMIT
          ? await synthesizeSinglePass(contents)
          : await synthesizeTwoPass(contents)
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
            : $gettext('Something went wrong. Please try again.')
      }
    } finally {
      isSynthesizing.value = false
    }
  }

  async function saveAsMarkdown(): Promise<string> {
    const result = synthesisResult.value
    if (!result) {
      throw new Error($gettext('No synthesis result to save'))
    }

    const first = resources.value[0]
    if (!first?.storageId || !first?.path) {
      throw new Error($gettext('Resource location not available'))
    }

    const space = spacesStore.getSpace(first.storageId)
    if (!space) {
      throw new Error($gettext('Could not resolve file space'))
    }

    const folderPath = first.path.includes('/')
      ? first.path.substring(0, first.path.lastIndexOf('/'))
      : ''

    // Include a time component to guarantee uniqueness within the same day.
    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const time = now.toISOString().slice(11, 19).replace(/:/g, '')
    const savePath = `${folderPath ? folderPath + '/' : ''}synthesis-${date}-${time}.md`

    const lines: string[] = ['# Document Synthesis', '']
    if (result.themes.length > 0) {
      lines.push('## Shared Themes', ...result.themes.map((t) => `- ${t}`), '')
    }
    if (result.differences.length > 0) {
      lines.push('## Key Differences', ...result.differences.map((d) => `- ${d}`), '')
    }
    if (result.actionItems.length > 0) {
      lines.push('## Action Items', ...result.actionItems.map((a) => `- ${a}`), '')
    }
    const content = lines.join('\n')

    await clientService.webdav.putFileContents(space, {
      path: savePath,
      content,
      previousEntityTag: ''
    })

    return savePath
  }

  return { isSynthesizing, synthesisResult, panelError, truncationWarning, triggerSynthesis, saveAsMarkdown }
}
