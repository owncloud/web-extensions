import { ref, isRef, type Ref } from 'vue'
import { useAuthStore, useUserStore } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import { computeDiff, diffToText } from '../utils/diff'
import type { LlmConfig } from './useLlm'

const MAX_DIFF_CHARS = 8_000
const MAX_CONTENT_CHARS = 500_000

export interface ChangelogEntry {
  summary: string
}

export type ContentFetcher = () => Promise<string>

export interface UseChangelogResult {
  generateEntry: (cacheKey: string, fetchOld: ContentFetcher, fetchNew: ContentFetcher) => Promise<void>
  getEntry: (cacheKey: string) => ChangelogEntry | undefined
  isGeneratingKey: (cacheKey: string) => boolean
  getError: (cacheKey: string) => string | undefined
  clearError: (cacheKey: string) => void
}

export function useChangelog(llmConfig: LlmConfig | null | Ref<LlmConfig | null>): UseChangelogResult {
  function getLlmConfig(): LlmConfig | null {
    return isRef(llmConfig) ? llmConfig.value : llmConfig
  }
  const { $gettext, current: gettextLanguage } = useGettext()
  const authStore = useAuthStore()
  const userStore = useUserStore()

  const cache = ref(new Map<string, ChangelogEntry>())
  const generatingKeys = ref(new Set<string>())
  const errors = ref(new Map<string, string>())

  function buildHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = authStore.accessToken
    if (token) {
      h['Authorization'] = `Bearer ${token}`
    }
    return h
  }

  function getUserLanguage(): string {
    return userStore.user?.preferredLanguage || gettextLanguage
  }

  function aiErrorMessage(status: number): string {
    if (status === 401 || status === 403) {
      return $gettext(
        'Access to the AI service was denied. Your session may have expired — try reloading the page.'
      )
    }
    if (status === 404) {
      return $gettext(
        'The AI endpoint could not be found. Check the endpoint URL in admin settings.'
      )
    }
    if (status === 429) {
      return $gettext('The AI service is currently busy. Please try again in a moment.')
    }
    if (status >= 500) {
      return $gettext('The AI service is temporarily unavailable. Please try again later.')
    }
    return $gettext('The AI service returned an unexpected response. Please try again.')
  }

  async function callLlm(diffText: string): Promise<ChangelogEntry> {
    const config = getLlmConfig()
    if (!config) {
      throw new Error($gettext('Admin needs to configure the AI endpoint.'))
    }

    const base = config.endpoint.replace(/\/$/, '')
    const lang = getUserLanguage()
    const prompt = [
      'The following is a unified diff between two versions of a document.',
      `Respond in the language with BCP 47 tag "${lang}".`,
      'Write one or two casual sentences describing what you changed, as if telling a colleague.',
      'Focus on the actual content — what was added, removed, or updated — not on the fact that versions differ.',
      'Example: "Added the budget forecast for Q3 and removed Bob from the attendees list."',
      'Return only the sentences, no preamble.',
      '\n\nDiff:\n' + diffText
    ].join(' ')

    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 256
      })
    })

    if (!res.ok) {
      throw new Error(aiErrorMessage(res.status))
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
    }
    const choice = data.choices?.[0]
    const text = choice?.finish_reason === 'length' ? '' : (choice?.message?.content ?? '')

    return { summary: text.trim() || $gettext('No changes detected.') }
  }

  async function generateEntry(
    cacheKey: string,
    fetchOld: ContentFetcher,
    fetchNew: ContentFetcher
  ): Promise<void> {
    if (cache.value.has(cacheKey) || generatingKeys.value.has(cacheKey)) {
      return
    }

    generatingKeys.value.add(cacheKey)
    errors.value.delete(cacheKey)

    try {
      const [oldContent, newContent] = await Promise.all([fetchOld(), fetchNew()])

      if (oldContent.length > MAX_CONTENT_CHARS || newContent.length > MAX_CONTENT_CHARS) {
        errors.value.set(
          cacheKey,
          $gettext('This file is too large to compare. Only files with up to 2,000 lines are supported.')
        )
        return
      }

      const hunks = computeDiff(oldContent, newContent)
      const raw = diffToText(hunks)
      const diffText =
        raw.length > MAX_DIFF_CHARS ? raw.slice(0, MAX_DIFF_CHARS) + '\n...[diff truncated]' : raw

      if (!diffText.trim()) {
        if (oldContent !== newContent) {
          errors.value.set(
            cacheKey,
            $gettext('This file is too large to compare. Only files with up to 2,000 lines are supported.')
          )
          return
        }
        cache.value.set(cacheKey, {
          summary: $gettext('No text changes detected between these versions.')
        })
        return
      }

      const entry = await callLlm(diffText)
      cache.value.set(cacheKey, entry)
    } catch (err: unknown) {
      let msg: string
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        msg = $gettext('The AI service did not respond in time. Please try again later.')
      } else if (err instanceof TypeError) {
        msg = $gettext('Could not reach the AI service. Check your network connection and try again.')
      } else {
        msg = err instanceof Error ? err.message : $gettext('Something went wrong. Please try again.')
      }
      errors.value.set(cacheKey, msg)
    } finally {
      generatingKeys.value.delete(cacheKey)
    }
  }

  function getEntry(cacheKey: string): ChangelogEntry | undefined {
    return cache.value.get(cacheKey)
  }

  function isGeneratingKey(cacheKey: string): boolean {
    return generatingKeys.value.has(cacheKey)
  }

  function getError(cacheKey: string): string | undefined {
    return errors.value.get(cacheKey)
  }

  function clearError(cacheKey: string): void {
    errors.value.delete(cacheKey)
  }

  return { generateEntry, getEntry, isGeneratingKey, getError, clearError }
}
