<template>
  <section class="favorites-sidebar-panel">
    <h4 class="favorites-sidebar-panel-title">
      {{ $gettext('Favorites') }}
    </h4>

    <button
      type="button"
      class="favorites-sidebar-panel-button"
      :disabled="isActionDisabled"
      :title="disabledReason || ''"
      @click="toggleFavorite"
    >
      {{ actionLabel }}
    </button>

    <p v-if="disabledReason" class="favorites-sidebar-panel-message">
      {{ disabledReason }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { useMessages, useUserStore } from '@ownclouders/web-pkg'
import { computed, ref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useFavoritesService } from '../composables/useFavoritesService'
import { notifyFavoritesChanged } from '../services/favoritesEvents'
import {
  type FavoriteResource,
  FavoritesServiceError,
  buildInternalLink,
  isPermissionDeniedError
} from '../services/favoritesService'

interface Props {
  items?: FavoriteResource[]
}

type SidebarFavoriteResource = FavoriteResource & {
  canDownload?: (options: { user: unknown }) => boolean
  permissions?: string
}

const props = defineProps<Props>()

const favoritesService = useFavoritesService()
const { showErrorMessage } = useMessages()
const { $gettext } = useGettext()
const userStore = useUserStore()

const isFavoriteState = ref(false)
const loading = ref(false)
const checking = ref(false)
const folderError = ref('')

const selectedResource = computed<FavoriteResource | null>(() => {
  return props.items?.length === 1 ? props.items[0] : null
})

const hasResourcePermission = computed(() => {
  const resource = selectedResource.value as SidebarFavoriteResource | null

  if (!resource) {
    return false
  }

  if (typeof resource.permissions === 'string' && resource.permissions.length > 0) {
    if (!resource.permissions.includes('R')) {
      return false
    }
  }

  if (typeof resource.canDownload === 'function') {
    try {
      return Boolean(resource.canDownload({ user: userStore.user }))
    } catch {
      return false
    }
  }

  return true
})

const supportsInternalLink = computed(() => {
  if (!selectedResource.value) {
    return false
  }

  try {
    buildInternalLink(selectedResource.value)
    return true
  } catch {
    return false
  }
})

const disabledReason = computed(() => {
  if (folderError.value) {
    return folderError.value
  }
  if (!selectedResource.value) {
    return $gettext('Select a single resource to favorite')
  }
  if (!hasResourcePermission.value) {
    return $gettext('Permission denied while accessing favorites')
  }
  if (!supportsInternalLink.value) {
    return $gettext('Favorites are not supported for this resource')
  }
  return ''
})

const isActionDisabled = computed(() => {
  return loading.value || checking.value || disabledReason.value.length > 0
})

const actionLabel = computed(() => {
  return isFavoriteState.value
    ? $gettext('Remove from favorites')
    : $gettext('Add to favorites')
})

const mapErrorMessage = (error: unknown): string => {
  if (error instanceof FavoritesServiceError) {
    if (error.code === 'favorites_folder_missing') {
      return $gettext('Favorites folder is missing')
    }
    if (error.code === 'favorites_folder_create_failed') {
      return $gettext('Could not create favorites folder')
    }
    if (error.code === 'permission_denied') {
      return $gettext('Permission denied while accessing favorites')
    }
  }

  if (isPermissionDeniedError(error)) {
    return $gettext('Permission denied while accessing favorites')
  }

  return $gettext('Could not create favorites folder')
}

const updateFavoriteState = async (showToast = false): Promise<void> => {
  if (!selectedResource.value || !hasResourcePermission.value || !supportsInternalLink.value) {
    isFavoriteState.value = false
    folderError.value = ''
    return
  }

  checking.value = true

  try {
    folderError.value = ''
    isFavoriteState.value = await favoritesService.isFavorite(selectedResource.value)
  } catch (error) {
    folderError.value = mapErrorMessage(error)
    isFavoriteState.value = false

    if (showToast) {
      showErrorMessage({
        title: $gettext('Favorites'),
        errors: [error instanceof Error ? error : new Error(folderError.value)]
      })
    }
  } finally {
    checking.value = false
  }
}

const toggleFavorite = async (): Promise<void> => {
  if (!selectedResource.value || isActionDisabled.value) {
    return
  }

  loading.value = true

  try {
    if (isFavoriteState.value) {
      await favoritesService.removeFavorite(selectedResource.value)
    } else {
      await favoritesService.addFavorite(selectedResource.value)
    }

    notifyFavoritesChanged()
    await updateFavoriteState(false)
  } catch (error) {
    folderError.value = mapErrorMessage(error)
    showErrorMessage({
      title: $gettext('Favorites'),
      errors: [error instanceof Error ? error : new Error(folderError.value)]
    })
  } finally {
    loading.value = false
  }
}

watch(
  selectedResource,
  () => {
    void updateFavoriteState(false)
  },
  { immediate: true }
)
</script>

<style scoped>
.favorites-sidebar-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.5rem;
}

.favorites-sidebar-panel-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
}

.favorites-sidebar-panel-button {
  width: fit-content;
  border: 1px solid var(--oc-color-border, #d1d1d1);
  border-radius: 0.35rem;
  background: var(--oc-color-background-default, #fff);
  color: var(--oc-color-text-default, #222);
  padding: 0.4rem 0.7rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.favorites-sidebar-panel-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.favorites-sidebar-panel-message {
  margin: 0;
  color: var(--oc-color-text-muted, #6f6f6f);
  font-size: 0.75rem;
  line-height: 1.3;
}
</style>
