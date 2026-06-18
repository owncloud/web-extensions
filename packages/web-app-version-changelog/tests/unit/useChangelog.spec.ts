import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({ $gettext: (s: string) => s, current: 'en' })
}))

vi.mock('@ownclouders/web-pkg', () => ({
  useAuthStore: vi.fn(),
  useUserStore: vi.fn()
}))

vi.mock('../../src/utils/diff', () => ({
  computeDiff: vi.fn(),
  diffToText: vi.fn()
}))

import { useChangelog } from '../../src/composables/useChangelog'
import { useAuthStore, useUserStore } from '@ownclouders/web-pkg'
import { computeDiff, diffToText } from '../../src/utils/diff'
import type { LlmConfig } from '../../src/composables/useLlm'

const BASE_CONFIG: LlmConfig = { endpoint: 'http://localhost:3000/ai/v1', model: 'test-model' }

function makeFetchResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body)
  })
}

function setupMocks() {
  vi.mocked(useAuthStore).mockReturnValue({ accessToken: 'test-token' } as any)
  vi.mocked(useUserStore).mockReturnValue({ user: { preferredLanguage: 'en' } } as any)
  vi.mocked(computeDiff).mockReturnValue([{ lines: [{ type: 'added', text: 'new line' }] }])
  vi.mocked(diffToText).mockReturnValue('+ new line')
}

describe('useChangelog', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    setupMocks()
  })

  it('returns undefined for unknown cache key', () => {
    const { getEntry } = useChangelog(BASE_CONFIG)
    expect(getEntry('unknown-key')).toBeUndefined()
  })

  it('stores LLM response text as summary', async () => {
    const llmResponse = {
      choices: [{ message: { content: 'Q3 figures were added and the draft watermark was removed.' } }]
    }
    vi.mocked(fetch).mockReturnValueOnce(makeFetchResponse(llmResponse) as any)
    const { generateEntry, getEntry } = useChangelog(BASE_CONFIG)
    await generateEntry('key1', () => Promise.resolve('old content'), () => Promise.resolve('new content'))
    expect(getEntry('key1')?.summary).toBe('Q3 figures were added and the draft watermark was removed.')
  })

  it('trims whitespace from LLM response', async () => {
    const llmResponse = {
      choices: [{ message: { content: '  The document was updated with new figures.  ' } }]
    }
    vi.mocked(fetch).mockReturnValueOnce(makeFetchResponse(llmResponse) as any)
    const { generateEntry, getEntry } = useChangelog(BASE_CONFIG)
    await generateEntry('key2', () => Promise.resolve('old'), () => Promise.resolve('new'))
    expect(getEntry('key2')?.summary).toBe('The document was updated with new figures.')
  })

  it('caches result and skips LLM on second call', async () => {
    const llmResponse = {
      choices: [{ message: { content: '{"added":["x"],"removed":[],"modified":[]}' } }]
    }
    vi.mocked(fetch).mockReturnValue(makeFetchResponse(llmResponse) as any)
    const { generateEntry, getEntry } = useChangelog(BASE_CONFIG)
    await generateEntry('key3', () => Promise.resolve('old'), () => Promise.resolve('new'))
    await generateEntry('key3', () => Promise.resolve('old'), () => Promise.resolve('new'))
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(getEntry('key3')).toBeDefined()
  })

  it('sets error on HTTP 401', async () => {
    vi.mocked(fetch).mockReturnValueOnce(makeFetchResponse({}, false, 401) as any)
    const { generateEntry, getError } = useChangelog(BASE_CONFIG)
    await generateEntry('key4', () => Promise.resolve('old'), () => Promise.resolve('new'))
    expect(getError('key4')).toContain('denied')
  })

  it('sets error on HTTP 404', async () => {
    vi.mocked(fetch).mockReturnValueOnce(makeFetchResponse({}, false, 404) as any)
    const { generateEntry, getError } = useChangelog(BASE_CONFIG)
    await generateEntry('key5', () => Promise.resolve('old'), () => Promise.resolve('new'))
    expect(getError('key5')).toContain('endpoint could not be found')
  })

  it('sets error on HTTP 429', async () => {
    vi.mocked(fetch).mockReturnValueOnce(makeFetchResponse({}, false, 429) as any)
    const { generateEntry, getError } = useChangelog(BASE_CONFIG)
    await generateEntry('key6', () => Promise.resolve('old'), () => Promise.resolve('new'))
    expect(getError('key6')).toContain('busy')
  })

  it('sets error on HTTP 500', async () => {
    vi.mocked(fetch).mockReturnValueOnce(makeFetchResponse({}, false, 500) as any)
    const { generateEntry, getError } = useChangelog(BASE_CONFIG)
    await generateEntry('key7', () => Promise.resolve('old'), () => Promise.resolve('new'))
    expect(getError('key7')).toContain('unavailable')
  })

  it('sets summary when diff is empty and contents are identical', async () => {
    vi.mocked(computeDiff).mockReturnValueOnce([])
    vi.mocked(diffToText).mockReturnValueOnce('')
    const { generateEntry, getEntry } = useChangelog(BASE_CONFIG)
    await generateEntry('key8', () => Promise.resolve('same'), () => Promise.resolve('same'))
    expect(getEntry('key8')?.summary).toContain('No text changes')
  })

  it('sets error when files differ but diff is empty (too large to compare)', async () => {
    vi.mocked(computeDiff).mockReturnValueOnce([])
    vi.mocked(diffToText).mockReturnValueOnce('')
    const { generateEntry, getError } = useChangelog(BASE_CONFIG)
    await generateEntry('key-large', () => Promise.resolve('old content'), () => Promise.resolve('new content'))
    expect(getError('key-large')).toContain('too large')
  })

  it('does nothing when llmConfig is null', async () => {
    vi.mocked(fetch).mockReturnValueOnce(makeFetchResponse({}) as any)
    const { generateEntry, getError } = useChangelog(null)
    await generateEntry('key9', () => Promise.resolve('old'), () => Promise.resolve('new'))
    expect(getError('key9')).toBeDefined()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('clearError removes the error', async () => {
    vi.mocked(fetch).mockReturnValueOnce(makeFetchResponse({}, false, 500) as any)
    const { generateEntry, getError, clearError } = useChangelog(BASE_CONFIG)
    await generateEntry('key10', () => Promise.resolve('old'), () => Promise.resolve('new'))
    expect(getError('key10')).toBeDefined()
    clearError('key10')
    expect(getError('key10')).toBeUndefined()
  })
})
