import { ref, type Ref } from 'vue'
import { useClientService, useResourcesStore, useSpacesStore, useUserStore } from '@ownclouders/web-pkg'
import { urlJoin } from '@ownclouders/web-client'
import { useGettext } from 'vue3-gettext'
import { useLLM, type LLMConfig, type LLMCapabilities } from './useLLM'

export type DraftFormat = 'markdown' | 'plain'

export interface UseDraftCreatorResult {
  creating: Ref<boolean>
  error: Ref<string | null>
  canCreate: () => boolean
  createDraft: (description: string, format: DraftFormat) => Promise<string | null>
}

function buildPrompt(description: string, format: DraftFormat, capabilities: LLMCapabilities | null): string {
  const formatNote =
    format === 'markdown'
      ? 'Format the output as Markdown with headings (## for sections) and appropriate structure.'
      : 'Format the output as plain text with clear section labels.'

  // Tier 1: toolUse or large context → richly sectioned with placeholder content
  const isRich = !!(capabilities?.toolUse || (capabilities && capabilities.contextTokens > 8192))

  if (isRich) {
    return (
      `Create a well-structured document based on this description: "${description}"\n\n` +
      `${formatNote}\n` +
      `Requirements:\n` +
      `- Include a brief introduction paragraph\n` +
      `- Add at least 3 clearly labelled sections relevant to the topic\n` +
      `- Use placeholder text like "[Add details here]" or "[To be filled in]" where appropriate\n` +
      `- Add an "Action Items" or "Next Steps" section at the end\n` +
      `Output only the document content, no preamble or explanation.`
    )
  }

  // Tier 2: basic LLM — simple narrative draft
  return (
    `Write a concise draft document based on this description: "${description}"\n\n` +
    `${formatNote}\n` +
    `Cover the main points clearly and concisely.\n` +
    `Output only the document content, no preamble or explanation.`
  )
}

function deriveFilename(description: string, format: DraftFormat): string {
  const ext = format === 'markdown' ? 'md' : 'txt'
  const slug =
    description
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40)
      .replace(/-+$/, '') || 'draft'
  const date = new Date().toISOString().slice(0, 10)
  return `${slug}-${date}.${ext}`
}

export function useDraftCreator(llmConfig: LLMConfig | null): UseDraftCreatorResult {
  const { $gettext } = useGettext()
  const clientService = useClientService()
  const resourcesStore = useResourcesStore()
  const spacesStore = useSpacesStore()
  const userStore = useUserStore()

  const creating = ref(false)
  const error = ref<string | null>(null)

  const llm = llmConfig ? useLLM(llmConfig) : null

  function canCreate(): boolean {
    if (!llmConfig) return false
    const folder = resourcesStore.currentFolder
    return !!(folder?.canUpload({ user: userStore.user }))
  }

  async function createDraft(description: string, format: DraftFormat): Promise<string | null> {
    if (!llmConfig || !llm) {
      error.value = $gettext('LLM is not configured.')
      return null
    }

    const currentFolder = resourcesStore.currentFolder
    if (!currentFolder?.storageId) {
      error.value = $gettext('No folder is currently open.')
      return null
    }

    const space = spacesStore.getSpace(currentFolder.storageId)
    if (!space) {
      error.value = $gettext('Could not resolve the current folder space.')
      return null
    }

    creating.value = true
    error.value = null

    try {
      // capabilities.value may be null if the probe has not yet completed.
      // buildPrompt falls back to tier-2 (simple draft) when null.
      // complete() awaits probe internally for context management regardless.
      const caps = llm.capabilities.value
      const prompt = buildPrompt(description, format, caps)

      const content = await llm.complete(
        [
          {
            role: 'system',
            content: 'You are a professional document drafting assistant. Output only the document content.'
          },
          { role: 'user', content: prompt }
        ],
        { maxTokens: 2048, temperature: 0.7 }
      )

      const filename = deriveFilename(description, format)
      const filePath = urlJoin(currentFolder.path, filename)

      await clientService.webdav.putFileContents(space, { path: filePath, content })

      return filename
    } catch (err) {
      error.value =
        err instanceof Error
          ? err.message
          : $gettext('Failed to create the draft. Please try again.')
      return null
    } finally {
      creating.value = false
    }
  }

  return { creating, error, canCreate, createDraft }
}
