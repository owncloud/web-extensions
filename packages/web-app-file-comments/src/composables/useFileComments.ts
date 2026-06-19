import type { Resource } from '@ownclouders/web-client'
import { useClientService, useUserStore } from '@ownclouders/web-pkg'
import { ref, watch, type Ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import {
  FileCommentsService,
  type DavHttpClient
} from '../services/fileCommentsService'
import type { FileComment } from '../services/commentFormat'

export const useFileComments = (resource: Ref<Resource | null | undefined>) => {
  const { $gettext } = useGettext()
  const clientService = useClientService()
  const userStore = useUserStore()
  const comments = ref<FileComment[]>([])
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<string | null>(null)
  const service = new FileCommentsService(
    clientService.httpAuthenticated as unknown as DavHttpClient
  )

  // Monotonic token so a slow load for a previously selected resource cannot
  // overwrite the thread of the one the user has since switched to.
  let activeLoad = 0

  const load = async () => {
    const token = ++activeLoad
    if (!resource.value) {
      comments.value = []
      error.value = null
      isLoading.value = false
      return
    }

    isLoading.value = true
    error.value = null
    try {
      const result = await service.list(resource.value)
      if (token === activeLoad) {
        comments.value = result
      }
    } catch {
      if (token === activeLoad) {
        error.value = $gettext('Comments could not be loaded.')
      }
    } finally {
      if (token === activeLoad) {
        isLoading.value = false
      }
    }
  }

  const add = async (body: string) => {
    if (!resource.value || !userStore.user) {
      // Throw rather than return silently: a silent no-op would let the caller
      // treat it as success and wipe the user's unsaved text.
      error.value = $gettext('Your session has expired. Please reload the page and try again.')
      throw new Error('No active resource or signed-in user')
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
      error.value ||= $gettext('Your comment could not be saved.')
      throw cause
    } finally {
      isSaving.value = false
    }
  }

  const update = async (comment: FileComment, body: string) => {
    if (!resource.value) {
      error.value = $gettext('This item is no longer open. Please reopen it and try again.')
      throw new Error('No active resource')
    }
    isSaving.value = true
    error.value = null
    try {
      const updated = await service.update(resource.value, comment, body)
      comments.value = comments.value.map((item) => (item.id === updated.id ? updated : item))
    } catch (cause) {
      error.value ||= $gettext('Your changes could not be saved.')
      throw cause
    } finally {
      isSaving.value = false
    }
  }

  const remove = async (comment: FileComment) => {
    if (!resource.value) {
      error.value = $gettext('This item is no longer open. Please reopen it and try again.')
      throw new Error('No active resource')
    }
    isSaving.value = true
    error.value = null
    try {
      await service.remove(resource.value, comment)
      comments.value = comments.value.filter((item) => item.id !== comment.id)
    } catch (cause) {
      error.value ||= $gettext('The comment could not be deleted.')
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
