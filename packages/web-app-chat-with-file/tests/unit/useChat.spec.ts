import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'

// --- module-level mocks (hoisted by vitest) ---

vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn() }))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs', () => ({}))

vi.mock('../../src/composables/useLlm', () => ({ useLlm: vi.fn() }))

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({ $gettext: (s: string) => s })
}))

vi.mock('@ownclouders/web-pkg', () => ({
  useAuthStore: vi.fn(),
  useClientService: vi.fn(),
  useSpacesStore: vi.fn()
}))

// --- imports after mocks ---

import { useChat } from '../../src/composables/useChat'
import type { ChatResource } from '../../src/composables/useChat'
import { useLlm } from '../../src/composables/useLlm'
import { useAuthStore, useClientService, useSpacesStore } from '@ownclouders/web-pkg'
import type { LlmConfig, LlmStatus } from '../../src/composables/useLlm'

// -------------------------------------------------------------------------

// window.location.origin in the happy-dom test environment is 'http://localhost:3000'.
// The same-origin guard in sendMessage() requires the endpoint to share that origin.
const BASE_CONFIG: LlmConfig = { endpoint: 'http://localhost:3000/ai-llm-proxy/v1', model: 'test-model' }

let resourceCounter = 0
function makeResource(overrides: Partial<ChatResource> = {}) {
  return ref<ChatResource>({
    id: `file-${++resourceCounter}`,
    name: 'test.txt',
    extension: 'txt',
    storageId: 'space-1',
    path: '/test.txt',
    ...overrides
  })
}

function makeFetchResponse(body: unknown, ok = true, statusCode = 200) {
  return Promise.resolve({
    ok,
    status: statusCode,
    json: async () => body
  })
}

function setupLlmMock({ status = 'ready' as LlmStatus, config = BASE_CONFIG as LlmConfig | null } = {}) {
  vi.mocked(useLlm).mockReturnValue({
    status: ref(status),
    config: ref(config),
    ensureReady: vi.fn()
  })
}

let getFileContentsMock: ReturnType<typeof vi.fn>
let putFileContentsMock: ReturnType<typeof vi.fn>

function setupWebdavMocks({
  fileData = 'File content here.',
  etag = '"etag-abc"'
} = {}) {
  getFileContentsMock = vi.fn().mockResolvedValue({
    response: { data: fileData },
    headers: { etag }
  })
  putFileContentsMock = vi.fn().mockResolvedValue({})

  vi.mocked(useClientService).mockReturnValue({
    webdav: {
      getFileContents: getFileContentsMock,
      putFileContents: putFileContentsMock
    }
  } as any)
}

beforeEach(() => {
  vi.restoreAllMocks()
  setupLlmMock()
  setupWebdavMocks()

  vi.mocked(useAuthStore).mockReturnValue({ accessToken: 'bearer-token' } as any)
  vi.mocked(useSpacesStore).mockReturnValue({
    getSpace: vi.fn().mockReturnValue({ id: 'space-1', name: 'Personal' })
  } as any)

  vi.stubGlobal('fetch', vi.fn())
})

// =========================================================================

describe('useChat', () => {
  describe('initial state', () => {
    it('starts with an empty message list', () => {
      const { messages } = useChat(BASE_CONFIG, makeResource())
      expect(messages.value).toEqual([])
    })

    it('starts with isLoading = false', () => {
      const { isLoading } = useChat(BASE_CONFIG, makeResource())
      expect(isLoading.value).toBe(false)
    })

    it('starts with isApplying = false', () => {
      const { isApplying } = useChat(BASE_CONFIG, makeResource())
      expect(isApplying.value).toBe(false)
    })

    it('starts with panelError = null', () => {
      const { panelError } = useChat(BASE_CONFIG, makeResource())
      expect(panelError.value).toBeNull()
    })

    it('exposes the status from useLlm', () => {
      setupLlmMock({ status: 'unconfigured', config: null })
      const { status } = useChat(null, makeResource())
      expect(status.value).toBe('unconfigured')
    })
  })

  // -----------------------------------------------------------------------

  describe('sendMessage — guard conditions', () => {
    it('refuses a cross-origin endpoint and does not fetch file or call the LLM', async () => {
      const crossOriginConfig: LlmConfig = { endpoint: 'http://external-llm.example.com/v1', model: 'test-model' }
      setupLlmMock({ status: 'ready', config: crossOriginConfig })
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const { sendMessage, messages, panelError } = useChat(crossOriginConfig, makeResource())
      await sendMessage('hello', 'chat')

      expect(fetchMock).not.toHaveBeenCalled()
      expect(getFileContentsMock).not.toHaveBeenCalled()
      expect(messages.value).toHaveLength(0)
      expect(panelError.value).toMatch(/same server|administrator/i)
    })

    it('returns early without fetching when status is unconfigured', async () => {
      setupLlmMock({ status: 'unconfigured', config: null })
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const { sendMessage, messages } = useChat(null, makeResource())
      await sendMessage('hello', 'chat')

      expect(fetchMock).not.toHaveBeenCalled()
      expect(messages.value).toHaveLength(0)
    })

    it('returns early when a previous sendMessage call is still in flight', async () => {
      let resolveFetch!: (value: unknown) => void
      const slowFetch = new Promise((resolve) => { resolveFetch = resolve })
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(slowFetch))

      const { sendMessage, isLoading, messages } = useChat(BASE_CONFIG, makeResource())

      // Fire first call but do not await yet
      const first = sendMessage('first', 'chat')
      expect(isLoading.value).toBe(true)

      // Second call should be a no-op
      await sendMessage('second', 'chat')
      expect(messages.value.filter((m) => m.role === 'user')).toHaveLength(1)
      expect(messages.value[0].content).toBe('first')

      // Let first call finish
      resolveFetch({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'response' } }] }) })
      await first
    })
  })

  // -----------------------------------------------------------------------

  describe('sendMessage — chat mode success', () => {
    it('appends a user message followed by an assistant message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: 'Hello back!' } }] })
      ))

      const { sendMessage, messages } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('Hello', 'chat')

      expect(messages.value).toHaveLength(2)
      expect(messages.value[0]).toEqual({ role: 'user', content: 'Hello' })
      expect(messages.value[1]).toEqual({ role: 'assistant', content: 'Hello back!' })
    })

    it('sends the full conversation history to the LLM', async () => {
      const fetchMock = vi.fn()
        .mockReturnValueOnce(makeFetchResponse({ choices: [{ message: { content: 'Hi!' } }] }))
        .mockReturnValueOnce(makeFetchResponse({ choices: [{ message: { content: 'Sure!' } }] }))
      vi.stubGlobal('fetch', fetchMock)

      const { sendMessage } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('Hello', 'chat')
      await sendMessage('Can you help?', 'chat')

      const body = JSON.parse(fetchMock.mock.calls[1][1].body)
      const userMessages = body.messages.filter((m: { role: string }) => m.role === 'user')
      expect(userMessages.length).toBeGreaterThanOrEqual(2)
    })

    it('sets isLoading to true during the request and false once resolved', async () => {
      let observedDuringFetch = false
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
        observedDuringFetch = true
        return makeFetchResponse({ choices: [{ message: { content: 'done' } }] })
      }))

      const { sendMessage, isLoading } = useChat(BASE_CONFIG, makeResource())
      const promise = sendMessage('ping', 'chat')
      expect(isLoading.value).toBe(true)
      await promise
      expect(isLoading.value).toBe(false)
      expect(observedDuringFetch).toBe(true)
    })

    it('clears panelError at the start of a new request', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockReturnValueOnce(makeFetchResponse(null, false, 500))
        .mockReturnValueOnce(makeFetchResponse({ choices: [{ message: { content: 'ok' } }] }))
      )

      const { sendMessage, panelError } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('first', 'chat')
      expect(panelError.value).not.toBeNull()

      await sendMessage('second', 'chat')
      expect(panelError.value).toBeNull()
    })

    it('fetches the file via webdav for a text resource', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: 'ok' } }] })
      ))

      const { sendMessage } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('summarize', 'chat')

      expect(getFileContentsMock).toHaveBeenCalledTimes(1)
    })

    it('caches the file text and avoids a second webdav call on the next message', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockReturnValue(makeFetchResponse({ choices: [{ message: { content: 'ok' } }] }))
      )

      const { sendMessage } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('first', 'chat')
      await sendMessage('second', 'chat')

      expect(getFileContentsMock).toHaveBeenCalledTimes(1)
    })

    it('includes the Authorization header when an access token is available', async () => {
      const fetchMock = vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: 'ok' } }] })
      )
      vi.stubGlobal('fetch', fetchMock)

      const { sendMessage } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('hi', 'chat')

      const headers = fetchMock.mock.calls[0][1].headers
      expect(headers['Authorization']).toBe('Bearer bearer-token')
    })

    it('truncates file content to MAX_CONTENT_CHARS in the chat system message', async () => {
      const bigFile = 'a'.repeat(12_001)
      setupWebdavMocks({ fileData: bigFile })
      const fetchMock = vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: 'ok' } }] })
      )
      vi.stubGlobal('fetch', fetchMock)

      const { sendMessage } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('summarize', 'chat')

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      const systemContent: string = body.messages[0].content
      // The 12 001-char file must be cut before being embedded in the system message
      expect(systemContent).toContain('a'.repeat(12_000))
      expect(systemContent).not.toContain('a'.repeat(12_001))
    })
  })

  // -----------------------------------------------------------------------

  describe('sendMessage — edit mode success', () => {
    it('stores the LLM reply as editProposal on the assistant message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: 'Updated file content' } }] })
      ))

      const { sendMessage, messages } = useChat(BASE_CONFIG, makeResource({ extension: 'txt' }))
      await sendMessage('Fix the typo', 'edit')

      expect(messages.value).toHaveLength(2)
      const assistant = messages.value[1]
      expect(assistant.editProposal).toBe('Updated file content')
      expect(assistant.originalContent).toBe('File content here.')
    })

    it('does NOT include conversation history in edit-mode requests', async () => {
      const fetchMock = vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: 'new content' } }] })
      )
      vi.stubGlobal('fetch', fetchMock)

      const { sendMessage } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('rewrite this', 'edit')

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      // Edit mode only sends [system, user] — no prior chat turns
      const roles = body.messages.map((m: { role: string }) => m.role)
      expect(roles).toEqual(['system', 'user'])
    })

    it('sets panelError and rolls back when the file exceeds MAX_CONTENT_CHARS', async () => {
      const bigFile = 'x'.repeat(12_001)
      setupWebdavMocks({ fileData: bigFile })
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const { sendMessage, messages, panelError } = useChat(BASE_CONFIG, makeResource({ extension: 'txt' }))
      await sendMessage('Fix this', 'edit')

      expect(fetchMock).not.toHaveBeenCalled()
      expect(messages.value).toHaveLength(0)
      expect(panelError.value).toMatch(/too large|12.000|text editor/i)
    })

    it('sets panelError and rolls back when finish_reason is "length"', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: 'partial...' }, finish_reason: 'length' }] })
      ))

      const { sendMessage, messages, panelError } = useChat(BASE_CONFIG, makeResource({ extension: 'txt' }))
      await sendMessage('Rewrite this', 'edit')

      expect(messages.value).toHaveLength(0)
      expect(panelError.value).toMatch(/cut off|complete|shorter/i)
    })

    it('stores originalContent as the full file text for accurate diffing', async () => {
      const fullContent = 'Line one.\nLine two.\nLine three.'
      setupWebdavMocks({ fileData: fullContent })
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: 'Line one.\nLine two.\nLine three — edited.' }, finish_reason: 'stop' }] })
      ))

      const { sendMessage, messages } = useChat(BASE_CONFIG, makeResource({ extension: 'txt' }))
      await sendMessage('Edit last line', 'edit')

      expect(messages.value[1].originalContent).toBe(fullContent)
    })
  })

  // -----------------------------------------------------------------------

  describe('sendMessage — reply cleanup', () => {
    // Cleanup (fence/tag stripping) only runs in edit mode; chat replies are returned as-is.
    async function sendEditAndGetProposal(rawReply: string) {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: rawReply }, finish_reason: 'stop' }] })
      ))
      const { sendMessage, messages } = useChat(BASE_CONFIG, makeResource({ extension: 'txt' }))
      await sendMessage('fix typo', 'edit')
      return messages.value[1]?.editProposal
    }

    it('strips a paired markdown fence wrapper', async () => {
      const proposal = await sendEditAndGetProposal('```markdown\nactual content\n```')
      expect(proposal).toBe('actual content')
    })

    it('does not strip a leading fence that has no matching closing fence', async () => {
      const proposal = await sendEditAndGetProposal('```python\nsome code\nmore code')
      expect(proposal).toBe('```python\nsome code\nmore code')
    })

    it('trims leading and trailing whitespace from the reply', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: '  trimmed reply  ' } }] })
      ))
      const { sendMessage, messages } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('hi', 'chat')
      expect(messages.value[1].content).toBe('trimmed reply')
    })
  })

  // -----------------------------------------------------------------------

  describe('sendMessage — error handling', () => {
    it('rolls back the user message on any error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeFetchResponse(null, false, 500)))

      const { sendMessage, messages } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('hello', 'chat')

      expect(messages.value).toHaveLength(0)
    })

    it('sets panelError for HTTP 401', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeFetchResponse(null, false, 401)))
      const { sendMessage, panelError } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('hi', 'chat')
      expect(panelError.value).toMatch(/denied|session/i)
    })

    it('sets panelError for HTTP 403', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeFetchResponse(null, false, 403)))
      const { sendMessage, panelError } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('hi', 'chat')
      expect(panelError.value).toMatch(/denied|session/i)
    })

    it('sets panelError for HTTP 404', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeFetchResponse(null, false, 404)))
      const { sendMessage, panelError } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('hi', 'chat')
      expect(panelError.value).toMatch(/not be found|endpoint/i)
    })

    it('sets panelError for HTTP 429', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeFetchResponse(null, false, 429)))
      const { sendMessage, panelError } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('hi', 'chat')
      expect(panelError.value).toMatch(/busy|try again/i)
    })

    it('sets panelError for HTTP 500', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeFetchResponse(null, false, 500)))
      const { sendMessage, panelError } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('hi', 'chat')
      expect(panelError.value).toMatch(/unavailable|try again/i)
    })

    it('sets a network-error panelError on TypeError', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
      const { sendMessage, panelError } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('hi', 'chat')
      expect(panelError.value).toMatch(/network|connection/i)
    })

    it('sets a timeout panelError on DOMException TimeoutError', async () => {
      const err = new DOMException('Timeout', 'TimeoutError')
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err))
      const { sendMessage, panelError } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('hi', 'chat')
      expect(panelError.value).toMatch(/time|respond/i)
    })

    it('sets a generic panelError for unknown Error instances', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Kaboom')))
      const { sendMessage, panelError } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('hi', 'chat')
      expect(panelError.value).toBe('Kaboom')
    })

    it('sets panelError when the resource has no storageId', async () => {
      const { sendMessage, panelError } = useChat(
        BASE_CONFIG,
        makeResource({ storageId: undefined, path: undefined })
      )
      await sendMessage('hi', 'chat')
      expect(panelError.value).not.toBeNull()
    })

    it('sets panelError when the space cannot be resolved', async () => {
      vi.mocked(useSpacesStore).mockReturnValue({
        getSpace: vi.fn().mockReturnValue(null)
      } as any)

      const { sendMessage, panelError } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('hi', 'chat')
      expect(panelError.value).toMatch(/space/i)
    })

    it('sets isLoading back to false after an error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeFetchResponse(null, false, 500)))
      const { sendMessage, isLoading } = useChat(BASE_CONFIG, makeResource())
      await sendMessage('hi', 'chat')
      expect(isLoading.value).toBe(false)
    })
  })

  // -----------------------------------------------------------------------

  describe('applyEdit', () => {
    async function setupWithEditProposal() {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: 'proposed content' } }] })
      ))
      const resource = makeResource({ extension: 'txt' })
      const instance = useChat(BASE_CONFIG, resource)
      await instance.sendMessage('rewrite', 'edit')
      return instance
    }

    it('calls webdav.putFileContents with the proposal', async () => {
      const instance = await setupWithEditProposal()
      await instance.applyEdit('proposed content', 1)
      expect(putFileContentsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ content: 'proposed content' })
      )
    })

    it('forwards the ETag as a non-empty previousEntityTag (case-insensitive header read)', async () => {
      // axios lowercases response headers; verify the composable reads etag case-insensitively
      setupWebdavMocks({ fileData: 'File content here.', etag: '"etag-abc"' })
      const instance = await setupWithEditProposal()
      await instance.applyEdit('proposed content', 1)
      expect(putFileContentsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ previousEntityTag: '"etag-abc"' })
      )
    })

    it('marks the message as applied and updates content', async () => {
      const instance = await setupWithEditProposal()
      await instance.applyEdit('proposed content', 1)
      const msg = instance.messages.value[1]
      expect(msg.applied).toBe(true)
      expect(msg.content).toMatch(/applied/i)
    })

    it('sets isApplying to true during the write and false afterwards', async () => {
      const instance = await setupWithEditProposal()
      let observedDuringApply = false
      putFileContentsMock.mockImplementation(() => {
        observedDuringApply = instance.isApplying.value
        return Promise.resolve({})
      })
      await instance.applyEdit('proposed content', 1)
      expect(observedDuringApply).toBe(true)
      expect(instance.isApplying.value).toBe(false)
    })

    it('clears the file cache so the next sendMessage re-fetches', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockReturnValueOnce(makeFetchResponse({ choices: [{ message: { content: 'new content' } }] }))
        .mockReturnValueOnce(makeFetchResponse({ choices: [{ message: { content: 'ok' } }] }))
      )

      const instance = await setupWithEditProposal()
      await instance.applyEdit('new content', 1)

      getFileContentsMock.mockClear()
      await instance.sendMessage('what changed?', 'chat')
      expect(getFileContentsMock).toHaveBeenCalledTimes(1)
    })

    it('sets a conflict panelError on HTTP 412 (file modified externally)', async () => {
      putFileContentsMock.mockRejectedValue({ statusCode: 412 })
      const instance = await setupWithEditProposal()
      await instance.applyEdit('proposed content', 1)
      expect(instance.panelError.value).toMatch(/changed|someone else/i)
    })

    it('sets a generic save panelError on other write errors', async () => {
      putFileContentsMock.mockRejectedValue({ statusCode: 500 })
      const instance = await setupWithEditProposal()
      await instance.applyEdit('proposed content', 1)
      expect(instance.panelError.value).toMatch(/save|try again/i)
    })

    it('sets panelError and does not write when the file extension is not a text type', async () => {
      const instance = await setupWithEditProposal()
      // Swap the resource to a PDF after the proposal was generated
      vi.mocked(useSpacesStore).mockReturnValue({
        getSpace: vi.fn().mockReturnValue({ id: 'space-1' })
      } as any)
      instance['resource' as any] // the resource ref is internal; test via a pdf resource
      const pdfResource = makeResource({ extension: 'pdf' })
      const pdfInstance = useChat(BASE_CONFIG, pdfResource)
      // Manually invoke applyEdit — bypasses the UI gate that normally prevents this
      await pdfInstance.applyEdit('proposed content', 0)
      expect(putFileContentsMock).not.toHaveBeenCalled()
      expect(pdfInstance.panelError.value).toMatch(/text files/i)
    })

    it('sets panelError when the resource space is missing', async () => {
      // The composable captures spacesStore at creation time, so the mock must be
      // configured before calling useChat().  Return a valid space for the first
      // call (sendMessage → fetchFileText) and null for the second (applyEdit).
      const getSpaceMock = vi.fn()
        .mockReturnValueOnce({ id: 'space-1' })
        .mockReturnValue(null)
      vi.mocked(useSpacesStore).mockReturnValue({ getSpace: getSpaceMock } as any)

      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: 'proposed content' } }] })
      ))
      const resource = makeResource({ extension: 'txt' })
      const instance = useChat(BASE_CONFIG, resource)
      await instance.sendMessage('rewrite', 'edit')
      await instance.applyEdit('proposed content', 1)

      expect(instance.panelError.value).toMatch(/space/i)
    })
  })

  // -----------------------------------------------------------------------

  describe('discardEdit', () => {
    it('removes the editProposal from the message and marks content as discarded', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: 'proposed' } }] })
      ))
      const instance = useChat(BASE_CONFIG, makeResource({ extension: 'txt' }))
      await instance.sendMessage('rewrite', 'edit')

      instance.discardEdit(1)

      const msg = instance.messages.value[1]
      expect(msg.editProposal).toBeUndefined()
      expect(msg.originalContent).toBeUndefined()
      expect(msg.content).toMatch(/discard/i)
    })

    it('leaves all other messages unmodified', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockReturnValueOnce(makeFetchResponse({ choices: [{ message: { content: 'answer' } }] }))
        .mockReturnValueOnce(makeFetchResponse({ choices: [{ message: { content: 'proposed' } }] }))
      )
      const instance = useChat(BASE_CONFIG, makeResource({ extension: 'txt' }))
      await instance.sendMessage('question', 'chat')
      await instance.sendMessage('rewrite', 'edit')

      instance.discardEdit(3) // index of the edit assistant message

      expect(instance.messages.value[0].content).toBe('question')
      expect(instance.messages.value[1].content).toBe('answer')
    })
  })

  // -----------------------------------------------------------------------

  describe('clearChat', () => {
    it('empties the message list', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: 'hi' } }] })
      ))
      const instance = useChat(BASE_CONFIG, makeResource())
      await instance.sendMessage('hello', 'chat')
      expect(instance.messages.value).toHaveLength(2)

      instance.clearChat()
      expect(instance.messages.value).toHaveLength(0)
    })

    it('clears panelError', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(makeFetchResponse(null, false, 500)))
      const instance = useChat(BASE_CONFIG, makeResource())
      await instance.sendMessage('hi', 'chat')
      expect(instance.panelError.value).not.toBeNull()

      instance.clearChat()
      expect(instance.panelError.value).toBeNull()
    })

    it('clears the file cache so the next sendMessage re-fetches', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockReturnValue(makeFetchResponse({ choices: [{ message: { content: 'ok' } }] }))
      )
      const instance = useChat(BASE_CONFIG, makeResource())
      await instance.sendMessage('first', 'chat')
      getFileContentsMock.mockClear()

      instance.clearChat()
      await instance.sendMessage('second', 'chat')
      expect(getFileContentsMock).toHaveBeenCalledTimes(1)
    })
  })

  // -----------------------------------------------------------------------

  describe('message cache across resource switches', () => {
    it('restores cached messages when navigating back to a previously visited resource', async () => {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(
        makeFetchResponse({ choices: [{ message: { content: 'reply' } }] })
      ))

      const resourceA = makeResource()
      const resourceB = makeResource()
      const aProps = { ...resourceA.value }
      const instance = useChat(BASE_CONFIG, resourceA)

      await instance.sendMessage('hello from A', 'chat')
      expect(instance.messages.value).toHaveLength(2)

      // Switch to resource B → messages should clear
      resourceA.value = { ...resourceB.value }
      await nextTick()
      expect(instance.messages.value).toHaveLength(0)

      // Switch back to resource A → messages should be restored from cache
      resourceA.value = { ...aProps }
      await nextTick()
      expect(instance.messages.value).toHaveLength(2)
    })

    it('starts with empty messages for a brand-new resource', async () => {
      const resource = makeResource()
      const instance = useChat(BASE_CONFIG, resource)
      expect(instance.messages.value).toHaveLength(0)
    })
  })
})
