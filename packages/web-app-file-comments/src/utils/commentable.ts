import type { Resource } from '@ownclouders/web-client'
import { DavPermission } from '@ownclouders/web-client/webdav'

// A resource is commentable when the user may write its DAV properties, i.e. it
// carries the folder- or file-update permission. canEditTags() is intentionally
// avoided: it additionally consults a file-extension exclusion list and is
// hardcoded to false for spaces, neither of which reflects PROPPATCH access.
export const isCommentableResource = (resource?: Resource | null): boolean => {
  const permissions = resource?.permissions
  if (typeof permissions !== 'string') {
    return false
  }
  return (
    permissions.includes(DavPermission.Updateable) ||
    permissions.includes(DavPermission.FileUpdateable)
  )
}
