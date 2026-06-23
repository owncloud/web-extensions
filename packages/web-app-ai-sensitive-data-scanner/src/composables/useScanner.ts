import { ref, type Ref } from 'vue'
import { useAuthStore, useClientService, useSpacesStore } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'

export interface LlmConfig {
  endpoint: string
  model: string
}

export interface ScanFinding {
  type: string
  value: string
  context?: string
}

export interface ScanResult {
  name: string
  findings: ScanFinding[]
  error?: string
}

export interface ScanResource {
  id?: string
  name?: string
  extension?: string
  storageId?: string
  path?: string
}

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv'])
const MAX_CONTENT_CHARS = 8_000

export function useScanner(llmConfig: LlmConfig | null, resources: Ref<ScanResource[]>) {
  const { $gettext } = useGettext()
  const authStore = useAuthStore()
  const clientService = useClientService()
  const spacesStore = useSpacesStore()

  const isScanning = ref(false)
  const scanResults = ref<ScanResult[]>([])

  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = authStore.accessToken
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  async function fetchFileText(resource: ScanResource): Promise<string> {
    if (!resource.storageId || !resource.path) return ''
    const ext = resource.extension?.toLowerCase() ?? ''
    if (!TEXT_EXTENSIONS.has(ext)) return ''
    const space = spacesStore.getSpace(resource.storageId)
    if (!space) return ''
    const { response } = await clientService.webdav.getFileContents(
      space,
      { path: resource.path },
      { responseType: 'text' }
    )
    return (response.data as string).slice(0, MAX_CONTENT_CHARS)
  }

  async function scanResource(resource: ScanResource): Promise<ScanResult> {
    const name = resource.name ?? ''
    if (!llmConfig) {
      return { name, findings: [], error: $gettext('AI endpoint not configured') }
    }

    let fileText: string
    try {
      fileText = await fetchFileText(resource)
    } catch {
      return { name, findings: [], error: $gettext('Failed to read file') }
    }

    if (!fileText) {
      return { name, findings: [] }
    }

    try {
      const base = llmConfig.endpoint.replace(/\/$/, '')
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: buildHeaders(),
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          model: llmConfig.model,
          messages: [
            {
              role: 'user',
              content: [
                'Scan the following text for sensitive data: PII (names, emails, phone numbers, addresses),',
                'credentials (passwords, API keys, tokens), financial data (credit card numbers, bank accounts).',
                'Return a JSON object with a "findings" array where each entry has:',
                '"type": the data category (e.g. "email", "credential", "phone"),',
                '"value": the exact found value,',
                '"context": a short surrounding snippet.',
                'Example: {"findings":[{"type":"email","value":"a@b.com","context":"email: a@b.com"}]}',
                'If nothing found: {"findings":[]}',
                'Return only the JSON object. No markdown, no code fences, no extra text.',
                '\n\nContent:\n' + fileText
              ].join(' ')
            }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1024
        })
      })
      if (!res.ok) {
        return { name, findings: [], error: $gettext('The AI service returned an error. Please try again.') }
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const text = data.choices?.[0]?.message?.content ?? '{}'
      let parsed: { findings?: ScanFinding[] }
      try {
        parsed = JSON.parse(text) as { findings?: ScanFinding[] }
      } catch {
        parsed = {}
      }
      return { name, findings: Array.isArray(parsed.findings) ? parsed.findings : [] }
    } catch {
      return { name, findings: [], error: $gettext('Scan failed. Please try again.') }
    }
  }

  async function runScan(): Promise<void> {
    if (!resources.value.length) return
    isScanning.value = true
    try {
      scanResults.value = await Promise.all(resources.value.map(scanResource))
    } finally {
      isScanning.value = false
    }
  }

  return { isScanning, scanResults, runScan }
}
