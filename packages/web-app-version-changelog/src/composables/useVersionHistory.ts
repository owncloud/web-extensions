import { ref, type Ref } from 'vue'
import { useClientService } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import type { Resource } from '@ownclouders/web-client'

export type VersionHistoryResource = Resource

export interface UseVersionHistoryResult {
  versions: Ref<VersionHistoryResource[]>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  fetchVersions: (fileId: string) => Promise<void>
}

export function useVersionHistory(): UseVersionHistoryResult {
  const { $gettext } = useGettext()
  const clientService = useClientService()

  const versions = ref<VersionHistoryResource[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchVersions(fileId: string): Promise<void> {
    isLoading.value = true
    error.value = null
    versions.value = []

    try {
      const raw = await clientService.webdav.listFileVersions(fileId)
      versions.value = [...raw].sort((a, b) => {
        const ma = a.mdate ? (new Date(a.mdate).getTime() || 0) : 0
        const mb = b.mdate ? (new Date(b.mdate).getTime() || 0) : 0
        return mb - ma
      })
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('404') || err.message.includes('Not Found')) {
          error.value = $gettext('No version history found for this file.')
        } else if (err.message.includes('401') || err.message.includes('403')) {
          error.value = $gettext('Access denied. Your session may have expired.')
        } else {
          error.value = $gettext('Failed to load version history.')
        }
      } else {
        error.value = $gettext('Failed to load version history.')
      }
    } finally {
      isLoading.value = false
    }
  }

  return { versions, isLoading, error, fetchVersions }
}
