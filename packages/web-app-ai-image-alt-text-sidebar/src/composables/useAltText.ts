import { ref, type Ref } from 'vue'
import { useAuthStore, useClientService, useSpacesStore, useUserStore } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import type { Resource } from '@ownclouders/web-client'
import { useLlm, type LlmConfig, type LlmStatus } from './useLlm'

const MAX_IMAGE_BYTES = 4_194_304 // 4 MB

// 1×1 transparent PNG — minimal valid image for the vision probe
const PROBE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const MIME_FALLBACK: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif'
}

export interface UseAltTextResult {
  status: Ref<LlmStatus>
  isGenerating: Ref<boolean>
  isProbing: Ref<boolean>
  altText: Ref<string | null>
  panelError: Ref<string | null>
  triggerGenerate: () => Promise<void>
  ensureReady: () => Promise<void>
  reset: () => void
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)))
  }
  return btoa(binary)
}

function isSameOrigin(endpoint: string): boolean {
  try {
    return new URL(endpoint, location.origin).origin === location.origin
  } catch {
    return false
  }
}

export function useAltText(
  llmConfig: LlmConfig | null,
  resource: Ref<Resource | null | undefined>
): UseAltTextResult {
  const { $gettext, current: gettextLanguage } = useGettext()
  const { status, config, ensureReady: llmEnsureReady } = useLlm(llmConfig)

  // Returns true (vision-ready) or false (text-only).
  // Throws for infrastructure errors (404, 5xx, network) so status stays unconfigured.
  async function probeVision(): Promise<boolean> {
    const cfg = config.value
    if (!cfg) throw new Error('no config')
    const base = cfg.endpoint.replace(/\/$/, '')
    let res: Response
    try {
      res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: buildHeaders(cfg.endpoint),
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'ok' },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${PROBE_PNG}` } }
              ]
            }
          ],
          max_tokens: 1
        })
      })
    } catch {
      throw new Error('probe network error')
    }
    if (res.ok) return true
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const errMsg = (
      (body?.error as Record<string, unknown>)?.message ??
      body?.error ??
      ''
    )
      .toString()
      .toLowerCase()
    if (
      errMsg.includes('does not support') ||
      errMsg.includes('vision') ||
      errMsg.includes('multimodal') ||
      errMsg.includes('image')
    ) {
      return false
    }
    throw new Error('probe infrastructure error')
  }

  async function ensureReady(): Promise<void> {
    isProbing.value = true
    try {
      await llmEnsureReady(probeVision)
    } finally {
      isProbing.value = false
    }
  }
  const authStore = useAuthStore()
  const clientService = useClientService()
  const spacesStore = useSpacesStore()
  const userStore = useUserStore()

  const isGenerating = ref(false)
  const isProbing = ref(false)
  const altText = ref<string | null>(null)
  const panelError = ref<string | null>(null)

  function buildHeaders(endpoint: string): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = authStore.accessToken
    if (token && isSameOrigin(endpoint)) {
      h['Authorization'] = `Bearer ${token}`
    }
    return h
  }

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

  async function fetchImageBase64(): Promise<{ base64: string; mimeType: string }> {
    const res = resource.value
    if (!res?.storageId || !res?.path) {
      throw new Error($gettext('Resource location not available'))
    }

    if (res.size !== undefined && Number(res.size) > MAX_IMAGE_BYTES) {
      throw new Error($gettext('This image is too large to process (maximum 4 MB).'))
    }

    const space = spacesStore.getSpace(res.storageId)
    if (!space) {
      throw new Error($gettext('Could not resolve file space'))
    }

    const { response } = await clientService.webdav.getFileContents(
      space,
      { path: res.path },
      { responseType: 'arraybuffer' }
    )

    const ext = (res.extension ?? '').toLowerCase()
    const mimeType = res.mimeType ?? MIME_FALLBACK[ext] ?? 'image/jpeg'
    return { base64: arrayBufferToBase64(response.data as ArrayBuffer), mimeType }
  }

  async function generate(): Promise<string> {
    const { base64, mimeType } = await fetchImageBase64()
    const cfg = config.value
    if (!cfg) {
      throw new Error($gettext('Admin needs to configure the AI endpoint.'))
    }

    const base = cfg.endpoint.replace(/\/$/, '')
    const lang = getUserLanguage()

    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(cfg.endpoint),
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  `Describe "${resource.value?.name ?? 'this image'}" in one short sentence of at most 15 words.`,
                  `Use language "${lang}".`,
                  'Output only that sentence — no quotes, no markdown, nothing else.'
                ].join(' ')
              },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64}` }
              }
            ]
          }
        ],
        max_tokens: 60
      })
    })

    if (!res.ok) {
      throw new Error(aiErrorMessage(res.status))
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return (data.choices?.[0]?.message?.content ?? '').trim()
  }

  async function triggerGenerate(): Promise<void> {
    if (status.value !== 'vision-ready') return

    const expectedId = resource.value?.id
    isGenerating.value = true
    panelError.value = null
    try {
      const result = await generate()
      if (resource.value?.id === expectedId) {
        altText.value = result
      }
    } catch (err) {
      if (resource.value?.id !== expectedId) return
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
            : $gettext('Something went wrong while generating alt text. Please try again.')
      }
    } finally {
      isGenerating.value = false
    }
  }

  function reset(): void {
    altText.value = null
    panelError.value = null
  }

  return { status, isGenerating, isProbing, altText, panelError, triggerGenerate, ensureReady, reset }
}
