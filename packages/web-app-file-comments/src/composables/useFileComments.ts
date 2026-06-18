import type { Resource } from '@ownclouders/web-client'
import { useClientService, useUserStore } from '@ownclouders/web-pkg'
import { ref, watch, type Ref } from 'vue'
import {
  FileCommentsService,
  type DavHttpClient
} from '../services/fileCommentsService'
import type { FileComment } from '../services/commentFormat'

export const useFileComments = (resource: Ref<Resource | null | undefined>) => {
  const clientService = useClientService()
  const userStore = useUserStore()
  const comments = ref<FileComment[]>([])
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<string | null>(null)
  const service = new FileCommentsService(
    clientService.httpAuthenticated as unknown as DavHttpClient
  )

  const load = async () => {
    if (!resource.value) {
      comments.value = []
      return
    }

    isLoading.value = true
    error.value = null
    try {
      comments.value = await service.list(resource.value)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      isLoading.value = false
    }
  }

  const add = async (body: string) => {
    if (!resource.value || !userStore.user) {
      return
    }

    isSaving.value = true
    error.value = null
    try {
      const authorId = userStore.user.id || userStore.user.onPremisesSamAccountName
      const comment = await service.add(resource.value, body, {
        id: authorId,
        name: userStore.user.displayName || userStore.user.onPremisesSamAccountName
      })
      comments.value.push(comment)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      throw cause
    } finally {
      isSaving.value = false
    }
  }

  const update = async (comment: FileComment, body: string) => {
    if (!resource.value) {
      return
    }
    isSaving.value = true
    error.value = null
    try {
      const updated = await service.update(resource.value, comment, body)
      comments.value = comments.value.map((item) => (item.id === updated.id ? updated : item))
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      throw cause
    } finally {
      isSaving.value = false
    }
  }

  const remove = async (comment: FileComment) => {
    if (!resource.value) {
      return
    }
    isSaving.value = true
    error.value = null
    try {
      await service.remove(resource.value, comment)
      comments.value = comments.value.filter((item) => item.id !== comment.id)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      throw cause
    } finally {
      isSaving.value = false
    }
  }

  watch(resource, load, { immediate: true })

  return {
    comments,
    isLoading,
    isSaving,
    error,
    currentUserId: () => userStore.user?.id || userStore.user?.onPremisesSamAccountName,
    load,
    add,
    update,
    remove
  }
}
