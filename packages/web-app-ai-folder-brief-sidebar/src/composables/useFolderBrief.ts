import { ref, type Ref } from 'vue'
import { useClientService, useSpacesStore, useUserStore } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import type { Resource } from '@ownclouders/web-client'
import { useLlm, type LlmConfig, type LlmStatus } from './useLlm'

const MAX_LISTING_CHARS = 8_000

export interface BriefResult {
  summary: string
  filesByType?: string
  recentChanges?: string
  isStatic: boolean
}

export interface FolderResource {
  id?: string
  name?: string
  storageId?: string
  path?: string
  isFolder?: boolean
}

export interface UseFolderBriefResult {
  status: Ref<LlmStatus>
  isLoading: Ref<boolean>
  briefResult: Ref<BriefResult | null>
  panelError: Ref<string | null>
  triggerBrief: () => Promise<void>
  ensureReady: () => Promise<void>
}

export function useFolderBrief(
  llmConfig: LlmConfig | null,
  resource: Ref<FolderResource | null | undefined>
): UseFolderBriefResult {
  const { $gettext, current: gettextLanguage } = useGettext()
  const { status, config, ensureReady, buildHeaders } = useLlm(llmConfig)
  const clientService = useClientService()
  const spacesStore = useSpacesStore()
  const userStore = useUserStore()

  const isLoading = ref(false)
  const panelError = ref<string | null>(null)
  const briefResult = ref<BriefResult | null>(null)

  function getUserLanguage(): string {
    return userStore.user?.preferredLanguage || gettextLanguage
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

  function mimeCategory(mimeType: string, isFolder: boolean): string {
    if (isFolder) return 'folder'
    if (!mimeType) return 'other'
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType === 'application/pdf') return 'PDF'
    if (mimeType.startsWith('text/')) return 'text'
    if (mimeType.includes('spreadsheet') || mimeType === 'text/csv') return 'spreadsheet'
    if (mimeType.includes('presentation')) return 'presentation'
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document'
    return 'other'
  }

  function buildStaticBrief(children: Resource[]): BriefResult {
    if (children.length === 0) {
      return { summary: $gettext('This folder is empty.'), isStatic: true }
    }
    const counts: Record<string, number> = {}
    for (const child of children) {
      const cat = mimeCategory(child.mimeType ?? '', child.isFolder ?? false)
      counts[cat] = (counts[cat] ?? 0) + 1
    }
    const parts = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, n]) => `${n} ${cat}${n !== 1 ? 's' : ''}`)
    const folderName = resource.value?.name ?? $gettext('This folder')
    const summary = `${folderName} contains ${parts.join(', ')}.`
    return { summary, isStatic: true }
  }

  function serialiseListing(folderName: string, children: Resource[]): string {
    const header = `Folder: ${folderName}\nContents (${children.length} items):\n`
    const rows = children
      .map(
        (c) =>
          `  ${c.name}\t${c.mimeType ?? (c.isFolder ? 'folder' : '')}\t${c.size ?? 0} bytes\t${c.mdate ?? ''}`
      )
      .join('\n')
    const full = header + rows
    return full.length > MAX_LISTING_CHARS
      ? full.slice(0, MAX_LISTING_CHARS) + '\n...[listing truncated]'
      : full
  }

  async function fetchListing(): Promise<Resource[]> {
    const res = resource.value
    if (!res?.storageId || !res?.path) {
      throw new Error($gettext('Resource location not available'))
    }
    const space = spacesStore.getSpace(res.storageId)
    if (!space) {
      throw new Error($gettext('Could not resolve file space'))
    }
    const { children } = await clientService.webdav.listFiles(
      space,
      { path: res.path },
      { depth: 1 }
    )
    return children ?? []
  }

  async function fetchBrief(children: Resource[]): Promise<BriefResult> {
    const cfg = config.value
    if (!cfg) {
      throw new Error($gettext('Admin needs to configure the AI endpoint.'))
    }
    const lang = getUserLanguage()
    const listing = serialiseListing(resource.value?.name ?? 'this folder', children)
    const base = cfg.endpoint.replace(/\/$/, '')
    const prompt = [
      `Analyse the following folder listing for "${resource.value?.name ?? 'this folder'}".`,
      `Respond in the language with BCP 47 tag "${lang}".`,
      'Return a JSON object with exactly three keys:',
      '"summary": a 2-3 sentence paragraph describing the apparent purpose of this folder.',
      '"filesByType": one sentence grouping the files by category (e.g. "Mostly PDFs and spreadsheets").',
      '"recentChanges": one sentence about the most recently modified items.',
      'Example: { "summary": "This folder holds Q4 financial reports.", "filesByType": "Mostly PDFs and spreadsheets.", "recentChanges": "report.pdf was updated recently." }',
      'Return only the JSON object. No markdown, no code fences, no extra text.',
      '\n\nFolder listing:\n' + listing
    ].join(' ')

    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 512
      })
    })

    if (!res.ok) {
      throw new Error(aiErrorMessage(res.status))
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content ?? ''
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text) as Record<string, unknown>
    } catch {
      return { summary: text.trim() || $gettext('No summary generated.'), isStatic: false }
    }
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : text.trim(),
      filesByType: typeof parsed.filesByType === 'string' ? parsed.filesByType.trim() : undefined,
      recentChanges:
        typeof parsed.recentChanges === 'string' ? parsed.recentChanges.trim() : undefined,
      isStatic: false
    }
  }

  async function triggerBrief(): Promise<void> {
    isLoading.value = true
    panelError.value = null

    try {
      const children = await fetchListing()

      if (status.value === 'unconfigured' || !config.value) {
        briefResult.value = buildStaticBrief(children)
        return
      }

      if (children.length === 0) {
        briefResult.value = { summary: $gettext('This folder is empty.'), isStatic: false }
        return
      }

      briefResult.value = await fetchBrief(children)
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
            : $gettext(
                'Something went wrong while generating the folder brief. Please try again.'
              )
      }
    } finally {
      isLoading.value = false
    }
  }

  return { status, isLoading, briefResult, panelError, triggerBrief, ensureReady }
}
