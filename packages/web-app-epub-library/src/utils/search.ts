import type { Resource, SpaceResource } from '@ownclouders/web-client'

function propertyValue(response: Element, localName: string): string {
  return (
    [...response.querySelectorAll('*')]
      .find(
        (element) =>
          element.localName === localName || element.tagName.split(':').pop() === localName
      )
      ?.textContent?.trim() ?? ''
  )
}

export function parseEpubSearchResponse(xmlText: string, space: SpaceResource): Resource[] {
  const document = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (document.querySelector('parsererror')) throw new Error('Invalid WebDAV search response')

  const spacePathPrefix = `/dav/spaces/${space.id}`
  const responses = [...document.querySelectorAll('*')].filter(
    (element) => element.localName === 'response' || element.tagName.split(':').pop() === 'response'
  )

  return responses
    .map((response): Resource | null => {
      const href = propertyValue(response, 'href')
      const name = propertyValue(response, 'displayname')
      if (!href || !name.toLowerCase().endsWith('.epub')) return null

      const fileId = propertyValue(response, 'fileid')
      const decodedHref = decodeURIComponent(href)
      const path = decodedHref.startsWith(spacePathPrefix)
        ? decodedHref.slice(spacePathPrefix.length)
        : decodedHref

      return {
        id: fileId || `${space.id}!${path}`,
        fileId,
        name,
        path,
        webDavPath: href,
        mimeType: 'application/epub+zip',
        size: Number.parseInt(propertyValue(response, 'getcontentlength'), 10) || 0,
        mdate: propertyValue(response, 'getlastmodified'),
        type: 'file',
        isFolder: false,
        etag: '',
        permissions: '',
        starred: false,
        spaceId: space.id,
        storageId: space.id,
        driveAlias: space.driveAlias
      } as Resource
    })
    .filter((resource): resource is Resource => Boolean(resource))
}
