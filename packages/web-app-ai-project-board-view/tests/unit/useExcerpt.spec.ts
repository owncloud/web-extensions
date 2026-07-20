import { describe, it, expect, vi, beforeEach } from 'vitest'

// Module-level mocks — hoisted by vitest before any import
vi.mock('@ownclouders/web-pkg', () => ({
  useClientService: vi.fn(),
  useSpacesStore: vi.fn()
}))

import { useExcerpt, MAX_EXCERPT_BYTES, type ExcerptResource } from '../../src/composables/useExcerpt'
import { useClientService, useSpacesStore } from '@ownclouders/web-pkg'

function makeResource(overrides: Partial<ExcerptResource> = {}): ExcerptResource {
  return {
    storageId: 'space-1',
    path: '/notes.md',
    mimeType: 'text/markdown',
    size: 512,
    isFolder: false,
    ...overrides
  }
}

let getFileContentsMock: ReturnType<typeof vi.fn>

function setupWebdavMock({ text = 'Draft notes for the Q3 launch plan.' } = {}) {
  getFileContentsMock = vi.fn().mockResolvedValue({ response: { data: text } })
  vi.mocked(useClientService).mockReturnValue({
    webdav: { getFileContents: getFileContentsMock }
  } as any)
}

beforeEach(() => {
  vi.restoreAllMocks()
  setupWebdavMock()
  vi.mocked(useSpacesStore).mockReturnValue({
    getSpace: vi.fn().mockReturnValue({ id: 'space-1' })
  } as any)
})

describe('useExcerpt', () => {
  describe('happy path', () => {
    it('fetches and returns the text excerpt for a text-like file', async () => {
      const { fetchExcerpt } = useExcerpt()
      const excerpt = await fetchExcerpt(makeResource())
      expect(excerpt).toBe('Draft notes for the Q3 launch plan.')
      expect(getFileContentsMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'space-1' }),
        expect.objectContaining({ path: '/notes.md' }),
        expect.objectContaining({ responseType: 'text' })
      )
    })

    it('requests a byte-range header capped at MAX_EXCERPT_BYTES', async () => {
      const { fetchExcerpt } = useExcerpt()
      await fetchExcerpt(makeResource())
      expect(getFileContentsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({ Range: `bytes=0-${MAX_EXCERPT_BYTES - 1}` })
        })
      )
    })

    it('truncates a response longer than MAX_EXCERPT_BYTES', async () => {
      const longText = 'a'.repeat(MAX_EXCERPT_BYTES + 500)
      setupWebdavMock({ text: longText })
      const { fetchExcerpt } = useExcerpt()
      const excerpt = await fetchExcerpt(makeResource())
      expect(excerpt).toHaveLength(MAX_EXCERPT_BYTES)
    })

    it('accepts application/json as text-like', async () => {
      const { fetchExcerpt } = useExcerpt()
      const excerpt = await fetchExcerpt(makeResource({ mimeType: 'application/json' }))
      expect(excerpt).toBe('Draft notes for the Q3 launch plan.')
    })

    it('returns undefined when the WebDAV fetch throws', async () => {
      getFileContentsMock.mockRejectedValue(new Error('network error'))
      const { fetchExcerpt } = useExcerpt()
      const excerpt = await fetchExcerpt(makeResource())
      expect(excerpt).toBeUndefined()
    })
  })

  describe('binary/unsupported mime skipped', () => {
    it('skips a binary mime type without fetching', async () => {
      const { fetchExcerpt } = useExcerpt()
      const excerpt = await fetchExcerpt(makeResource({ mimeType: 'image/png' }))
      expect(excerpt).toBeUndefined()
      expect(getFileContentsMock).not.toHaveBeenCalled()
    })

    it('skips when mimeType is missing', async () => {
      const { fetchExcerpt } = useExcerpt()
      const excerpt = await fetchExcerpt(makeResource({ mimeType: undefined }))
      expect(excerpt).toBeUndefined()
      expect(getFileContentsMock).not.toHaveBeenCalled()
    })

    it('skips a folder resource without fetching', async () => {
      const { fetchExcerpt } = useExcerpt()
      const excerpt = await fetchExcerpt(makeResource({ isFolder: true }))
      expect(excerpt).toBeUndefined()
      expect(getFileContentsMock).not.toHaveBeenCalled()
    })

    it('skips when storageId or path is missing', async () => {
      const { fetchExcerpt } = useExcerpt()
      const excerpt = await fetchExcerpt(makeResource({ storageId: undefined }))
      expect(excerpt).toBeUndefined()
      expect(getFileContentsMock).not.toHaveBeenCalled()
    })
  })

  describe('oversized file skipped', () => {
    it('skips a file larger than the fetchable byte limit', async () => {
      const { fetchExcerpt } = useExcerpt()
      const excerpt = await fetchExcerpt(makeResource({ size: 2 * 1024 * 1024 + 1 }))
      expect(excerpt).toBeUndefined()
      expect(getFileContentsMock).not.toHaveBeenCalled()
    })

    it('fetches a file exactly at the fetchable byte limit', async () => {
      const { fetchExcerpt } = useExcerpt()
      const excerpt = await fetchExcerpt(makeResource({ size: 2 * 1024 * 1024 }))
      expect(excerpt).toBe('Draft notes for the Q3 launch plan.')
      expect(getFileContentsMock).toHaveBeenCalled()
    })

    it('fetches when size is a numeric string within the limit', async () => {
      const { fetchExcerpt } = useExcerpt()
      const excerpt = await fetchExcerpt(makeResource({ size: '512' as unknown as number }))
      expect(excerpt).toBe('Draft notes for the Q3 launch plan.')
      expect(getFileContentsMock).toHaveBeenCalled()
    })

    it('fetches when size is undefined (unknown size)', async () => {
      const { fetchExcerpt } = useExcerpt()
      const excerpt = await fetchExcerpt(makeResource({ size: undefined }))
      expect(excerpt).toBe('Draft notes for the Q3 launch plan.')
      expect(getFileContentsMock).toHaveBeenCalled()
    })
  })

  describe('space resolution', () => {
    it('returns undefined when the space cannot be resolved', async () => {
      vi.mocked(useSpacesStore).mockReturnValue({
        getSpace: vi.fn().mockReturnValue(null)
      } as any)
      const { fetchExcerpt } = useExcerpt()
      const excerpt = await fetchExcerpt(makeResource())
      expect(excerpt).toBeUndefined()
      expect(getFileContentsMock).not.toHaveBeenCalled()
    })
  })
})
