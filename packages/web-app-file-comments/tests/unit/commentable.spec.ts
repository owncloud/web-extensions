import { describe, expect, it } from 'vitest'
import type { Resource } from '@ownclouders/web-client'
import { DavPermission } from '@ownclouders/web-client/webdav'
import { isCommentableResource } from '../../src/utils/commentable'

const resource = (permissions?: string) => ({ permissions }) as Resource

describe('isCommentableResource', () => {
  it('allows a file with the file-update permission', () => {
    expect(isCommentableResource(resource(`RD${DavPermission.FileUpdateable}`))).toBe(true)
  })

  it('allows a folder with the update permission', () => {
    expect(isCommentableResource(resource(`RD${DavPermission.Updateable}CK`))).toBe(true)
  })

  it('hides comments for read-only resources', () => {
    expect(isCommentableResource(resource('R'))).toBe(false)
  })

  it('hides comments when permissions are missing', () => {
    expect(isCommentableResource(resource(undefined))).toBe(false)
    expect(isCommentableResource(null)).toBe(false)
  })
})
