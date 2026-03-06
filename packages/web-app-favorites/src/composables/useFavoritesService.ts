import type { SpaceResource } from '@ownclouders/web-client'
import { useClientService, useConfigStore, useSpacesStore } from '@ownclouders/web-pkg'
import { createFavoritesService } from '../services/favoritesService'

export const useFavoritesService = () => {
  const clientService = useClientService()
  const configStore = useConfigStore()
  const spacesStore = useSpacesStore()

  return createFavoritesService({
    request: (config) => clientService.httpAuthenticated.request(config),
    getServerUrl: () => configStore.serverUrl || '',
    getSpaces: () => spacesStore.spaces as SpaceResource[]
  })
}
