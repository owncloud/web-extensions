import type { SpaceResource } from '@ownclouders/web-client'
import { describe, expect, it } from 'vitest'
import { parseEpubSearchResponse } from '../../src/utils/search'

describe('parseEpubSearchResponse', () => {
  it('maps EPUB WebDAV results and ignores other files', () => {
    const space = { id: 'space-1', driveAlias: 'personal/alice' } as SpaceResource
    const resources = parseEpubSearchResponse(
      `<?xml version="1.0"?>
      <d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
        <d:response><d:href>/dav/spaces/space-1/Books/Earthsea.epub</d:href><d:propstat><d:prop>
          <d:displayname>Earthsea.epub</d:displayname><d:getcontentlength>4096</d:getcontentlength>
          <d:getlastmodified>Wed, 15 Jul 2026 10:00:00 GMT</d:getlastmodified><oc:fileid>file-1</oc:fileid>
        </d:prop></d:propstat></d:response>
        <d:response><d:href>/dav/spaces/space-1/Books/notes.txt</d:href><d:propstat><d:prop>
          <d:displayname>notes.txt</d:displayname>
        </d:prop></d:propstat></d:response>
      </d:multistatus>`,
      space
    )

    expect(resources).toHaveLength(1)
    expect(resources[0]).toMatchObject({
      fileId: 'file-1',
      name: 'Earthsea.epub',
      path: '/Books/Earthsea.epub',
      size: 4096,
      storageId: 'space-1'
    })
  })
})
