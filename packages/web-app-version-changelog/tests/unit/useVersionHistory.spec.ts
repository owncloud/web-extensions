import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({ $gettext: (s: string) => s })
}))

vi.mock('@ownclouders/web-pkg', () => ({
  useClientService: vi.fn()
}))

import { useVersionHistory } from '../../src/composables/useVersionHistory'
import { useClientService } from '@ownclouders/web-pkg'

function makeVersion(dateStr: string, etag: string) {
  return { mdate: dateStr, etag, id: etag, name: `v-${etag}`, type: 'file' }
}

let listFileVersionsMock: ReturnType<typeof vi.fn>

function setupClientServiceMock() {
  listFileVersionsMock = vi.fn()
  vi.mocked(useClientService).mockReturnValue({
    webdav: { listFileVersions: listFileVersionsMock }
  } as any)
}

describe('useVersionHistory', () => {
  beforeEach(() => {
    setupClientServiceMock()
  })

  it('returns empty list and not loading initially', () => {
    listFileVersionsMock.mockResolvedValue([])
    const { versions, isLoading, error } = useVersionHistory()
    expect(versions.value).toEqual([])
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('sets isLoading during fetch', async () => {
    let resolve!: (v: any) => void
    listFileVersionsMock.mockReturnValue(new Promise((r) => { resolve = r }))
    const { isLoading, fetchVersions } = useVersionHistory()
    const promise = fetchVersions('file-123')
    expect(isLoading.value).toBe(true)
    resolve([])
    await promise
    expect(isLoading.value).toBe(false)
  })

  it('returns versions sorted newest-first', async () => {
    const older = makeVersion('Mon, 01 Jan 2024 10:00:00 GMT', 'etag-a')
    const newer = makeVersion('Tue, 02 Jan 2024 10:00:00 GMT', 'etag-b')
    listFileVersionsMock.mockResolvedValue([older, newer])
    const { versions, fetchVersions } = useVersionHistory()
    await fetchVersions('file-123')
    expect(versions.value[0].etag).toBe('etag-b')
    expect(versions.value[1].etag).toBe('etag-a')
  })

  it('sets translated error on failure', async () => {
    listFileVersionsMock.mockRejectedValue(new Error('Network error'))
    const { error, fetchVersions } = useVersionHistory()
    await fetchVersions('file-123')
    expect(error.value).toBe('Failed to load version history.')
  })

  it('sets access denied error on 401', async () => {
    listFileVersionsMock.mockRejectedValue(new Error('401 Unauthorized'))
    const { error, fetchVersions } = useVersionHistory()
    await fetchVersions('file-123')
    expect(error.value).toBe('Access denied. Your session may have expired.')
  })

  it('sets not found error on 404', async () => {
    listFileVersionsMock.mockRejectedValue(new Error('404 Not Found'))
    const { error, fetchVersions } = useVersionHistory()
    await fetchVersions('file-123')
    expect(error.value).toBe('No version history found for this file.')
  })
})
