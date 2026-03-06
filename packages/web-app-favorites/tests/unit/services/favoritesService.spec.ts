import type { SpaceResource } from '@ownclouders/web-client'
import {
  FAVORITES_FOLDER_PATH,
  type FavoriteResource,
  buildFavoriteFileName,
  createFavoritesService,
  parseInternetShortcut,
  serializeInternetShortcut
} from '../../../src/services/favoritesService'

type RequestConfig = {
  method: 'DELETE' | 'GET' | 'MKCOL' | 'PROPFIND' | 'PUT'
  url: string
  headers?: Record<string, string>
  data?: string
}

type InMemoryDavState = {
  deleteCalls: number
  files: Map<string, string>
  folderExists: boolean
  putCalls: number
}

const personalSpace = {
  id: 'personal-space-id',
  driveType: 'personal'
} as SpaceResource

const favoriteResource: FavoriteResource = {
  id: 'resource-1',
  fileId: 'resource-1',
  name: 'Quarterly Report.pdf',
  driveAlias: 'personal/home',
  path: '/Reports/Quarterly Report.pdf',
  isFolder: false
}

const createHttpError = (status: number): Error => {
  const error = new Error(`Request failed (${status})`) as Error & {
    response: { status: number }
  }
  error.response = { status }
  return error
}

const createPropfindResponse = (hrefs: string[]): string => {
  return `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
${hrefs
  .map((href) => `  <d:response><d:href>${href}</d:href></d:response>`)
  .join('\n')}
</d:multistatus>`
}

const createServiceWithInMemoryDav = () => {
  const state: InMemoryDavState = {
    deleteCalls: 0,
    files: new Map<string, string>(),
    folderExists: false,
    putCalls: 0
  }

  const baseFolderPath = `/dav/spaces/${personalSpace.id}${FAVORITES_FOLDER_PATH}`

  const request = vi.fn(async (config: RequestConfig) => {
    const url = new URL(config.url, 'https://ocis.local')
    const path = decodeURIComponent(url.pathname)
    const isFavoritesFolder = path === baseFolderPath
    const isFavoriteFile = path.startsWith(`${baseFolderPath}/`) && path.toLowerCase().endsWith('.url')
    const filename = isFavoriteFile ? path.slice(path.lastIndexOf('/') + 1) : ''

    if (config.method === 'MKCOL' && isFavoritesFolder) {
      if (state.folderExists) {
        throw createHttpError(405)
      }
      state.folderExists = true
      return { status: 201 }
    }

    if (config.method === 'PROPFIND' && isFavoritesFolder) {
      if (!state.folderExists) {
        throw createHttpError(404)
      }
      if (config.headers?.Depth === '1') {
        const hrefs = [`${baseFolderPath}/`, ...[...state.files.keys()].map((key) => `${baseFolderPath}/${encodeURIComponent(key)}`)]
        return {
          status: 207,
          data: createPropfindResponse(hrefs)
        }
      }
      return { status: 207, data: createPropfindResponse([`${baseFolderPath}/`]) }
    }

    if (config.method === 'PROPFIND' && isFavoriteFile) {
      if (!state.folderExists || !state.files.has(filename)) {
        throw createHttpError(404)
      }
      return {
        status: 207,
        data: createPropfindResponse([`${baseFolderPath}/${encodeURIComponent(filename)}`])
      }
    }

    if (config.method === 'PUT' && isFavoriteFile) {
      if (!state.folderExists) {
        throw createHttpError(409)
      }
      state.putCalls += 1
      state.files.set(filename, config.data || '')
      return { status: 201 }
    }

    if (config.method === 'GET' && isFavoriteFile) {
      if (!state.folderExists || !state.files.has(filename)) {
        throw createHttpError(404)
      }
      return {
        status: 200,
        data: state.files.get(filename) || ''
      }
    }

    if (config.method === 'DELETE' && isFavoriteFile) {
      if (!state.folderExists || !state.files.has(filename)) {
        throw createHttpError(404)
      }
      state.deleteCalls += 1
      state.files.delete(filename)
      return { status: 204 }
    }

    throw createHttpError(500)
  })

  const service = createFavoritesService({
    request,
    getServerUrl: () => 'https://ocis.local',
    getSpaces: () => [personalSpace]
  })

  return { service, state, request }
}

describe('favoritesService', () => {
  it('buildFavoriteFileName is stable for the same resource', () => {
    const first = buildFavoriteFileName(favoriteResource)
    const second = buildFavoriteFileName({ ...favoriteResource })

    expect(first).toEqual(second)
    expect(first.endsWith('.url')).toBeTruthy()
  })

  it('serializes and parses URL file format', () => {
    const link = '/files/personal/home/Reports/Quarterly%20Report.pdf?fileId=resource-1'
    const serialized = serializeInternetShortcut(link)
    const parsed = parseInternetShortcut(serialized)

    expect(serialized).toContain('[InternetShortcut]')
    expect(serialized).toContain(`URL=${link}`)
    expect(parsed).toEqual(link)
  })

  it('add/remove are idempotent', async () => {
    const { service, state } = createServiceWithInMemoryDav()

    await service.addFavorite(favoriteResource)
    await service.addFavorite(favoriteResource)
    expect(state.putCalls).toEqual(1)
    expect(state.files.size).toEqual(1)

    await service.removeFavorite(favoriteResource)
    await service.removeFavorite(favoriteResource)
    expect(state.deleteCalls).toEqual(1)
    expect(state.files.size).toEqual(0)
  })
})
