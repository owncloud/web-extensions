import type { SpaceResource } from '@ownclouders/web-client'

export const FAVORITES_FOLDER_PATH = '/.favorites'

const PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:allprop />
</d:propfind>`

type RequestMethod = 'DELETE' | 'GET' | 'MKCOL' | 'PROPFIND' | 'PUT'

interface HttpRequestConfig {
  method: RequestMethod
  url: string
  headers?: Record<string, string>
  data?: string
}

interface HttpResponse<TData = unknown> {
  status?: number
  data?: TData
}

export interface FavoriteResource {
  id?: string
  fileId?: string
  name?: string
  path?: string
  driveAlias?: string
  isFolder?: boolean
}

export interface FavoriteEntry {
  id: string
  filename: string
  internalLink: string
}

type FavoritesServiceErrorCode =
  | 'favorites_folder_missing'
  | 'favorites_folder_create_failed'
  | 'permission_denied'
  | 'resource_not_supported'
  | 'favorites_file_write_failed'
  | 'favorites_file_remove_failed'

export class FavoritesServiceError extends Error {
  public readonly code: FavoritesServiceErrorCode

  constructor(message: string, code: FavoritesServiceErrorCode, options?: ErrorOptions) {
    super(message, options)
    this.name = 'FavoritesServiceError'
    this.code = code
  }
}

interface FavoritesServiceDependencies {
  request: (config: HttpRequestConfig) => Promise<HttpResponse>
  getServerUrl: () => string
  getSpaces: () => SpaceResource[]
}

export interface FavoritesService {
  ensureFavoritesFolder: () => Promise<void>
  buildFavoriteFileName: (resource: FavoriteResource) => string
  buildInternalLink: (resource: FavoriteResource) => string
  isFavorite: (resource: FavoriteResource) => Promise<boolean>
  addFavorite: (resource: FavoriteResource) => Promise<void>
  removeFavorite: (resource: FavoriteResource) => Promise<void>
  removeFavoriteByFilename: (filename: string) => Promise<void>
  listFavorites: () => Promise<FavoriteEntry[]>
}

const getResponseStatus = (error: unknown): number | null => {
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as { response?: { status?: unknown } }).response?.status
    if (typeof status === 'number') {
      return status
    }
  }
  return null
}

const asError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error
  }
  return new Error(String(error))
}

const trimSlashes = (value: string): string => value.replace(/^\/+/, '').replace(/\/+$/, '')

const normalizePath = (value: string): string => {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  const normalized = withLeadingSlash.replace(/\/{2,}/g, '/')
  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1)
  }
  return normalized
}

const encodePath = (value: string): string =>
  value
    .split('/')
    .map((segment, index) => (index === 0 ? segment : encodeURIComponent(segment)))
    .join('/')

const toText = (data: unknown): string => {
  if (typeof data === 'string') {
    return data
  }
  if (data instanceof Document) {
    return new XMLSerializer().serializeToString(data)
  }
  return ''
}

const extractNameFromPath = (path: string): string => {
  const segments = path.split('/').filter(Boolean)
  return segments[segments.length - 1] || 'favorite'
}

const slugify = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (slug.length === 0) {
    return 'favorite'
  }

  return slug.slice(0, 48)
}

const hashString = (value: string): string => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(36)
}

const sanitizeFavoriteFilename = (filename: string): string =>
  filename.replace(/[\\/]+/g, '').trim()

export const serializeInternetShortcut = (internalLink: string): string =>
  `[InternetShortcut]
URL=${internalLink}
`

export const parseInternetShortcut = (content: string): string | null => {
  const lines = content.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.toUpperCase().startsWith('URL=')) {
      const url = trimmed.slice(4).trim()
      return url.length > 0 ? url : null
    }
  }

  return null
}

export const buildInternalLink = (resource: FavoriteResource): string => {
  const rawDriveAlias = resource.driveAlias?.trim() || ''
  if (!rawDriveAlias) {
    throw new FavoritesServiceError(
      'Favorites are not supported for this resource',
      'resource_not_supported'
    )
  }

  const driveAlias = trimSlashes(rawDriveAlias)
  const fallbackPath = !resource.isFolder && resource.name ? `/${resource.name}` : '/'
  const resourcePath = normalizePath(resource.path || fallbackPath)
  const driveAliasAndItem = resourcePath === '/' ? driveAlias : `${driveAlias}${resourcePath}`

  const query = !resource.isFolder && (resource.fileId || resource.id)
    ? `?fileId=${encodeURIComponent(resource.fileId || resource.id || '')}`
    : ''

  return `/files/${encodePath(driveAliasAndItem)}${query}`
}

export const buildFavoriteFileName = (resource: FavoriteResource): string => {
  const nameCandidate = resource.name || extractNameFromPath(resource.path || '')
  const slug = slugify(nameCandidate)
  const uniqueKey = buildInternalLink(resource)
  return `${slug}-${hashString(uniqueKey)}.url`
}

export const displayNameFromFavoriteFileName = (filename: string): string =>
  filename
    .replace(/\.url$/i, '')
    .replace(/-[a-z0-9]+$/i, '')
    .replace(/-/g, ' ')
    .trim() || filename

export const isPermissionDeniedError = (error: unknown): boolean => {
  if (error instanceof FavoritesServiceError) {
    return error.code === 'permission_denied'
  }
  return getResponseStatus(error) === 403
}

export const createFavoritesService = (
  dependencies: FavoritesServiceDependencies
): FavoritesService => {
  const getPersonalSpace = (): SpaceResource => {
    const spaces = dependencies.getSpaces() || []
    const personal = spaces.find((space) => space.driveType === 'personal') || spaces[0]

    if (!personal) {
      throw new FavoritesServiceError(
        'Favorites folder is missing',
        'favorites_folder_missing'
      )
    }

    return personal
  }

  const buildDavUrl = (spaceId: string, path: string): string => {
    const serverUrl = dependencies.getServerUrl().replace(/\/$/, '')
    const normalizedPath = normalizePath(path)
    const encodedPath = encodePath(normalizedPath)
    return `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}${encodedPath}`
  }

  const runPropfind = async (url: string, depth: 0 | 1): Promise<HttpResponse> =>
    dependencies.request({
      method: 'PROPFIND',
      url,
      headers: {
        Depth: `${depth}`,
        'Content-Type': 'application/xml'
      },
      data: PROPFIND_BODY
    })

  const pathExists = async (url: string): Promise<boolean> => {
    try {
      await runPropfind(url, 0)
      return true
    } catch (error) {
      if (getResponseStatus(error) === 404) {
        return false
      }
      throw error
    }
  }

  const ensureFavoritesFolder = async (): Promise<void> => {
    const personalSpace = getPersonalSpace()
    const folderUrl = buildDavUrl(personalSpace.id, FAVORITES_FOLDER_PATH)

    try {
      const exists = await pathExists(folderUrl)
      if (exists) {
        return
      }
    } catch (error) {
      if (getResponseStatus(error) === 403) {
        throw new FavoritesServiceError(
          'Permission denied while accessing favorites',
          'permission_denied',
          { cause: asError(error) }
        )
      }
      throw error
    }

    try {
      await dependencies.request({
        method: 'MKCOL',
        url: folderUrl
      })
    } catch (error) {
      const status = getResponseStatus(error)
      if (status === 405) {
        return
      }
      if (status === 403) {
        throw new FavoritesServiceError(
          'Permission denied while accessing favorites',
          'permission_denied',
          { cause: asError(error) }
        )
      }
      throw new FavoritesServiceError(
        'Could not create favorites folder',
        'favorites_folder_create_failed',
        { cause: asError(error) }
      )
    }
  }

  const getFavoriteFileUrl = (resource: FavoriteResource): string => {
    const personalSpace = getPersonalSpace()
    const fileName = buildFavoriteFileName(resource)
    return buildDavUrl(personalSpace.id, `${FAVORITES_FOLDER_PATH}/${fileName}`)
  }

  const getFavoriteFileUrlByName = (filename: string): string => {
    const personalSpace = getPersonalSpace()
    const sanitizedFilename = sanitizeFavoriteFilename(filename)
    return buildDavUrl(personalSpace.id, `${FAVORITES_FOLDER_PATH}/${sanitizedFilename}`)
  }

  const isFavorite = async (resource: FavoriteResource): Promise<boolean> => {
    await ensureFavoritesFolder()
    const fileUrl = getFavoriteFileUrl(resource)
    return pathExists(fileUrl)
  }

  const addFavorite = async (resource: FavoriteResource): Promise<void> => {
    await ensureFavoritesFolder()
    const fileUrl = getFavoriteFileUrl(resource)

    if (await pathExists(fileUrl)) {
      return
    }

    try {
      await dependencies.request({
        method: 'PUT',
        url: fileUrl,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        },
        data: serializeInternetShortcut(buildInternalLink(resource))
      })
    } catch (error) {
      const status = getResponseStatus(error)
      if (status === 403) {
        throw new FavoritesServiceError(
          'Permission denied while accessing favorites',
          'permission_denied',
          { cause: asError(error) }
        )
      }
      throw new FavoritesServiceError(
        'Could not create favorite link file',
        'favorites_file_write_failed',
        { cause: asError(error) }
      )
    }
  }

  const removeFavoriteByFilename = async (filename: string): Promise<void> => {
    await ensureFavoritesFolder()
    const sanitizedFilename = sanitizeFavoriteFilename(filename)
    if (!sanitizedFilename || !sanitizedFilename.toLowerCase().endsWith('.url')) {
      return
    }

    const fileUrl = getFavoriteFileUrlByName(sanitizedFilename)

    if (!(await pathExists(fileUrl))) {
      return
    }

    try {
      await dependencies.request({
        method: 'DELETE',
        url: fileUrl
      })
    } catch (error) {
      const status = getResponseStatus(error)
      if (status === 404) {
        return
      }
      if (status === 403) {
        throw new FavoritesServiceError(
          'Permission denied while accessing favorites',
          'permission_denied',
          { cause: asError(error) }
        )
      }
      throw new FavoritesServiceError(
        'Could not remove favorite link file',
        'favorites_file_remove_failed',
        { cause: asError(error) }
      )
    }
  }

  const removeFavorite = async (resource: FavoriteResource): Promise<void> => {
    const fileName = buildFavoriteFileName(resource)
    await removeFavoriteByFilename(fileName)
  }

  const parseFavoriteFileNamesFromPropfind = (content: string): string[] => {
    const document = new DOMParser().parseFromString(content, 'application/xml')
    const responses = Array.from(document.getElementsByTagNameNS('DAV:', 'response'))
    const fileNames = new Set<string>()

    for (const response of responses) {
      const href = response.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent?.trim()
      if (!href) {
        continue
      }

      const decodedHref = decodeURIComponent(href)
      const normalizedHref = decodedHref.endsWith('/') ? decodedHref.slice(0, -1) : decodedHref

      if (normalizedHref.endsWith(FAVORITES_FOLDER_PATH)) {
        continue
      }

      const name = normalizedHref.split('/').filter(Boolean).pop()
      if (name && name.toLowerCase().endsWith('.url')) {
        fileNames.add(name)
      }
    }

    return [...fileNames]
  }

  const listFavorites = async (): Promise<FavoriteEntry[]> => {
    await ensureFavoritesFolder()

    const personalSpace = getPersonalSpace()
    const folderUrl = buildDavUrl(personalSpace.id, FAVORITES_FOLDER_PATH)
    const listResponse = await runPropfind(folderUrl, 1)
    const fileNames = parseFavoriteFileNamesFromPropfind(toText(listResponse.data))

    const entries: FavoriteEntry[] = []

    for (const fileName of fileNames) {
      const fileUrl = buildDavUrl(personalSpace.id, `${FAVORITES_FOLDER_PATH}/${fileName}`)
      try {
        const { data } = await dependencies.request({
          method: 'GET',
          url: fileUrl
        })
        const internalLink = parseInternetShortcut(toText(data))
        if (!internalLink) {
          continue
        }

        entries.push({
          id: fileName,
          filename: fileName,
          internalLink
        })
      } catch (error) {
        if (getResponseStatus(error) === 404) {
          continue
        }
        throw error
      }
    }

    return entries.sort((first, second) => first.filename.localeCompare(second.filename))
  }

  return {
    ensureFavoritesFolder,
    buildFavoriteFileName,
    buildInternalLink,
    isFavorite,
    addFavorite,
    removeFavorite,
    removeFavoriteByFilename,
    listFavorites
  }
}
