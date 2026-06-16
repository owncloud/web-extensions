import { ref, watch, type Ref } from 'vue'
import * as pdfjs from 'pdfjs-dist'
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { useAuthStore, useClientService, useSpacesStore } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import { useLlm, type LlmConfig, type LlmStatus } from './useLlm'

export const TEXT_EXTENSIONS = new Set(['txt', 'md'])
const MAX_CONTENT_CHARS = 12_000

const MAX_CACHE_ENTRIES = 20
const messageCache = new Map<string, ChatMessage[]>()

export interface ChatResource {
  id?: string
  name?: string
  extension?: string
  storageId?: string
  path?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  /** Full proposed file content returned via the apply_edit tool call, if any */
  editProposal?: string
  /** Original file content at the time the edit was proposed, used to compute the diff */
  originalContent?: string
  /** True once the edit has been written to the file */
  applied?: boolean
}

export interface UseChatResult {
  status: Ref<LlmStatus>
  messages: Ref<ChatMessage[]>
  isLoading: Ref<boolean>
  isApplying: Ref<boolean>
  panelError: Ref<string | null>
  sendMessage: (text: string, mode: 'chat' | 'edit') => Promise<void>
  applyEdit: (proposal: string, index: number) => Promise<void>
  discardEdit: (index: number) => void
  clearChat: () => void
  ensureReady: () => void
}

export function useChat(
  llmConfig: LlmConfig | null,
  resource: Ref<ChatResource | null | undefined>
): UseChatResult {
  const { $gettext } = useGettext()
  const { status, config, ensureReady } = useLlm(llmConfig)
  const authStore = useAuthStore()
  const clientService = useClientService()
  const spacesStore = useSpacesStore()

  const resourceId = resource.value?.id ?? ''
  const messages = ref<ChatMessage[]>(messageCache.get(resourceId) ?? [])
  const isLoading = ref(false)
  const isApplying = ref(false)
  const panelError = ref<string | null>(null)

  watch(
    () => resource.value?.id,
    (newId, oldId) => {
      if (newId && oldId && newId !== oldId) {
        panelError.value = null
        isApplying.value = false
        cachedFileText = null
        cachedResourceId = undefined
        cachedFileEtag = null
      }
      if (newId) {
        messages.value = messageCache.get(newId) ?? []
      }
    }
  )

  watch(messages, (msgs) => {
    const id = resource.value?.id
    if (id) {
      if (messageCache.size >= MAX_CACHE_ENTRIES && !messageCache.has(id)) {
        const oldest = messageCache.keys().next().value
        if (oldest !== undefined) {
          messageCache.delete(oldest)
        }
      }
      messageCache.set(id, msgs)
    }
  })

  // Cache file text and ETag per resource to avoid redundant fetches within a session
  let cachedResourceId: string | undefined
  let cachedFileText: string | null = null
  let cachedFileEtag: string | null = null

  function buildHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = authStore.accessToken
    if (token) {
      h['Authorization'] = `Bearer ${token}`
    }
    return h
  }

  async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
    // Run the PDF.js worker in the main thread (fake worker mode) to avoid
    // Worker/CSP restrictions — same technique used by the AI summarizer.
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

    if (cachedResourceId === res.id && cachedFileText !== null) {
      return cachedFileText
    }

    const space = spacesStore.getSpace(res.storageId)
    if (!space) {
      throw new Error($gettext('Could not resolve file space'))
    }

    const ext = res.extension?.toLowerCase() ?? ''
    let text: string

    if (TEXT_EXTENSIONS.has(ext)) {
      const { response, headers } = await clientService.webdav.getFileContents(
        space,
        { path: res.path },
        { responseType: 'text' }
      )
      text = response.data as string
      const headerMap = headers as Record<string, string>
      const etagKey = Object.keys(headerMap).find((k) => k.toLowerCase() === 'etag')
      cachedFileEtag = etagKey !== undefined ? headerMap[etagKey] : null
    } else {
      const { response } = await clientService.webdav.getFileContents(
        space,
        { path: res.path },
        { responseType: 'arraybuffer' }
      )
      text = (await extractPdfText(response.data as ArrayBuffer)).slice(0, MAX_CONTENT_CHARS)
      cachedFileEtag = null
    }

    cachedResourceId = res.id
    cachedFileText = text
    return text
  }

  function aiErrorMessage(httpStatus: number): string {
    if (httpStatus === 401 || httpStatus === 403) {
      return $gettext(
        'Access to the AI service was denied. Your session may have expired — try reloading the page.'
      )
    }
    if (httpStatus === 404) {
      return $gettext(
        'The AI endpoint could not be found. Check the endpoint URL in admin settings.'
      )
    }
    if (httpStatus === 429) {
      return $gettext('The AI service is currently busy. Please try again in a moment.')
    }
    if (httpStatus >= 500) {
      return $gettext('The AI service is temporarily unavailable. Please try again later.')
    }
    return $gettext('The AI service returned an unexpected response. Please try again.')
  }

  async function sendMessage(text: string, mode: 'chat' | 'edit'): Promise<void> {
    if (status.value === 'unconfigured' || isLoading.value) {
      return
    }

    const userMessage: ChatMessage = { role: 'user', content: text }
    messages.value = [...messages.value, userMessage]
    isLoading.value = true
    panelError.value = null

    try {
      const cfg = config.value
      if (!cfg) {
        messages.value = messages.value.slice(0, -1)
        return
      }
      const base = cfg.endpoint.replace(/\/$/, '')

      // Refuse to attach credentials or send file content to a cross-origin endpoint.
      // The intended path is browser → same-origin ai-llm-proxy → LLM; a foreign
      // endpoint would receive the user's oCIS bearer token.
      let endpointOrigin: string
      try {
        endpointOrigin = new URL(cfg.endpoint).origin
      } catch {
        endpointOrigin = ''
      }
      if (endpointOrigin !== window.location.origin) {
        messages.value = messages.value.slice(0, -1)
        panelError.value = $gettext(
          'The AI endpoint must be on the same server as ownCloud. Contact your administrator.'
        )
        return
      }

      const fileText = await fetchFileText()

      if (mode === 'edit' && fileText.length > MAX_CONTENT_CHARS) {
        messages.value = messages.value.slice(0, -1)
        panelError.value = $gettext(
          'This file is too large to edit here (limit: 12,000 characters). Use a text editor instead.'
        )
        return
      }

      let systemContent: string
      let requestMessages: Array<{ role: string; content: string }>

      if (mode === 'edit') {
        // Edit path: model returns ONLY new file content; no history needed.
        // fileText is guaranteed ≤ MAX_CONTENT_CHARS by the guard above.
        systemContent =
          `You are editing the file "${resource.value?.name ?? 'this file'}". ` +
          "Apply the user's instruction and return ONLY the complete updated file content. " +
          'Do not include any explanation, preamble, commentary, markdown fences, or surrounding text. ' +
          'Your entire response must be the raw file content and nothing else.' +
          `\n\n--- current file content ---\n${fileText}\n--- end of file content ---`
        requestMessages = [
          { role: 'system', content: systemContent },
          { role: 'user', content: text }
        ]
      } else {
        // Chat path: conversational, keeps history; truncate context for large files.
        const fileTextForContext = fileText.slice(0, MAX_CONTENT_CHARS)
        systemContent =
          `You are a helpful assistant. The user has opened the file "${resource.value?.name ?? 'this file'}". ` +
          'Answer questions about its content accurately and concisely.' +
          `\n\nFile content:\n${fileTextForContext}`
        requestMessages = [
          { role: 'system', content: systemContent },
          ...messages.value.map((m) => ({ role: m.role, content: m.content }))
        ]
      }

      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: buildHeaders(),
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({ model: cfg.model, messages: requestMessages, max_tokens: 4096 })
      })

      if (!res.ok) {
        throw new Error(aiErrorMessage(res.status))
      }

      const data = (await res.json()) as {
        choices?: Array<{
          message?: { content?: string | null }
          finish_reason?: string | null
        }>
      }

      if (mode === 'edit' && data.choices?.[0]?.finish_reason === 'length') {
        messages.value = messages.value.slice(0, -1)
        panelError.value = $gettext(
          'The AI response was cut off before the edit was complete. Try with a shorter instruction or a smaller file.'
        )
        return
      }

      let reply = (data.choices?.[0]?.message?.content ?? '').trim()

      if (mode === 'edit') {
        // Models sometimes fence their output despite being told not to.
        // Only strip when the whole response is wrapped (paired markers) so a
        // file legitimately opening with a fence is not mangled.
        if (/^```[\w]*\r?\n/.test(reply) && /\r?\n```\s*$/.test(reply)) {
          reply = reply.replace(/^```[\w]*\r?\n/, '').replace(/\r?\n```\s*$/, '')
        }
      }

      if (mode === 'edit' && reply) {
        messages.value = [
          ...messages.value,
          {
            role: 'assistant',
            content: $gettext('Edit ready — click "Apply to file" to save the changes.'),
            editProposal: reply,
            originalContent: fileText
          }
        ]
      } else {
        messages.value = [...messages.value, { role: 'assistant', content: reply }]
      }
    } catch (err) {
      // Roll back the optimistic user message so the user can retry cleanly
      messages.value = messages.value.slice(0, -1)
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
          err instanceof Error ? err.message : $gettext('Something went wrong. Please try again.')
      }
    } finally {
      isLoading.value = false
    }
  }

  async function applyEdit(proposal: string, index: number): Promise<void> {
    const res = resource.value
    if (!res?.storageId || !res?.path) {
      panelError.value = $gettext('Resource location not available')
      return
    }
    if (!TEXT_EXTENSIONS.has(res.extension?.toLowerCase() ?? '')) {
      panelError.value = $gettext('Editing is only supported for text files.')
      return
    }
    const space = spacesStore.getSpace(res.storageId)
    if (!space) {
      panelError.value = $gettext('Could not resolve file space')
      return
    }

    isApplying.value = true
    panelError.value = null
    try {
      await clientService.webdav.putFileContents(space, {
        path: res.path,
        content: proposal,
        previousEntityTag: cachedFileEtag ?? ''
      })
      messages.value = messages.value.map((msg, i) => {
        if (i !== index) return msg
        return { ...msg, content: $gettext('Edit applied successfully.'), applied: true }
      })
      cachedFileText = null
      cachedResourceId = undefined
      cachedFileEtag = null
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 412) {
        panelError.value = $gettext(
          'The file was changed by someone else. Reload the panel and try again.'
        )
      } else {
        panelError.value = $gettext('Could not save the file. Please try again.')
      }
    } finally {
      isApplying.value = false
    }
  }

  function discardEdit(index: number): void {
    messages.value = messages.value.map((msg, i) => {
      if (i !== index) return msg
      return {
        ...msg,
        content: $gettext('Edit discarded.'),
        editProposal: undefined,
        originalContent: undefined
      }
    })
  }

  function clearChat(): void {
    const id = resource.value?.id
    if (id) {
      messageCache.delete(id)
    }
    messages.value = []
    isApplying.value = false
    panelError.value = null
    cachedFileText = null
    cachedResourceId = undefined
    cachedFileEtag = null
  }

  return {
    status,
    messages,
    isLoading,
    isApplying,
    panelError,
    sendMessage,
    applyEdit,
    discardEdit,
    clearChat,
    ensureReady
  }
}
