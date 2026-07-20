import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({ $gettext: (s: string) => s })
}))

vi.mock('@ownclouders/web-pkg', () => ({
  useClientService: vi.fn(),
  useConfigStore: vi.fn(),
  useSpacesStore: vi.fn()
}))

import { useRecentFiles } from '../../src/composables/useRecentFiles'
import { useClientService, useConfigStore, useSpacesStore } from '@ownclouders/web-pkg'

const requestMock = vi.fn()
const getFileContentsMock = vi.fn()

function setupClientMock() {
  requestMock.mockReset()
  getFileContentsMock.mockReset()
  vi.mocked(useClientService).mockReturnValue({
    httpAuthenticated: { request: requestMock },
    webdav: { getFileContents: getFileContentsMock }
  } as any)
}

function setupSpaces(spaces: { id: string }[]) {
  vi.mocked(useSpacesStore).mockReturnValue({ spaces } as any)
}

beforeEach(() => {
  setupClientMock()
  vi.mocked(useConfigStore).mockReturnValue({ serverUrl: 'https://cloud.example.com' } as any)
  setupSpaces([{ id: 'space-1' }])
})

interface MultistatusEntry {
  href: string
  displayname?: string
  contentType?: string
  size?: number
  mdate?: string
  fileId?: string
}

// NOTE on namespaces: happy-dom's getElementsByTagNameNS (the Vitest DOM used by this package,
// see vite.config.ts) compares against an element's raw (prefixed) tagName instead of its
// localName, so prefixed tags like `<d:response>` never match a `getElementsByTagNameNS('DAV:',
// 'response')` lookup — the production parser (useRecentFiles.ts) would find zero elements no
// matter how well-formed the XML is. Declaring "DAV:" as the *default* (unprefixed) namespace
// sidesteps the bug: unprefixed tags have a tagName equal to their localName, so the buggy
// comparison happens to succeed. The single oc:fileid field re-declares the default namespace
// locally to the owncloud NS for just that element (also unprefixed) so both lookups work.
function multistatusXml(entries: MultistatusEntry[]): string {
  const responses = entries
    .map(
      (e) => `
    <response>
      <href>${e.href}</href>
      <propstat>
        <prop>
          ${e.displayname !== undefined ? `<displayname>${e.displayname}</displayname>` : ''}
          <getcontenttype>${e.contentType ?? 'text/plain'}</getcontenttype>
          <getcontentlength>${e.size ?? 0}</getcontentlength>
          <getlastmodified>${e.mdate ?? ''}</getlastmodified>
          ${e.fileId !== undefined ? `<fileid xmlns="http://owncloud.org/ns">${e.fileId}</fileid>` : ''}
        </prop>
        <status>HTTP/1.1 200 OK</status>
      </propstat>
    </response>`
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:">${responses}</multistatus>`
}

describe('useRecentFiles', () => {
  describe('REPORT request building', () => {
    it('issues a REPORT request to /dav/spaces/<spaceId> with the pattern and limit in the body', async () => {
      requestMock.mockResolvedValue({ data: multistatusXml([]) })
      const { fetchRecentFiles } = useRecentFiles()
      await fetchRecentFiles()

      expect(requestMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'REPORT',
          url: 'https://cloud.example.com/dav/spaces/space-1',
          headers: { 'Content-Type': 'application/xml' }
        })
      )
      const body = requestMock.mock.calls[0][0].data as string
      expect(body).toContain('<oc:pattern>*</oc:pattern>')
      expect(body).toContain('<oc:limit>50</oc:limit>')
    })

    it('URL-encodes the space id in the request URL', async () => {
      setupSpaces([{ id: 'space/with spaces' }])
      requestMock.mockResolvedValue({ data: multistatusXml([]) })
      const { fetchRecentFiles } = useRecentFiles()
      await fetchRecentFiles()
      expect(requestMock).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://cloud.example.com/dav/spaces/space%2Fwith%20spaces' })
      )
    })

    it('strips a trailing slash from the configured server URL', async () => {
      vi.mocked(useConfigStore).mockReturnValue({ serverUrl: 'https://cloud.example.com/' } as any)
      requestMock.mockResolvedValue({ data: multistatusXml([]) })
      const { fetchRecentFiles } = useRecentFiles()
      await fetchRecentFiles()
      expect(requestMock).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://cloud.example.com/dav/spaces/space-1' })
      )
    })

    it('passes an abort signal for the request timeout', async () => {
      requestMock.mockResolvedValue({ data: multistatusXml([]) })
      const { fetchRecentFiles } = useRecentFiles()
      await fetchRecentFiles()
      expect(requestMock.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal)
    })
  })

  describe('XML parsing', () => {
    it('parses displayname, size, mdate, and fileid from a multistatus response', async () => {
      requestMock.mockResolvedValue({
        data: multistatusXml([
          {
            href: '/dav/spaces/space-1/invoice.txt',
            displayname: 'invoice.txt',
            size: 1234,
            mdate: 'Mon, 01 Jan 2024 00:00:00 GMT',
            fileId: 'file-1'
          }
        ])
      })
      const { fetchRecentFiles } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(files).toHaveLength(1)
      expect(files[0]).toMatchObject({
        fileId: 'file-1',
        name: 'invoice.txt',
        path: '/invoice.txt',
        size: 1234,
        mdate: 'Mon, 01 Jan 2024 00:00:00 GMT',
        extension: 'txt'
      })
    })

    it('skips folder entries identified by contentType', async () => {
      requestMock.mockResolvedValue({
        data: multistatusXml([
          {
            href: '/dav/spaces/space-1/subfolder',
            displayname: 'subfolder',
            contentType: 'httpd/unix-directory'
          }
        ])
      })
      const { fetchRecentFiles } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(files).toHaveLength(0)
    })

    it('skips folder entries identified only by a trailing slash href', async () => {
      requestMock.mockResolvedValue({
        data: multistatusXml([
          { href: '/dav/spaces/space-1/subfolder/', displayname: 'subfolder', contentType: 'text/plain' }
        ])
      })
      const { fetchRecentFiles } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(files).toHaveLength(0)
    })

    it('falls back to the last path segment when displayname is missing', async () => {
      requestMock.mockResolvedValue({
        data: multistatusXml([{ href: '/dav/spaces/space-1/notes.md', fileId: 'file-2' }])
      })
      const { fetchRecentFiles } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(files[0].name).toBe('notes.md')
    })

    it('falls back to "<spaceId>!<path>" when oc:fileid is missing', async () => {
      requestMock.mockResolvedValue({
        data: multistatusXml([{ href: '/dav/spaces/space-1/report.txt', displayname: 'report.txt' }])
      })
      const { fetchRecentFiles } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(files[0].fileId).toBe('space-1!/report.txt')
    })

    it('treats a non-XML response as an empty result for that space (caught, not thrown)', async () => {
      requestMock.mockResolvedValue({ data: 'not xml at all' })
      const { fetchRecentFiles } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(files).toEqual([])
    })
  })

  describe('multi-space fan-out', () => {
    it('issues one REPORT request per space and merges the results', async () => {
      setupSpaces([{ id: 'space-1' }, { id: 'space-2' }])
      requestMock.mockImplementation(({ url }: { url: string }) => {
        if (url.includes('space-1')) {
          return Promise.resolve({
            data: multistatusXml([
              { href: '/dav/spaces/space-1/a.txt', displayname: 'a.txt', fileId: 'a' }
            ])
          })
        }
        return Promise.resolve({
          data: multistatusXml([{ href: '/dav/spaces/space-2/b.txt', displayname: 'b.txt', fileId: 'b' }])
        })
      })
      const { fetchRecentFiles } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(requestMock).toHaveBeenCalledTimes(2)
      expect(files.map((f) => f.fileId).sort()).toEqual(['a', 'b'])
    })

    it('sorts merged files by mdate descending', async () => {
      setupSpaces([{ id: 'space-1' }, { id: 'space-2' }])
      requestMock.mockImplementation(({ url }: { url: string }) => {
        if (url.includes('space-1')) {
          return Promise.resolve({
            data: multistatusXml([
              {
                href: '/dav/spaces/space-1/old.txt',
                displayname: 'old.txt',
                fileId: 'old',
                mdate: 'Mon, 01 Jan 2024 00:00:00 GMT'
              }
            ])
          })
        }
        return Promise.resolve({
          data: multistatusXml([
            {
              href: '/dav/spaces/space-2/new.txt',
              displayname: 'new.txt',
              fileId: 'new',
              mdate: 'Fri, 01 Mar 2024 00:00:00 GMT'
            }
          ])
        })
      })
      const { fetchRecentFiles } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(files.map((f) => f.fileId)).toEqual(['new', 'old'])
    })

    it('caps the merged result to the global recent-files limit', async () => {
      setupSpaces([{ id: 'space-1' }, { id: 'space-2' }])
      const makeEntries = (spaceId: string, count: number): MultistatusEntry[] =>
        Array.from({ length: count }, (_, i) => ({
          href: `/dav/spaces/${spaceId}/file-${i}.txt`,
          displayname: `file-${i}.txt`,
          fileId: `${spaceId}-${i}`,
          mdate: new Date(2024, 0, i + 1).toUTCString()
        }))
      requestMock.mockImplementation(({ url }: { url: string }) => {
        const spaceId = url.includes('space-1') ? 'space-1' : 'space-2'
        return Promise.resolve({ data: multistatusXml(makeEntries(spaceId, 60)) })
      })
      const { fetchRecentFiles } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(files).toHaveLength(100)
    })

    it('returns an empty array without making any request when there are no spaces', async () => {
      setupSpaces([])
      const { fetchRecentFiles } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(files).toEqual([])
      expect(requestMock).not.toHaveBeenCalled()
    })
  })

  describe('error / timeout handling', () => {
    it('treats a rejected REPORT request as an empty result for that space, without failing the whole fetch', async () => {
      setupSpaces([{ id: 'space-1' }, { id: 'space-2' }])
      requestMock.mockImplementation(({ url }: { url: string }) => {
        if (url.includes('space-1')) {
          return Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'))
        }
        return Promise.resolve({
          data: multistatusXml([{ href: '/dav/spaces/space-2/b.txt', displayname: 'b.txt', fileId: 'b' }])
        })
      })
      const { fetchRecentFiles, error } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(files.map((f) => f.fileId)).toEqual(['b'])
      expect(error.value).toBeNull()
    })

    it('sets an outage error when every space fails, distinct from a genuinely empty result', async () => {
      setupSpaces([{ id: 'space-1' }, { id: 'space-2' }])
      requestMock.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'))
      const { fetchRecentFiles, error } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(files).toEqual([])
      expect(error.value).toMatch(/could not reach any of your spaces/i)
    })

    it('leaves the error ref null when every space succeeds but genuinely has no files', async () => {
      setupSpaces([{ id: 'space-1' }, { id: 'space-2' }])
      requestMock.mockResolvedValue({ data: multistatusXml([]) })
      const { fetchRecentFiles, error } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(files).toEqual([])
      expect(error.value).toBeNull()
    })

    it('sets the error ref and returns an empty array when reading spaces throws unexpectedly', async () => {
      vi.mocked(useSpacesStore).mockReturnValue({
        get spaces(): never {
          throw new Error('store unavailable')
        }
      } as any)
      const { fetchRecentFiles, error } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(files).toEqual([])
      expect(error.value).toBe('store unavailable')
    })

    it('toggles isLoading to true during the fetch and back to false afterwards', async () => {
      requestMock.mockResolvedValue({ data: multistatusXml([]) })
      const { fetchRecentFiles, isLoading } = useRecentFiles()
      expect(isLoading.value).toBe(false)
      const promise = fetchRecentFiles()
      expect(isLoading.value).toBe(true)
      await promise
      expect(isLoading.value).toBe(false)
    })

    it('skips excerpt fetching for non-text extensions', async () => {
      requestMock.mockResolvedValue({
        data: multistatusXml([
          {
            href: '/dav/spaces/space-1/photo.png',
            displayname: 'photo.png',
            fileId: 'p1',
            contentType: 'image/png'
          }
        ])
      })
      const { fetchRecentFiles } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(getFileContentsMock).not.toHaveBeenCalled()
      expect(files[0].excerpt).toBeUndefined()
    })

    it('skips excerpt fetching for files above the size guard', async () => {
      requestMock.mockResolvedValue({
        data: multistatusXml([
          { href: '/dav/spaces/space-1/big.txt', displayname: 'big.txt', fileId: 'big', size: 2_000_000 }
        ])
      })
      const { fetchRecentFiles } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(getFileContentsMock).not.toHaveBeenCalled()
      expect(files[0].excerpt).toBeUndefined()
    })

    it('fetches and attaches an excerpt for a small text file', async () => {
      requestMock.mockResolvedValue({
        data: multistatusXml([
          { href: '/dav/spaces/space-1/notes.txt', displayname: 'notes.txt', fileId: 'n1', size: 50 }
        ])
      })
      getFileContentsMock.mockResolvedValue({ response: { data: 'Some file content' } })
      const { fetchRecentFiles } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(getFileContentsMock).toHaveBeenCalled()
      expect(files[0].excerpt).toBe('Some file content')
    })

    it('requests only a byte range of the file instead of downloading the full body', async () => {
      requestMock.mockResolvedValue({
        data: multistatusXml([
          { href: '/dav/spaces/space-1/notes.txt', displayname: 'notes.txt', fileId: 'n1', size: 50 }
        ])
      })
      getFileContentsMock.mockResolvedValue({ response: { data: 'Some file content' } })
      const { fetchRecentFiles } = useRecentFiles()
      await fetchRecentFiles()
      const [, , options] = getFileContentsMock.mock.calls[0]
      expect(options.headers.Range).toMatch(/^bytes=0-\d+$/)
    })

    it('leaves excerpt undefined (without throwing) when the excerpt fetch fails', async () => {
      requestMock.mockResolvedValue({
        data: multistatusXml([
          { href: '/dav/spaces/space-1/notes.txt', displayname: 'notes.txt', fileId: 'n1', size: 50 }
        ])
      })
      getFileContentsMock.mockRejectedValue(new Error('network error'))
      const { fetchRecentFiles } = useRecentFiles()
      const files = await fetchRecentFiles()
      expect(files[0].excerpt).toBeUndefined()
    })
  })
})
