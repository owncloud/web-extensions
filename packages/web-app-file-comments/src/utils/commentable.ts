import type { Resource } from '@ownclouders/web-client'

export const isCommentableResource = (resource?: Resource | null): boolean =>
  resource?.canEditTags?.() === true
