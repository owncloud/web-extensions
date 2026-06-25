import { ref, type Ref } from 'vue'
import * as pdfjs from 'pdfjs-dist'
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { useClientService, useSpacesStore } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import { useLlm, type LlmConfig, type LlmStatus } from './useLlm'

export type { LlmConfig, LlmStatus }

export type ScanFindingCategory = 'pii' | 'credentials' | 'confidential'

export interface ScanFinding {
  category: ScanFindingCategory
  excerpt: string
}

export type FileScanState = 'pending' | 'scanning' | 'done' | 'error' | 'skipped'

export interface FileScanResult {
  filename: string
  state: FileScanState
  findings: ScanFinding[]
  narrative: string
  error: string | null
}

export interface ScanResource {
  id?: string
  name?: string
  extension?: string
  storageId?: string
  path?: string
}

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv'])
const PDF_EXTENSION = 'pdf'
const MAX_CONTENT_CHARS = 12_000

export function useScanner(llmConfig: LlmConfig | null, resources: Ref<ScanResource[]>) {
  const { $gettext } = useGettext()
  const clientService = useClientService()
  const spacesStore = useSpacesStore()
  const { config, status, callLlm } = useLlm(llmConfig)

  const isScanning = ref(false)
  const scanResults = ref<FileScanResult[]>([])

  function validateSameOrigin(endpoint: string): boolean {
    try {
      return new URL(endpoint).origin === window.location.origin
    } catch {
      return false
    }
  }

  async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
    // Run PDF.js in the main thread (fake-worker mode) to bypass Worker/CSP restrictions.
    // Assigned here rather than at module level to avoid clobbering a real Worker that
    // another app may have already registered at globalThis.pdfjsWorker.
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
    return text.slice(0, MAX_CONTENT_CHARS)
  }

  async function fetchFileText(resource: ScanResource): Promise<string | null> {
    if (!resource.storageId || !resource.path) return null
    const ext = resource.extension?.toLowerCase() ?? ''
    const space = spacesStore.getSpace(resource.storageId)
    if (!space) return null

    if (TEXT_EXTENSIONS.has(ext)) {
      const { response } = await clientService.webdav.getFileContents(
        space,
        { path: resource.path },
        { responseType: 'text' }
      )
      return (response.data as string).slice(0, MAX_CONTENT_CHARS)
    }

    if (ext === PDF_EXTENSION) {
      const { response } = await clientService.webdav.getFileContents(
        space,
        { path: resource.path },
        { responseType: 'arraybuffer' }
      )
      return await extractPdfText(response.data as ArrayBuffer)
    }

    return null
  }

  function buildPrompt(fileText: string): string {
    return [
      'Analyze the following document for sensitive data. Look for:',
      '1. PII: names, email addresses, phone numbers, Social Security Numbers, dates of birth, passport numbers, addresses',
      '2. Credentials: passwords, API keys, tokens, private keys, secrets, connection strings, certificates',
      '3. Confidential: unreleased financial figures, proprietary specifications, internal legal communications',
      '',
      'For each finding, provide a short excerpt with sensitive values replaced by [REDACTED].',
      'Respond with a JSON object: {"findings": [{"category": "pii"|"credentials"|"confidential", "excerpt": "..."}]}',
      'If nothing sensitive is found, respond with {"findings": []}.',
      'Return only valid JSON. No markdown fences. No extra text.',
      '',
      'Document content:',
      fileText
    ].join('\n')
  }

  function parseLlmResponse(rawContent: string): Pick<FileScanResult, 'findings' | 'narrative'> {
    try {
      const parsed = JSON.parse(rawContent) as { findings?: unknown[] }
      if (Array.isArray(parsed.findings)) {
        const findings = parsed.findings.filter(
          (f): f is ScanFinding =>
            typeof f === 'object' &&
            f !== null &&
            typeof (f as Record<string, unknown>).category === 'string' &&
            typeof (f as Record<string, unknown>).excerpt === 'string'
        )
        return { findings, narrative: '' }
      }
    } catch {
      // not valid JSON — store raw response as narrative (plain-text model fallback)
    }
    return { findings: [], narrative: rawContent }
  }

  async function scanSingleResource(resource: ScanResource, index: number): Promise<void> {
    const filename = resource.name ?? ''
    const ext = resource.extension?.toLowerCase() ?? ''
    const isSupported = TEXT_EXTENSIONS.has(ext) || ext === PDF_EXTENSION

    if (!isSupported) {
      scanResults.value[index] = {
        filename,
        state: 'skipped',
        findings: [],
        narrative: '',
        error: null
      }
      return
    }

    scanResults.value[index] = {
      filename,
      state: 'scanning',
      findings: [],
      narrative: '',
      error: null
    }

    if (!config.value || !validateSameOrigin(config.value.endpoint)) {
      scanResults.value[index] = {
        filename,
        state: 'error',
        findings: [],
        narrative: '',
        error: $gettext('The AI endpoint must be on the same origin as the oCIS server.')
      }
      return
    }

    let fileText: string | null
    try {
      fileText = await fetchFileText(resource)
    } catch {
      scanResults.value[index] = {
        filename,
        state: 'error',
        findings: [],
        narrative: '',
        error: $gettext('Failed to read file contents.')
      }
      return
    }

    if (!fileText) {
      scanResults.value[index] = {
        filename,
        state: 'done',
        findings: [],
        narrative: '',
        error: null
      }
      return
    }

    try {
      const data = await callLlm([{ role: 'user', content: buildPrompt(fileText) }], {
        maxTokens: 512
      })
      const rawContent = data.choices?.[0]?.message?.content ?? '{}'
      const { findings, narrative } = parseLlmResponse(rawContent)
      scanResults.value[index] = { filename, state: 'done', findings, narrative, error: null }
    } catch {
      scanResults.value[index] = {
        filename,
        state: 'error',
        findings: [],
        narrative: '',
        error: $gettext('The AI service returned an error. Please try again.')
      }
    }
  }

  async function runScan(): Promise<void> {
    const items = resources.value
    if (!items.length) return

    isScanning.value = true

    scanResults.value = items.map((r) => ({
      filename: r.name ?? '',
      state: 'pending' as FileScanState,
      findings: [],
      narrative: '',
      error: null
    }))

    try {
      for (let i = 0; i < items.length; i++) {
        await scanSingleResource(items[i], i)
      }
    } finally {
      isScanning.value = false
    }
  }

  return { isScanning, scanResults, status, runScan }
}
