import { describe, expect, it } from 'vitest'
import { parseComment, serializeComment } from '../../src/services/commentFormat'

describe('comment format', () => {
  it('round-trips Markdown and YAML metadata', () => {
    const value = serializeComment(
      {
        version: 1,
        authorId: 'alice-id',
        authorName: 'Alice Example',
        createdAt: '2026-06-17T12:00:00.000Z'
      },
      '**Hello**\n\n---\nStill part of the comment.'
    )

    expect(parseComment(value, 7)).toEqual({
      id: 'comment-000007',
      sequence: 7,
      version: 1,
      authorId: 'alice-id',
      authorName: 'Alice Example',
      createdAt: '2026-06-17T12:00:00.000Z',
      updatedAt: undefined,
      body: '**Hello**\n\n---\nStill part of the comment.'
    })
  })

  it('rejects a body without valid front matter', () => {
    expect(() => parseComment('Just Markdown', 1)).toThrow('metadata is missing')
  })
})
