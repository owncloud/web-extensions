import { ref, type Ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useLLM, type LLMConfig, type LLMStatus } from './useLLM'
import type { RecentFile } from './useRecentFiles'
import { buildClusteringPrompt, type ClusterableFile } from '../utils/clustering-prompt'
import {
  parseStrictCollections,
  parseLenientCollectionLines,
  type CollectionAssignment
} from '../utils/parse-collections'

// Sequential batches, not parallel, to stay within any per-user rate limit the proxy enforces.
export const MAX_FILES_PER_BATCH = 30

// Per-file excerpt length included in the prompt — keeps token usage bounded regardless of how
// much text useRecentFiles managed to fetch for a given file.
export const MAX_EXCERPT_CHARS = 200

export interface Collection {
  label: string
  fileIds: string[]
}

export interface UseCollectionsResult {
  status: Ref<LLMStatus>
  isClustering: Ref<boolean>
  collections: Ref<Collection[]>
  clusterError: Ref<string | null>
  clusterFiles: (files: RecentFile[]) => Promise<void>
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function toClusterableFiles(files: RecentFile[]): ClusterableFile[] {
  return files.map((f) => ({
    fileId: f.fileId,
    name: f.name,
    excerpt: f.excerpt ? f.excerpt.slice(0, MAX_EXCERPT_CHARS) : undefined
  }))
}

function mergeAssignments(target: Map<string, string>, assignments: CollectionAssignment[]): void {
  for (const a of assignments) {
    target.set(a.fileId, a.collection)
  }
}

function toCollections(assignmentsByFileId: Map<string, string>): Collection[] {
  const byLabel = new Map<string, string[]>()
  for (const [fileId, label] of assignmentsByFileId) {
    const list = byLabel.get(label) ?? []
    list.push(fileId)
    byLabel.set(label, list)
  }
  return Array.from(byLabel.entries())
    .map(([label, fileIds]) => ({ label, fileIds }))
    .sort((a, b) => b.fileIds.length - a.fileIds.length)
}

export function useCollections(llmConfig: LLMConfig | null): UseCollectionsResult {
  const { $gettext, current: gettextLanguage } = useGettext()
  const llm = useLLM(llmConfig)

  const isClustering = ref(false)
  const collections = ref<Collection[]>([])
  const clusterError = ref<string | null>(null)

  function handleLlmError(err: unknown): string {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return $gettext('The AI service did not respond in time. Please try again later.')
    }
    if (err instanceof TypeError) {
      return $gettext(
        'Could not reach the AI service. Check your network connection and try again.'
      )
    }
    if (err instanceof Error) {
      const match = /LLM request failed: (\d+)/.exec(err.message)
      if (match) {
        const code = parseInt(match[1], 10)
        if (code === 401 || code === 403) {
          return $gettext(
            'Access to the AI service was denied. Your session may have expired — try reloading the page.'
          )
        }
        if (code === 429) {
          return $gettext('The AI service is currently busy. Please try again in a moment.')
        }
        if (code >= 500) {
          return $gettext('The AI service is temporarily unavailable. Please try again later.')
        }
      }
      return err.message
    }
    return $gettext('Something went wrong while grouping your files. Please try again.')
  }

  async function clusterBatch(batch: RecentFile[]): Promise<CollectionAssignment[]> {
    const prompt = buildClusteringPrompt(toClusterableFiles(batch), gettextLanguage)
    const raw = await llm.complete([{ role: 'user', content: prompt }], {
      maxTokens: 1024,
      temperature: 0.2,
      responseFormat: { type: 'json_object' }
    })

    try {
      return parseStrictCollections(raw)
    } catch {
      return parseLenientCollectionLines(raw)
    }
  }

  async function clusterFiles(files: RecentFile[]): Promise<void> {
    clusterError.value = null
    collections.value = []

    if (llm.status.value === 'cross-origin') {
      clusterError.value = $gettext(
        'The AI endpoint must be on the same server as ownCloud. Cross-origin requests are not supported.'
      )
      return
    }
    if (llm.status.value !== 'ready') {
      clusterError.value = $gettext('Admin needs to configure the AI endpoint.')
      return
    }
    if (files.length === 0) {
      return
    }

    isClustering.value = true
    try {
      const assignmentsByFileId = new Map<string, string>()
      for (const batch of chunk(files, MAX_FILES_PER_BATCH)) {
        const assignments = await clusterBatch(batch)
        mergeAssignments(assignmentsByFileId, assignments)
        // Commit after every batch so a later batch's failure can't discard already-clustered results.
        collections.value = toCollections(assignmentsByFileId)
      }
    } catch (err) {
      const message = handleLlmError(err)
      clusterError.value =
        collections.value.length > 0
          ? $gettext('Some files could not be grouped: %{message}', { message })
          : message
    } finally {
      isClustering.value = false
    }
  }

  return {
    status: llm.status,
    isClustering,
    collections,
    clusterError,
    clusterFiles
  }
}
