import { ref, type Ref } from 'vue'
import { useClientService } from '@ownclouders/web-pkg'
import type { Resource } from '@ownclouders/web-client'
import { useGettext } from 'vue3-gettext'

const ALT_TEXT_NS = 'urn:oc:ai:alt-text'
const ALT_TEXT_PROP = 'text'

function davUrl(resource: Resource): string {
  const path = resource.webDavPath ?? ''
  return path.startsWith('/dav/') ? path : `/dav${path}`
}

function buildPropfindBody(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<d:propfind xmlns:d="DAV:" xmlns:at="urn:oc:ai:alt-text">' +
    '<d:prop><at:text/></d:prop>' +
    '</d:propfind>'
  )
}

function buildProppatchBody(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<d:propertyupdate xmlns:d="DAV:" xmlns:at="urn:oc:ai:alt-text">' +
    '<d:set><d:prop>' +
    `<at:text>${escaped}</at:text>` +
    '</d:prop></d:set>' +
    '</d:propertyupdate>'
  )
}

function parseStoredText(xmlString: unknown): string | null {
  if (typeof xmlString !== 'string') return null
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml')

  // Use getElementsByTagName('*') + filter for happy-dom namespace compat
  const textEl = Array.from(doc.getElementsByTagName('*')).find(
    (el) => el.namespaceURI === ALT_TEXT_NS && el.localName === ALT_TEXT_PROP
  )
  if (!textEl) return null

  const statusEl = Array.from(doc.getElementsByTagName('*')).find(
    (el) => el.namespaceURI === 'DAV:' && el.localName === 'status' && el.textContent?.includes(' 200 ')
  )
  if (!statusEl) return null

  return textEl.textContent ?? null
}

interface DavHttpClient {
  request(config: Record<string, unknown>): Promise<{ data: unknown; headers: Record<string, string | undefined> }>
}

export interface UseAltTextStorageResult {
  storedText: Ref<string | null>
  isSaving: Ref<boolean>
  saveError: Ref<string | null>
  loadStoredText: (resource: Resource) => Promise<void>
  saveText: (resource: Resource, text: string) => Promise<void>
}

export function useAltTextStorage(): UseAltTextStorageResult {
  const { $gettext } = useGettext()
  const clientService = useClientService()
  const http = clientService.httpAuthenticated as unknown as DavHttpClient

  const storedText = ref<string | null>(null)
  const isSaving = ref(false)
  const saveError = ref<string | null>(null)

  async function loadStoredText(resource: Resource): Promise<void> {
    try {
      const response = await http.request({
        method: 'PROPFIND',
        url: davUrl(resource),
        data: buildPropfindBody(),
        headers: { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
        responseType: 'text'
      })
      storedText.value = parseStoredText(response.data)
    } catch {
      storedText.value = null
    }
  }

  async function saveText(resource: Resource, text: string): Promise<void> {
    isSaving.value = true
    saveError.value = null
    try {
      await http.request({
        method: 'PROPPATCH',
        url: davUrl(resource),
        data: buildProppatchBody(text),
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        responseType: 'text'
      })
      storedText.value = text
    } catch {
      saveError.value = $gettext('Alt text could not be saved.')
    } finally {
      isSaving.value = false
    }
  }

  return { storedText, isSaving, saveError, loadStoredText, saveText }
}
