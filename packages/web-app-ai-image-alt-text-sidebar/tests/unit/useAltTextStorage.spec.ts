import { describe, it, expect, vi } from 'vitest'
import { defaultComponentMocks, getComposableWrapper } from '@ownclouders/web-test-helpers'

vi.mock('@ownclouders/web-pkg', async () => {
  const actual = await vi.importActual<typeof import('@ownclouders/web-pkg')>('@ownclouders/web-pkg')
  return { ...actual }
})

import { useAltTextStorage } from '../../src/composables/useAltTextStorage'

const BASE_RESOURCE = {
  id: 'file-1',
  name: 'photo.jpg',
  webDavPath: '/dav/spaces/space-1/photo.jpg'
} as any

function propfindResponse(text: string | null): string {
  if (!text) {
    return `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:status>HTTP/1.1 404 Not Found</d:status><d:prop></d:prop></d:propstat></d:response></d:multistatus>`
  }
  return `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:at="urn:oc:ai:alt-text"><d:response><d:propstat><d:status>HTTP/1.1 200 OK</d:status><d:prop><at:text>${text}</at:text></d:prop></d:propstat></d:response></d:multistatus>`
}

function proppatchResponse(): string {
  return `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`
}

function getWrapper(setup: (result: ReturnType<typeof useAltTextStorage>) => void, httpResponse: string) {
  const mocks = { ...defaultComponentMocks() }
  mocks.$clientService.httpAuthenticated.request = vi.fn().mockResolvedValue({
    data: httpResponse,
    headers: {}
  }) as any
  return getComposableWrapper(() => {
    const instance = useAltTextStorage()
    setup(instance)
  }, { mocks, provide: mocks })
}

describe('useAltTextStorage', () => {
  describe('loadStoredText', () => {
    it('returns the stored text when property exists', async () => {
      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.loadStoredText(BASE_RESOURCE).then(() => {
            expect(instance.storedText.value).toBe('A photo of a sunset over mountains.')
            resolve()
          })
        }, propfindResponse('A photo of a sunset over mountains.'))
      })
    })

    it('returns null when property is missing (404 propstat)', async () => {
      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.loadStoredText(BASE_RESOURCE).then(() => {
            expect(instance.storedText.value).toBeNull()
            resolve()
          })
        }, propfindResponse(null))
      })
    })
  })

  describe('saveText', () => {
    it('sets storedText after successful save', async () => {
      await new Promise<void>((resolve) => {
        getWrapper((instance) => {
          instance.saveText(BASE_RESOURCE, 'Mountains at dusk.').then(() => {
            expect(instance.storedText.value).toBe('Mountains at dusk.')
            resolve()
          })
        }, proppatchResponse())
      })
    })

    it('sets saveError when PROPPATCH fails', async () => {
      const mocks = { ...defaultComponentMocks() }
      mocks.$clientService.httpAuthenticated.request = vi.fn().mockRejectedValue(new Error('Network error')) as any
      await new Promise<void>((resolve) => {
        getComposableWrapper(() => {
          const instance = useAltTextStorage()
          instance.saveText(BASE_RESOURCE, 'text').then(() => {
            expect(instance.saveError.value).not.toBeNull()
            resolve()
          })
        }, { mocks, provide: mocks })
      })
    })
  })
})
