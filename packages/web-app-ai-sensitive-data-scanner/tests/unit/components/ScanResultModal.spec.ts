import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount, defaultPlugins } from '@ownclouders/web-test-helpers'
import ScanResultsModal from '../../../src/components/ScanResultsModal.vue'

vi.mock('../../../src/composables/useScanner')

import { useScanner } from '../../../src/composables/useScanner.js'
import type { FileScanResult, LlmConfig, ScanResource } from '../../../src/composables/useScanner.js'
import type { LlmStatus } from '../../../src/composables/useScanner.js'

const runScanMock = vi.fn()

function setupUseScannerMock({
  status = 'unconfigured' as LlmStatus,
  isScanning = false,
  scanResults = [] as FileScanResult[]
} = {}) {
  vi.mocked(useScanner).mockReturnValue({
    status: ref(status),
    isScanning: ref(isScanning),
    scanResults: ref(scanResults),
    runScan: runScanMock
  })
}

function createWrapper(
  props: { resources?: ScanResource[]; llmConfig?: LlmConfig | null } = {}
) {
  return mount(ScanResultsModal, {
    props: {
      llmConfig: null,
      resources: [],
      ...props
    },
    global: { plugins: [...defaultPlugins()] }
  })
}

describe('ScanResultsModal', () => {
  beforeEach(() => {
    runScanMock.mockReset()
    setupUseScannerMock()
  })

  describe('unconfigured state', () => {
    it('shows the admin configuration message', async () => {
      setupUseScannerMock({ status: 'unconfigured' })
      const wrapper = createWrapper()
      await flushPromises()
      const placeholder = wrapper.find('.scan-results-placeholder')
      expect(placeholder.exists()).toBe(true)
      expect(placeholder.text()).toContain('administrator')
    })

    it('does not show any scan-result rows', async () => {
      setupUseScannerMock({ status: 'unconfigured' })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.findAll('.scan-result')).toHaveLength(0)
    })
  })

  describe('initial scanning state (no results yet)', () => {
    it('shows the global "Scanning files…" placeholder while scanning and no results are available', async () => {
      setupUseScannerMock({ status: 'ready', isScanning: true, scanResults: [] })
      const wrapper = createWrapper()
      await flushPromises()
      const placeholder = wrapper.find('.scan-results-placeholder.oc-p-m')
      expect(placeholder.exists()).toBe(true)
      expect(placeholder.text()).toContain('Scanning')
    })
  })

  describe('per-file pending state', () => {
    it('shows "Waiting…" for a file still in pending state', async () => {
      const result: FileScanResult = {
        filename: 'report.txt',
        state: 'pending',
        findings: [],
        narrative: '',
        error: null
      }
      setupUseScannerMock({ status: 'ready', isScanning: true, scanResults: [result] })
      const wrapper = createWrapper()
      await flushPromises()
      const row = wrapper.find('.scan-result')
      expect(row.exists()).toBe(true)
      expect(row.find('.scan-results-placeholder').text()).toContain('Waiting')
    })
  })

  describe('per-file scanning state', () => {
    it('shows "Scanning…" inline for the file currently being scanned', async () => {
      const result: FileScanResult = {
        filename: 'data.txt',
        state: 'scanning',
        findings: [],
        narrative: '',
        error: null
      }
      setupUseScannerMock({ status: 'ready', isScanning: true, scanResults: [result] })
      const wrapper = createWrapper()
      await flushPromises()
      const row = wrapper.find('.scan-result')
      expect(row.find('.scan-results-scanning').exists()).toBe(true)
      expect(row.find('.scan-results-scanning').text()).toContain('Scanning')
    })
  })

  describe('per-file skipped state', () => {
    it('shows "File type not supported" for a skipped file', async () => {
      const result: FileScanResult = {
        filename: 'image.png',
        state: 'skipped',
        findings: [],
        narrative: '',
        error: null
      }
      setupUseScannerMock({ status: 'ready', scanResults: [result] })
      const wrapper = createWrapper()
      await flushPromises()
      const row = wrapper.find('.scan-result')
      expect(row.find('.scan-results-placeholder').text()).toContain('not supported')
    })
  })

  describe('per-file error state', () => {
    it('shows the error message in .scan-results-error', async () => {
      const result: FileScanResult = {
        filename: 'secret.txt',
        state: 'error',
        findings: [],
        narrative: '',
        error: 'The AI service returned an error. Please try again.'
      }
      setupUseScannerMock({ status: 'ready', scanResults: [result] })
      const wrapper = createWrapper()
      await flushPromises()
      const err = wrapper.find('.scan-results-error')
      expect(err.exists()).toBe(true)
      expect(err.text()).toContain('AI service')
    })

    it('assigns role="alert" to the error element', async () => {
      const result: FileScanResult = {
        filename: 'secret.txt',
        state: 'error',
        findings: [],
        narrative: '',
        error: 'Something went wrong.'
      }
      setupUseScannerMock({ status: 'ready', scanResults: [result] })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    })
  })

  describe('per-file narrative fallback', () => {
    it('renders the narrative text in .scan-results-narrative', async () => {
      const result: FileScanResult = {
        filename: 'notes.txt',
        state: 'done',
        findings: [],
        narrative: 'The document contains a phone number and an email address.',
        error: null
      }
      setupUseScannerMock({ status: 'ready', scanResults: [result] })
      const wrapper = createWrapper()
      await flushPromises()
      const narrative = wrapper.find('.scan-results-narrative')
      expect(narrative.exists()).toBe(true)
      expect(narrative.text()).toContain('phone number')
    })
  })

  describe('per-file done with no findings', () => {
    it('shows "No sensitive data found." when the scan completed with an empty findings list', async () => {
      const result: FileScanResult = {
        filename: 'clean.txt',
        state: 'done',
        findings: [],
        narrative: '',
        error: null
      }
      setupUseScannerMock({ status: 'ready', scanResults: [result] })
      const wrapper = createWrapper()
      await flushPromises()
      const placeholder = wrapper.find('.scan-result .scan-results-placeholder')
      expect(placeholder.exists()).toBe(true)
      expect(placeholder.text()).toContain('No sensitive data found')
    })
  })

  describe('per-file done with structured findings', () => {
    it('renders one list item per finding with category label and excerpt', async () => {
      const result: FileScanResult = {
        filename: 'report.txt',
        state: 'done',
        findings: [
          { category: 'pii', excerpt: 'Name: [REDACTED], DOB: [REDACTED]' },
          { category: 'credentials', excerpt: 'API_KEY=[REDACTED]' }
        ],
        narrative: '',
        error: null
      }
      setupUseScannerMock({ status: 'ready', scanResults: [result] })
      const wrapper = createWrapper()
      await flushPromises()
      const items = wrapper.findAll('.scan-results-finding')
      expect(items).toHaveLength(2)
      expect(items[0].find('.scan-results-finding-category').text()).toBe('PII')
      expect(items[0].find('.scan-results-finding-excerpt').text()).toContain('[REDACTED]')
      expect(items[1].find('.scan-results-finding-category').text()).toBe('Credentials')
      expect(items[1].find('.scan-results-finding-excerpt').text()).toContain('API_KEY')
    })

    it('renders the correct OcIcon name for each category', async () => {
      const result: FileScanResult = {
        filename: 'doc.txt',
        state: 'done',
        findings: [
          { category: 'pii', excerpt: 'some pii' },
          { category: 'credentials', excerpt: 'some creds' },
          { category: 'confidential', excerpt: 'some confidential' }
        ],
        narrative: '',
        error: null
      }
      setupUseScannerMock({ status: 'ready', scanResults: [result] })
      const wrapper = createWrapper()
      await flushPromises()
      const icons = wrapper.findAllComponents({ name: 'OcIcon' })
      expect(icons[0].props('name')).toBe('user')
      expect(icons[1].props('name')).toBe('key')
      expect(icons[2].props('name')).toBe('lock')
    })

    it('renders the filename as a bold header for each file result', async () => {
      const result: FileScanResult = {
        filename: 'report.txt',
        state: 'done',
        findings: [{ category: 'pii', excerpt: 'some text' }],
        narrative: '',
        error: null
      }
      setupUseScannerMock({ status: 'ready', scanResults: [result] })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.scan-result p.oc-text-bold').text()).toBe('report.txt')
    })
  })

  describe('Re-scan button', () => {
    it('shows the Re-scan button when scanning is complete and results are present', async () => {
      const result: FileScanResult = {
        filename: 'doc.txt',
        state: 'done',
        findings: [],
        narrative: '',
        error: null
      }
      setupUseScannerMock({ status: 'ready', isScanning: false, scanResults: [result] })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.oc-flex.oc-flex-right').exists()).toBe(true)
      expect(wrapper.find('.oc-flex.oc-flex-right').text()).toContain('Re-scan')
    })

    it('hides the Re-scan button while scanning is in progress', async () => {
      const result: FileScanResult = {
        filename: 'doc.txt',
        state: 'scanning',
        findings: [],
        narrative: '',
        error: null
      }
      setupUseScannerMock({ status: 'ready', isScanning: true, scanResults: [result] })
      const wrapper = createWrapper()
      await flushPromises()
      expect(wrapper.find('.oc-flex.oc-flex-right').exists()).toBe(false)
    })

    it('calls runScan when the Re-scan button is clicked', async () => {
      const result: FileScanResult = {
        filename: 'doc.txt',
        state: 'done',
        findings: [],
        narrative: '',
        error: null
      }
      setupUseScannerMock({ status: 'ready', isScanning: false, scanResults: [result] })
      const wrapper = createWrapper()
      await flushPromises()
      runScanMock.mockReset()
      await wrapper.findComponent({ name: 'OcButton' }).trigger('click')
      expect(runScanMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('lifecycle', () => {
    it('calls runScan on mount when status is ready', async () => {
      setupUseScannerMock({ status: 'ready' })
      createWrapper()
      await flushPromises()
      expect(runScanMock).toHaveBeenCalledTimes(1)
    })

    it('does not call runScan on mount when status is unconfigured', async () => {
      setupUseScannerMock({ status: 'unconfigured' })
      createWrapper()
      await flushPromises()
      expect(runScanMock).not.toHaveBeenCalled()
    })

    it('passes llmConfig and resources props to useScanner', async () => {
      const llmConfig: LlmConfig = { endpoint: 'https://host.docker.internal:9200/ai-llm-proxy/v1', model: 'llama3.2' }
      const resources: ScanResource[] = [{ id: 'f1', name: 'report.txt', extension: 'txt' }]
      setupUseScannerMock({ status: 'ready' })
      createWrapper({ llmConfig, resources })
      await flushPromises()
      expect(vi.mocked(useScanner)).toHaveBeenCalledWith(
        llmConfig,
        expect.objectContaining({ value: resources })
      )
    })
  })
})
