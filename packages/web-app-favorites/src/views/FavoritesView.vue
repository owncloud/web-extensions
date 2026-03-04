<template>
  <main class="favorites-view">
    <h1 class="favorites-view-title">{{ $gettext('Favorites') }}</h1>

    <p v-if="isLoading" class="favorites-view-state">{{ $gettext('Loading favorites...') }}</p>
    <p v-else-if="entries.length === 0" class="favorites-view-state">{{ $gettext('No favorites yet') }}</p>

    <ul v-else class="favorites-view-list">
      <li v-for="entry in entries" :key="entry.id" class="favorites-view-item">
        <button type="button" class="favorites-view-link" @click="openFavorite(entry)">
          {{ entryLabel(entry.filename) }}
        </button>
        <button
          type="button"
          class="favorites-view-remove"
          :disabled="isRemoving"
          @click="removeFavorite(entry)"
        >
          {{ $gettext('Remove') }}
        </button>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
import { useMessages } from '@ownclouders/web-pkg'
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGettext } from 'vue3-gettext'
import { useFavoritesService } from '../composables/useFavoritesService'
import { notifyFavoritesChanged, useFavoritesRevision } from '../services/favoritesEvents'
import {
  type FavoriteEntry,
  displayNameFromFavoriteFileName
} from '../services/favoritesService'

const favoritesService = useFavoritesService()
const router = useRouter()
const { showErrorMessage } = useMessages()
const { $gettext } = useGettext()
const favoritesRevision = useFavoritesRevision()

const isLoading = ref(false)
const isRemoving = ref(false)
const entries = ref<FavoriteEntry[]>([])

const loadFavorites = async (): Promise<void> => {
  isLoading.value = true
  try {
    entries.value = await favoritesService.listFavorites()
  } catch (error) {
    showErrorMessage({
      title: $gettext('Favorites'),
      errors: [error instanceof Error ? error : new Error($gettext('Could not create favorites folder'))]
    })
    entries.value = []
  } finally {
    isLoading.value = false
  }
}

const openFavorite = async (entry: FavoriteEntry): Promise<void> => {
  try {
    await router.push(entry.internalLink)
  } catch (error) {
    showErrorMessage({
      title: $gettext('Favorites'),
      errors: [error instanceof Error ? error : new Error($gettext('Could not open favorite'))]
    })
  }
}

const removeFavorite = async (entry: FavoriteEntry): Promise<void> => {
  isRemoving.value = true
  try {
    await favoritesService.removeFavoriteByFilename(entry.filename)
    notifyFavoritesChanged()
  } catch (error) {
    showErrorMessage({
      title: $gettext('Favorites'),
      errors: [error instanceof Error ? error : new Error($gettext('Could not remove favorite'))]
    })
  } finally {
    isRemoving.value = false
  }
}

const entryLabel = (filename: string): string => displayNameFromFavoriteFileName(filename)

watch(favoritesRevision, () => {
  void loadFavorites()
})

onMounted(() => {
  void loadFavorites()
})
</script>

<style scoped>
.favorites-view {
  width: 100%;
  max-width: 52rem;
  margin: 0 auto;
  padding: 1.2rem;
  color: var(--oc-color-text-default, #1b1b1b);
}

.favorites-view-title {
  margin: 0 0 1rem;
  font-size: 1.25rem;
  font-weight: 600;
}

.favorites-view-state {
  margin: 0.8rem 0;
  color: var(--oc-color-text-muted, #6f6f6f);
}

.favorites-view-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.favorites-view-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem;
  border: 1px solid var(--oc-color-border, #dddddd);
  border-radius: 0.5rem;
  background: var(--oc-color-background-muted, #fafafa);
}

.favorites-view-link {
  border: none;
  padding: 0;
  background: transparent;
  color: var(--oc-color-swatch-primary-default, #0066cc);
  font-size: 0.95rem;
  text-align: left;
  cursor: pointer;
}

.favorites-view-remove {
  border: 1px solid var(--oc-color-border, #d1d1d1);
  border-radius: 0.3rem;
  background: var(--oc-color-background-default, #fff);
  color: var(--oc-color-text-default, #1b1b1b);
  padding: 0.35rem 0.6rem;
  font-size: 0.825rem;
  cursor: pointer;
}

.favorites-view-remove:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
