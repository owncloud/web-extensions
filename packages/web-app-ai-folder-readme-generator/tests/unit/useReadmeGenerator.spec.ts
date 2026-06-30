import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Module-level mocks — hoisted by vitest before any import.
vi.mock('../../src/composables/useLLM', () => ({ useLLM: vi.fn() }))

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({ $gettext: (s: string) => s, current: 'en' }),
  createGettext: vi.fn()
}))

vi.mock('@ownclouders/web-pkg', () => ({
  useClientService: vi.fn(),
  useUserStore: vi.fn()
}))

import { useReadmeGenerator, renderMarkdown } from '../../src/composables/useReadmeGenerator'
import type { ReadmeJson } from '../../src/composables/useReadmeGenerator'
import { useLLM } from '../../src/composables/useLLM'
import type { LLMStatus } from '../../src/composables/useLLM'
import { useClientService, useUserStore } from '@ownclouders/web-pkg'
import { urlJoin } from '@ownclouders/web-client'

const BASE_CONFIG = { endpoint: 'http://localhost:3000/ai-llm-proxy/v1', model: 'test-model' }
const SPACE = { id: 'space-1' } as any
const RESOURCE = { id: 'f1', name: 'Project Docs', path: '/Project Docs', isFolder: true } as any

function makeChild(overrides: Record<string, unknown> = {}) {
  return { id: 'c1', name: 'notes.txt', path: '/Project Docs/notes.txt', extension: 'txt', isFolder: false, ...overrides }
}

let completeMock: ReturnType<typeof vi.fn>

function setupLLMMock({ status = 'ready' as LLMStatus, response = '' } = {}) {
  completeMock = vi.fn().mockResolvedValue(response)
  vi.mocked(useLLM).mockReturnValue({
    status: ref(status),
    complete: completeMock,
    stream: vi.fn()
  } as any)
}

let listFilesMock: ReturnType<typeof vi.fn>
let getFileContentsMock: ReturnType<typeof vi.fn>
let putFileContentsMock: ReturnType<typeof vi.fn>

function setupClientServiceMock({
  children = [] as any[],
  fileContents = {} as Record<string, string>,
  putResult = { id: 'readme-1', name: 'README.md' } as any
} = {}) {
  listFilesMock = vi.fn().mockResolvedValue({ children })
  getFileContentsMock = vi.fn().mockImplementation((_space: unknown, { path }: { path: string }) =>
    Promise.resolve({ body: fileContents[path] ?? '' })
  )
  putFileContentsMock = vi.fn().mockResolvedValue(putResult)

  vi.mocked(useClientService).mockReturnValue({
    webdav: {
      listFiles: listFilesMock,
      getFileContents: getFileContentsMock,
      putFileContents: putFileContentsMock
    }
  } as any)

  return { listFilesMock, getFileContentsMock, putFileContentsMock }
}

const VALID_README_JSON: ReadmeJson = {
  headline: 'Project Docs',
  subheadline: 'Planning material for the Q3 launch',
  purpose: 'This folder collects design notes and meeting minutes for the project.',
  key_files: [{ name: 'notes.txt', description: 'Running meeting notes' }],
  usage_notes: ['Add new notes at the top of notes.txt', 'Keep filenames lowercase']
}

beforeEach(() => {
  vi.restoreAllMocks()
  setupLLMMock()
  setupClientServiceMock()
  vi.mocked(useUserStore).mockReturnValue({ user: { preferredLanguage: 'en' } } as any)
})

describe('renderMarkdown', () => {
  it('renders headline, subheadline, overview, key files table and usage notes', () => {
    const markdown = renderMarkdown(VALID_README_JSON)

    expect(markdown).toContain('# Project Docs')
    expect(markdown).toContain('## Planning material for the Q3 launch')
    expect(markdown).toContain('## Overview')
    expect(markdown).toContain('This folder collects design notes')
    expect(markdown).toContain('## Key Files')
    expect(markdown).toContain('| notes.txt | Running meeting notes |')
    expect(markdown).toContain('## Usage')
    expect(markdown).toContain('- Add new notes at the top of notes.txt')
  })

  it('omits the subheadline section when subheadline is empty', () => {
    const markdown = renderMarkdown({ ...VALID_README_JSON, subheadline: '' })
    expect(markdown).not.toContain('## Planning material')
  })

  it('omits the Key Files section when key_files is empty', () => {
    const markdown = renderMarkdown({ ...VALID_README_JSON, key_files: [] })
    expect(markdown).not.toContain('## Key Files')
  })

  it('omits the Usage section when usage_notes is empty', () => {
    const markdown = renderMarkdown({ ...VALID_README_JSON, usage_notes: [] })
    expect(markdown).not.toContain('## Usage')
  })
})

describe('useReadmeGenerator', () => {
  describe('folder listing', () => {
    it('lists the folder at depth 1 via webdav.listFiles', async () => {
      setupClientServiceMock({ children: [] })
      setupLLMMock({ response: JSON.stringify(VALID_README_JSON) })

      const { generate } = useReadmeGenerator(BASE_CONFIG)
      await generate(SPACE, RESOURCE)

      expect(listFilesMock).toHaveBeenCalledWith(SPACE, { path: '/Project Docs' }, { depth: 1 })
    })

    it('sets an error and does not call webdav when the resource has no path', async () => {
      const { generate, error } = useReadmeGenerator(BASE_CONFIG)
      const result = await generate(SPACE, { id: 'f1', name: 'Project Docs' } as any)

      expect(result).toBeUndefined()
      expect(error.value).toBeTruthy()
      expect(listFilesMock).not.toHaveBeenCalled()
    })

    it('sets an error and does not call webdav when the LLM is not ready', async () => {
      setupLLMMock({ status: 'unconfigured' })
      const { generate, error } = useReadmeGenerator(BASE_CONFIG)
      const result = await generate(SPACE, RESOURCE)

      expect(result).toBeUndefined()
      expect(error.value).toBeTruthy()
      expect(listFilesMock).not.toHaveBeenCalled()
    })
  })

  describe('sampling cap', () => {
    it('samples at most 10 of the sampleable files, in listing order', async () => {
      const children = Array.from({ length: 12 }, (_, i) =>
        makeChild({ id: `c${i}`, name: `note-${i}.txt`, path: `/Project Docs/note-${i}.txt` })
      )
      setupClientServiceMock({ children, fileContents: Object.fromEntries(children.map((c) => [c.path, 'short content'])) })
      setupLLMMock({ response: JSON.stringify(VALID_README_JSON) })

      const { generate } = useReadmeGenerator(BASE_CONFIG)
      await generate(SPACE, RESOURCE)

      expect(getFileContentsMock).toHaveBeenCalledTimes(10)
      const fetchedPaths = getFileContentsMock.mock.calls.map((call) => call[1].path)
      expect(fetchedPaths).toEqual(children.slice(0, 10).map((c) => c.path))
    })

    it('skips non-sampleable files entirely', async () => {
      const children = [
        makeChild({ id: 'c1', name: 'notes.txt', path: '/Project Docs/notes.txt' }),
        makeChild({ id: 'c2', name: 'report.pdf', path: '/Project Docs/report.pdf', extension: 'pdf' }),
        makeChild({ id: 'c3', name: 'subfolder', path: '/Project Docs/subfolder', extension: '', isFolder: true })
      ]
      setupClientServiceMock({ children, fileContents: { '/Project Docs/notes.txt': 'hello' } })
      setupLLMMock({ response: JSON.stringify(VALID_README_JSON) })

      const { generate } = useReadmeGenerator(BASE_CONFIG)
      await generate(SPACE, RESOURCE)

      expect(getFileContentsMock).toHaveBeenCalledTimes(1)
      expect(getFileContentsMock).toHaveBeenCalledWith(
        SPACE,
        { path: '/Project Docs/notes.txt' },
        { responseType: 'text' }
      )
    })

    it('stops sampling once the 12 000 character budget is exhausted', async () => {
      const bigFile = makeChild({ id: 'c1', name: 'big.md', path: '/Project Docs/big.md', extension: 'md' })
      const secondFile = makeChild({ id: 'c2', name: 'small.txt', path: '/Project Docs/small.txt' })
      const children = [bigFile, secondFile]
      setupClientServiceMock({
        children,
        fileContents: {
          [bigFile.path]: 'x'.repeat(13_000),
          [secondFile.path]: 'short content'
        }
      })
      setupLLMMock({ response: JSON.stringify(VALID_README_JSON) })

      const { generate } = useReadmeGenerator(BASE_CONFIG)
      await generate(SPACE, RESOURCE)

      expect(getFileContentsMock).toHaveBeenCalledTimes(1)
      expect(getFileContentsMock).toHaveBeenCalledWith(
        SPACE,
        { path: bigFile.path },
        { responseType: 'text' }
      )
    })
  })

  describe('README existence detection', () => {
    it('does not prompt for overwrite when no README.md exists', async () => {
      const children = [makeChild()]
      setupClientServiceMock({ children })
      setupLLMMock({ response: JSON.stringify(VALID_README_JSON) })
      const confirmOverwrite = vi.fn().mockResolvedValue(true)

      const { generate } = useReadmeGenerator(BASE_CONFIG, { confirmOverwrite })
      await generate(SPACE, RESOURCE)

      expect(confirmOverwrite).not.toHaveBeenCalled()
      expect(putFileContentsMock).toHaveBeenCalled()
    })

    it('prompts for overwrite with the existing README resource when README.md exists', async () => {
      const existingReadme = { id: 'r1', name: 'README.md', path: '/Project Docs/README.md', isFolder: false }
      const children = [makeChild(), existingReadme]
      setupClientServiceMock({ children })
      setupLLMMock({ response: JSON.stringify(VALID_README_JSON) })
      const confirmOverwrite = vi.fn().mockResolvedValue(true)

      const { generate } = useReadmeGenerator(BASE_CONFIG, { confirmOverwrite })
      await generate(SPACE, RESOURCE)

      expect(confirmOverwrite).toHaveBeenCalledWith(existingReadme)
    })

    it('aborts without writing when the user declines the overwrite', async () => {
      const existingReadme = { id: 'r1', name: 'README.md', path: '/Project Docs/README.md', isFolder: false }
      const children = [existingReadme]
      setupClientServiceMock({ children })
      setupLLMMock({ response: JSON.stringify(VALID_README_JSON) })
      const confirmOverwrite = vi.fn().mockResolvedValue(false)

      const { generate } = useReadmeGenerator(BASE_CONFIG, { confirmOverwrite })
      const result = await generate(SPACE, RESOURCE)

      expect(result).toBeUndefined()
      expect(getFileContentsMock).not.toHaveBeenCalled()
      expect(putFileContentsMock).not.toHaveBeenCalled()
    })

    it('proceeds with generation when the user confirms the overwrite', async () => {
      const existingReadme = { id: 'r1', name: 'README.md', path: '/Project Docs/README.md', isFolder: false }
      const children = [existingReadme]
      setupClientServiceMock({ children })
      setupLLMMock({ response: JSON.stringify(VALID_README_JSON) })
      const confirmOverwrite = vi.fn().mockResolvedValue(true)

      const { generate } = useReadmeGenerator(BASE_CONFIG, { confirmOverwrite })
      const result = await generate(SPACE, RESOURCE)

      expect(result).toEqual({ id: 'readme-1', name: 'README.md' })
      expect(putFileContentsMock).toHaveBeenCalled()
    })
  })

  describe('LLM call shape', () => {
    it('calls llm.complete with a system + user message pair and generation options', async () => {
      const children = [makeChild()]
      setupClientServiceMock({ children, fileContents: { [children[0].path]: 'note body' } })
      setupLLMMock({ response: JSON.stringify(VALID_README_JSON) })

      const { generate } = useReadmeGenerator(BASE_CONFIG)
      await generate(SPACE, RESOURCE)

      expect(completeMock).toHaveBeenCalledTimes(1)
      const [messages, opts] = completeMock.mock.calls[0]
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
      expect(opts).toEqual({ maxTokens: 1024, temperature: 0.4 })
    })

    it('instructs the model to respond with the README JSON schema', async () => {
      setupClientServiceMock({ children: [] })
      setupLLMMock({ response: JSON.stringify(VALID_README_JSON) })

      const { generate } = useReadmeGenerator(BASE_CONFIG)
      await generate(SPACE, RESOURCE)

      const [messages] = completeMock.mock.calls[0]
      expect(messages[0].content).toContain('headline')
      expect(messages[0].content).toContain('key_files')
      expect(messages[0].content).toContain('usage_notes')
    })

    it('includes the folder name and sampled file contents in the user message', async () => {
      const children = [makeChild({ name: 'notes.txt', path: '/Project Docs/notes.txt' })]
      setupClientServiceMock({ children, fileContents: { '/Project Docs/notes.txt': 'Meeting notes body' } })
      setupLLMMock({ response: JSON.stringify(VALID_README_JSON) })

      const { generate } = useReadmeGenerator(BASE_CONFIG)
      await generate(SPACE, RESOURCE)

      const [messages] = completeMock.mock.calls[0]
      expect(messages[1].content).toContain('Project Docs')
      expect(messages[1].content).toContain('notes.txt')
      expect(messages[1].content).toContain('Meeting notes body')
    })
  })

  describe('Markdown rendering from JSON (Tier 1)', () => {
    it('writes the rendered Markdown produced from the parsed JSON response', async () => {
      setupClientServiceMock({ children: [] })
      setupLLMMock({ response: JSON.stringify(VALID_README_JSON) })

      const { generate } = useReadmeGenerator(BASE_CONFIG)
      await generate(SPACE, RESOURCE)

      const putCall = putFileContentsMock.mock.calls[0][1]
      expect(putCall.content).toBe(renderMarkdown(VALID_README_JSON))
    })
  })

  describe('Tier 2 plain-text fallback', () => {
    it('writes the raw response as-is when it is not valid JSON', async () => {
      setupClientServiceMock({ children: [] })
      setupLLMMock({ response: 'This folder holds project planning notes.' })

      const { generate } = useReadmeGenerator(BASE_CONFIG)
      await generate(SPACE, RESOURCE)

      const putCall = putFileContentsMock.mock.calls[0][1]
      expect(putCall.content).toBe('This folder holds project planning notes.')
    })

    it('falls back to raw text when the JSON is missing required fields', async () => {
      setupClientServiceMock({ children: [] })
      setupLLMMock({ response: JSON.stringify({ subheadline: 'Missing headline and purpose' }) })

      const { generate } = useReadmeGenerator(BASE_CONFIG)
      await generate(SPACE, RESOURCE)

      const putCall = putFileContentsMock.mock.calls[0][1]
      expect(putCall.content).toBe(JSON.stringify({ subheadline: 'Missing headline and purpose' }))
    })

    it('sets an error and does not write when the response is empty after trimming', async () => {
      setupClientServiceMock({ children: [] })
      setupLLMMock({ response: '   ' })

      const { generate, error } = useReadmeGenerator(BASE_CONFIG)
      const result = await generate(SPACE, RESOURCE)

      expect(result).toBeUndefined()
      expect(error.value).toBeTruthy()
      expect(putFileContentsMock).not.toHaveBeenCalled()
    })
  })

  describe('WebDAV write call', () => {
    it('writes README.md into the folder with overwrite enabled', async () => {
      setupClientServiceMock({ children: [] })
      setupLLMMock({ response: JSON.stringify(VALID_README_JSON) })

      const { generate } = useReadmeGenerator(BASE_CONFIG)
      await generate(SPACE, RESOURCE)

      expect(putFileContentsMock).toHaveBeenCalledWith(SPACE, {
        path: urlJoin(RESOURCE.path, 'README.md'),
        content: renderMarkdown(VALID_README_JSON),
        overwrite: true
      })
    })

    it('returns the resource written by webdav.putFileContents', async () => {
      const putResult = { id: 'readme-2', name: 'README.md' }
      setupClientServiceMock({ children: [], putResult })
      setupLLMMock({ response: JSON.stringify(VALID_README_JSON) })

      const { generate } = useReadmeGenerator(BASE_CONFIG)
      const result = await generate(SPACE, RESOURCE)

      expect(result).toEqual(putResult)
    })
  })

  describe('isGenerating lifecycle', () => {
    it('is true while generation is in flight and false once complete', async () => {
      let observedDuring = false
      setupClientServiceMock({ children: [] })
      completeMock = vi.fn().mockImplementation(() => {
        observedDuring = true
        return Promise.resolve(JSON.stringify(VALID_README_JSON))
      })
      vi.mocked(useLLM).mockReturnValue({ status: ref('ready' as LLMStatus), complete: completeMock, stream: vi.fn() } as any)

      const { generate, isGenerating } = useReadmeGenerator(BASE_CONFIG)
      const promise = generate(SPACE, RESOURCE)
      expect(isGenerating.value).toBe(true)
      await promise
      expect(isGenerating.value).toBe(false)
      expect(observedDuring).toBe(true)
    })
  })
})
