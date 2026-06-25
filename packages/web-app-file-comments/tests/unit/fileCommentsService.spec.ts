import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Resource } from '@ownclouders/web-client'
import {
  COMMENTS_NAMESPACE,
  FileCommentsService,
  type DavHttpClient
} from '../../src/services/fileCommentsService'
import { serializeComment } from '../../src/services/commentFormat'

const resource = { webDavPath: '/spaces/space-id/report.txt' } as Resource

const multistatus = (properties: Record<string, string>, status = 'HTTP/1.1 200 OK') => {
  const values = Object.entries(properties)
    .map(([name, value]) => `<fc:${name}>${value}</fc:${name}>`)
    .join('')
  return `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:fc="${COMMENTS_NAMESPACE}"><d:response><d:propstat><d:prop>${values}</d:prop><d:status>${status}</d:status></d:propstat></d:response></d:multistatus>`
}

const successfulPatch = multistatus({ count: '1' })

describe('FileCommentsService', () => {
  let request: ReturnType<typeof vi.fn>
  let service: FileCommentsService

  beforeEach(() => {
    request = vi.fn()
    service = new FileCommentsService({ request } as DavHttpClient, { delayMs: 0 })
  })

  it('reads the live index, skips missing slots and parses comments', async () => {
    request
      .mockResolvedValueOnce({ data: multistatus({ index: '1,2' }), headers: {} })
      .mockResolvedValueOnce({
        data: multistatus({
          // slot 1 listed in the index but absent here (deleted/malformed) -> skipped
          'comment-000002': serializeComment(
            {
              version: 1,
              authorId: 'bob-id',
              authorName: 'Bob',
              createdAt: '2026-06-17T12:00:00.000Z'
            },
            'Second comment'
          )
        }),
        headers: {}
      })

    await expect(service.list(resource)).resolves.toEqual([
      expect.objectContaining({
        id: 'comment-000002',
        sequence: 2,
        authorName: 'Bob',
        body: 'Second comment'
      })
    ])

    expect(request.mock.calls[0][0].data).toContain('fc:index')
    expect(request.mock.calls[1][0].data).toContain('fc:comment-000001')
    expect(request.mock.calls[1][0].data).toContain('fc:comment-000002')
    expect(request.mock.calls[1][0].url).toBe('/dav/spaces/space-id/report.txt')
  })

  it('locks, allocates the latest sequence and unlocks when adding', async () => {
    request
      .mockResolvedValueOnce({ data: '<lock/>', headers: { 'lock-token': '<token-1>' } })
      .mockResolvedValueOnce({ data: multistatus({ count: '3', index: '1,2,3' }), headers: {} })
      .mockResolvedValueOnce({ data: successfulPatch, headers: {} })
      .mockResolvedValueOnce({ data: '', headers: {} })

    const result = await service.add(resource, '**Ship it** <script>alert(1)</script>', {
      id: 'alice-id',
      name: 'Alice'
    })

    expect(result).toMatchObject({ sequence: 4, id: 'comment-000004', authorName: 'Alice' })
    expect(request.mock.calls.map(([config]) => config.method)).toEqual([
      'LOCK',
      'PROPFIND',
      'PROPPATCH',
      'UNLOCK'
    ])
    expect(request.mock.calls[2][0].headers['Lock-Token']).toBe('<token-1>')
    expect(request.mock.calls[2][0].data).toContain('fc:comment-000004')
    expect(request.mock.calls[2][0].data).toContain('fc:count')
    expect(request.mock.calls[2][0].data).toContain('1,2,3,4')
    expect(request.mock.calls[2][0].data).toContain('&lt;script&gt;')
    expect(request.mock.calls[3][0].headers['Lock-Token']).toBe('<token-1>')
  })

  it('allocates from the high-water count even when most slots were deleted', async () => {
    // count (all-time high-water) is 5 but only slot 2 is still live: the next
    // sequence must be 6 and add() must not lock out just because count is high.
    request
      .mockResolvedValueOnce({ data: '<lock/>', headers: { 'lock-token': '<token-hw>' } })
      .mockResolvedValueOnce({ data: multistatus({ count: '5', index: '2' }), headers: {} })
      .mockResolvedValueOnce({ data: multistatus({ count: '6' }), headers: {} })
      .mockResolvedValueOnce({ data: '', headers: {} })

    const result = await service.add(resource, 'Reopened', { id: 'alice-id', name: 'Alice' })

    expect(result).toMatchObject({ sequence: 6, id: 'comment-000006' })
    const patch = request.mock.calls[2][0].data
    expect(patch).toContain('fc:comment-000006')
    expect(patch).toContain('2,6')
  })

  it('drops the slot from the index on removal without reusing the sequence', async () => {
    request
      .mockResolvedValueOnce({ data: '<lock/>', headers: { 'lock-token': '<token-rm>' } })
      .mockResolvedValueOnce({ data: multistatus({ index: '1,2,3' }), headers: {} })
      .mockResolvedValueOnce({ data: successfulPatch, headers: {} })
      .mockResolvedValueOnce({ data: '', headers: {} })

    await service.remove(resource, {
      id: 'comment-000002',
      sequence: 2,
      version: 1,
      authorId: 'alice-id',
      authorName: 'Alice',
      createdAt: '2026-06-17T12:00:00.000Z',
      body: 'Comment'
    })

    expect(request.mock.calls.map(([config]) => config.method)).toEqual([
      'LOCK',
      'PROPFIND',
      'PROPPATCH',
      'UNLOCK'
    ])
    const patch = request.mock.calls[2][0].data
    expect(patch).toContain('d:remove')
    expect(patch).toContain('fc:comment-000002')
    expect(patch).toContain('1,3')
    // count is never touched, so the freed sequence number is not reused
    expect(patch).not.toContain('fc:count')
  })

  it('unlocks even when an update fails', async () => {
    request
      .mockResolvedValueOnce({ data: '<lock/>', headers: { 'lock-token': '<token-2>' } })
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValueOnce({ data: '', headers: {} })

    await expect(
      service.update(
        resource,
        {
          id: 'comment-000001',
          sequence: 1,
          version: 1,
          authorId: 'alice-id',
          authorName: 'Alice',
          createdAt: '2026-06-17T12:00:00.000Z',
          body: 'Before'
        },
        'After'
      )
    ).rejects.toThrow('write failed')

    expect(request.mock.calls[2][0].method).toBe('UNLOCK')
  })

  it('reports a rejected PROPPATCH response', async () => {
    request
      .mockResolvedValueOnce({ data: '<lock/>', headers: { 'lock-token': '<token-3>' } })
      .mockResolvedValueOnce({ data: multistatus({ index: '1' }), headers: {} })
      .mockResolvedValueOnce({
        data: multistatus({ 'comment-000001': '' }, 'HTTP/1.1 403 Forbidden'),
        headers: {}
      })
      .mockResolvedValueOnce({ data: '', headers: {} })

    await expect(
      service.remove(resource, {
        id: 'comment-000001',
        sequence: 1,
        version: 1,
        authorId: 'alice-id',
        authorName: 'Alice',
        createdAt: '2026-06-17T12:00:00.000Z',
        body: 'Comment'
      })
    ).rejects.toThrow('rejected')
  })

  it('retries the lock when the resource is briefly locked, then succeeds', async () => {
    request
      .mockRejectedValueOnce(new Error('423 Locked'))
      .mockResolvedValueOnce({ data: '<lock/>', headers: { 'lock-token': '<token-r>' } })
      .mockResolvedValueOnce({ data: multistatus({ count: '0' }), headers: {} })
      .mockResolvedValueOnce({ data: successfulPatch, headers: {} })
      .mockResolvedValueOnce({ data: '', headers: {} })

    const result = await service.add(resource, 'Hello', { id: 'alice-id', name: 'Alice' })

    expect(result).toMatchObject({ sequence: 1, id: 'comment-000001' })
    expect(request.mock.calls.map(([config]) => config.method)).toEqual([
      'LOCK',
      'LOCK',
      'PROPFIND',
      'PROPPATCH',
      'UNLOCK'
    ])
  })

  it('gives up after exhausting the lock attempts', async () => {
    request.mockRejectedValue(new Error('423 Locked'))

    await expect(
      service.add(resource, 'Hello', { id: 'alice-id', name: 'Alice' })
    ).rejects.toThrow('423 Locked')

    expect(request.mock.calls.filter(([config]) => config.method === 'LOCK')).toHaveLength(3)
  })

  it('still resolves when releasing the lock fails', async () => {
    request
      .mockResolvedValueOnce({ data: '<lock/>', headers: { 'lock-token': '<token-u>' } })
      .mockResolvedValueOnce({ data: multistatus({ count: '0' }), headers: {} })
      .mockResolvedValueOnce({ data: successfulPatch, headers: {} })
      .mockRejectedValueOnce(new Error('unlock failed'))

    const result = await service.add(resource, 'Hello', { id: 'alice-id', name: 'Alice' })

    expect(result).toMatchObject({ sequence: 1 })
    expect(request.mock.calls[3][0].method).toBe('UNLOCK')
  })
})
