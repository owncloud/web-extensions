import { ref } from 'vue'

const favoritesRevision = ref(0)

export const useFavoritesRevision = () => favoritesRevision

export const notifyFavoritesChanged = () => {
  favoritesRevision.value += 1
}
