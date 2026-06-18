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
    service = new FileCommentsService({ request } as DavHttpClient)
  })

  it('loads allocated properties, skips deleted slots and parses comments', async () => {
    request
      .mockResolvedValueOnce({ data: multistatus({ count: '2' }), headers: {} })
      .mockResolvedValueOnce({
        data: multistatus({
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

    expect(request.mock.calls[1][0].data).toContain('fc:comment-000001')
    expect(request.mock.calls[1][0].data).toContain('fc:comment-000002')
    expect(request.mock.calls[1][0].url).toBe('/dav/spaces/space-id/report.txt')
  })

  it('locks, allocates the latest sequence and unlocks when adding', async () => {
    request
      .mockResolvedValueOnce({ data: '<lock/>', headers: { 'lock-token': '<token-1>' } })
      .mockResolvedValueOnce({ data: multistatus({ count: '3' }), headers: {} })
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
    expect(request.mock.calls[2][0].data).toContain('&lt;script&gt;')
    expect(request.mock.calls[3][0].headers['Lock-Token']).toBe('<token-1>')
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
})
