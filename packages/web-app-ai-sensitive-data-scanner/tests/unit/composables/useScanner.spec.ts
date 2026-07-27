import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn()
}))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs', () => ({}))

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({ $gettext: (s: string) => s })
}))

vi.mock('@ownclouders/web-pkg', () => ({
  useClientService: vi.fn(),
  useSpacesStore: vi.fn()
}))

vi.mock('../../../src/composables/useLlm', () => ({
  useLlm: vi.fn()
}))

import { useScanner } from '../../../src/composables/useScanner'
import type { ScanResource } from '../../../src/composables/useScanner'
import { useLlm } from '../../../src/composables/useLlm'
import { useClientService, useSpacesStore } from '@ownclouders/web-pkg'

const BASE_CONFIG = { endpoint: window.location.origin + '/ai-llm-proxy/v1', model: 'test-model' }

const TEXT_RESOURCE: ScanResource = {
  id: 'f1',
  name: 'report.txt',
  extension: 'txt',
  storageId: 'space-1',
  path: '/report.txt'
}

function setupUseLlmMock({ status = 'ready', callLlm = vi.fn() } = {}) {
  vi.mocked(useLlm).mockReturnValue({
    config: ref(BASE_CONFIG as any),
    status: ref(status as any),
    callLlm
  })
  return callLlm
}

function setupClientServiceMock({ fileContents = 'Some document content.' } = {}) {
  const getFileContents = vi.fn().mockResolvedValue({ response: { data: fileContents } })
  vi.mocked(useClientService).mockReturnValue({
    webdav: { getFileContents }
  } as any)
  vi.mocked(useSpacesStore).mockReturnValue({
    getSpace: vi.fn().mockReturnValue({ id: 'space-1' })
  } as any)
  return { getFileContents }
}

async function runScanForResource(resource: ScanResource) {
  const instance = useScanner(BASE_CONFIG, ref([resource]))
  await instance.runScan()
  return instance
}

describe('useScanner parseLlmResponse (via runScan)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('parses a plain (unfenced) JSON findings response', async () => {
    const callLlm = setupUseLlmMock({
      callLlm: vi.fn().mockResolvedValue({
        choices: [
          { message: { content: '{"findings":[{"category":"pii","excerpt":"John Doe"}]}' } }
        ]
      })
    })
    setupClientServiceMock()

    const { scanResults } = await runScanForResource(TEXT_RESOURCE)

    expect(callLlm).toHaveBeenCalled()
    expect(scanResults.value[0].state).toBe('done')
    expect(scanResults.value[0].narrative).toBe('')
    expect(scanResults.value[0].findings).toEqual([{ category: 'pii', excerpt: 'John Doe' }])
  })

  it('strips a ```json markdown code fence before parsing, producing structured findings instead of raw-JSON narrative', async () => {
    setupUseLlmMock({
      callLlm: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: '```json\n{"findings":[{"category":"pii","excerpt":"John Doe"}]}\n```'
            }
          }
        ]
      })
    })
    setupClientServiceMock()

    const { scanResults } = await runScanForResource(TEXT_RESOURCE)

    expect(scanResults.value[0].state).toBe('done')
    expect(scanResults.value[0].narrative).toBe('')
    expect(scanResults.value[0].findings).toEqual([{ category: 'pii', excerpt: 'John Doe' }])
  })

  it('strips a bare ``` fence (no "json" language tag) before parsing', async () => {
    setupUseLlmMock({
      callLlm: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: '```\n{"findings":[{"category":"credentials","excerpt":"API_KEY=[REDACTED]"}]}\n```'
            }
          }
        ]
      })
    })
    setupClientServiceMock()

    const { scanResults } = await runScanForResource(TEXT_RESOURCE)

    expect(scanResults.value[0].narrative).toBe('')
    expect(scanResults.value[0].findings).toEqual([
      { category: 'credentials', excerpt: 'API_KEY=[REDACTED]' }
    ])
  })

  it('extracts JSON surrounded by leading/trailing prose', async () => {
    setupUseLlmMock({
      callLlm: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content:
                'Sure, here is the analysis:\n{"findings":[{"category":"confidential","excerpt":"internal roadmap"}]}\nLet me know if you need more.'
            }
          }
        ]
      })
    })
    setupClientServiceMock()

    const { scanResults } = await runScanForResource(TEXT_RESOURCE)

    expect(scanResults.value[0].narrative).toBe('')
    expect(scanResults.value[0].findings).toEqual([
      { category: 'confidential', excerpt: 'internal roadmap' }
    ])
  })

  it('falls back to narrative text for a genuinely non-JSON prose response', async () => {
    setupUseLlmMock({
      callLlm: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'The document contains a phone number and an email address.'
            }
          }
        ]
      })
    })
    setupClientServiceMock()

    const { scanResults } = await runScanForResource(TEXT_RESOURCE)

    expect(scanResults.value[0].findings).toEqual([])
    expect(scanResults.value[0].narrative).toBe(
      'The document contains a phone number and an email address.'
    )
  })
})
