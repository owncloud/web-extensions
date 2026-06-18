import { describe, expect, it, vi } from 'vitest'
import type { Resource } from '@ownclouders/web-client'
import { isCommentableResource } from '../../src/utils/commentable'

const resource = (overrides: Partial<Resource> = {}) =>
  ({
    isFolder: false,
    canEditTags: vi.fn(() => true),
    ...overrides
  }) as Resource

describe('isCommentableResource', () => {
  it('allows a writable file', () => {
    expect(isCommentableResource(resource())).toBe(true)
  })

  it('allows a writable folder', () => {
    expect(isCommentableResource(resource({ isFolder: true }))).toBe(true)
  })

  it('hides comments for read-only resources', () => {
    expect(isCommentableResource(resource({ canEditTags: vi.fn(() => false) }))).toBe(false)
  })
})
