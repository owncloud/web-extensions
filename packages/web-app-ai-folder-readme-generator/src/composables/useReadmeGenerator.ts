import { createApp, ref, type Ref } from 'vue'
import { useClientService, useUserStore } from '@ownclouders/web-pkg'
import { useGettext, createGettext } from 'vue3-gettext'
import { OcButton } from '@ownclouders/design-system/components'
import { urlJoin, type Resource, type SpaceResource } from '@ownclouders/web-client'
import { useLLM, type ChatMessage, type LLMConfig, type LLMStatus } from './useLLM'
import { isSampleableFile } from '../utils/file-support'
import OverwriteDialog from '../components/OverwriteDialog.vue'

const README_FILENAME = 'README.md'
const MAX_SAMPLE_FILES = 10
const MAX_SAMPLE_CHARS = 12_000

export interface ReadmeKeyFile {
  name: string
  description: string
}

export interface ReadmeJson {
  headline: string
  subheadline: string
  purpose: string
  key_files: ReadmeKeyFile[]
  usage_notes: string[]
}

export interface FileSample {
  name: string
  content: string
}

export interface UseReadmeGeneratorOptions {
  // Invoked when the folder already contains a README.md; resolving false aborts
  // generation. Defaults to mounting OverwriteDialog.vue as a standalone Vue app —
  // pass a custom implementation (e.g. in tests) to bypass the DOM mount.
  confirmOverwrite?: (existing: Resource) => Promise<boolean>
}

// OverwriteDialog.vue is rendered outside any sidebarPanel/route component tree (this
// extension registers a context-menu action only), so there is no existing Vue app to
// teleport the dialog into. A standalone app is mounted into a div appended to
// document.body and torn down once the user responds.
function mountOverwriteDialog(language: string): Promise<boolean> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const app = createApp(OverwriteDialog, {
      onConfirm: () => settle(true),
      onCancel: () => settle(false)
    })

    function settle(result: boolean) {
      app.unmount()
      container.remove()
      resolve(result)
    }

    // The standalone app does not inherit the host app's plugins, so the design
    // system component and gettext context are installed locally.
    app.use(createGettext({ defaultLanguage: language, silent: true }))
    app.component('OcButton', OcButton)
    app.mount(container)
  })
}

export interface UseReadmeGeneratorResult {
  status: Ref<LLMStatus>
  isGenerating: Ref<boolean>
  error: Ref<string | null>
  generate: (space: SpaceResource, resource: Resource) => Promise<Resource | undefined>
}

// Strips line breaks so LLM-generated content can't inject extra Markdown
// structural elements (headings, table rows, etc.) into single-line contexts.
function stripNewlines(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim()
}

// GFM table cells additionally need `|` escaped, since an unescaped pipe
// would split the cell and corrupt the table row.
function escapeMdCell(s: string): string {
  return stripNewlines(s).replace(/\|/g, '\\|')
}

export function renderMarkdown(json: ReadmeJson): string {
  const lines: string[] = [`# ${stripNewlines(json.headline)}`]

  if (json.subheadline) {
    lines.push('', `## ${stripNewlines(json.subheadline)}`)
  }

  if (json.purpose) {
    lines.push('', '## Overview', '', stripNewlines(json.purpose))
  }

  if (json.key_files.length > 0) {
    lines.push('', '## Key Files', '', '| File | Description |', '| --- | --- |')
    for (const file of json.key_files) {
      lines.push(`| ${escapeMdCell(file.name)} | ${escapeMdCell(file.description)} |`)
    }
  }

  if (json.usage_notes.length > 0) {
    lines.push('', '## Usage', '')
    for (const note of json.usage_notes) {
      lines.push(`- ${note}`)
    }
  }

  return lines.join('\n') + '\n'
}

function parseReadmeJson(raw: string): ReadmeJson | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const obj = parsed as Record<string, unknown>
  if (typeof obj.headline !== 'string' || typeof obj.purpose !== 'string') {
    return null
  }

  const keyFiles: ReadmeKeyFile[] = Array.isArray(obj.key_files)
    ? obj.key_files
        .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
        .map((f) => ({
          name: typeof f.name === 'string' ? f.name : '',
          description: typeof f.description === 'string' ? f.description : ''
        }))
        .filter((f) => f.name)
    : []

  const usageNotes: string[] = Array.isArray(obj.usage_notes)
    ? obj.usage_notes.map((n) => String(n).trim()).filter(Boolean)
    : []

  return {
    headline: obj.headline.trim(),
    subheadline: typeof obj.subheadline === 'string' ? obj.subheadline.trim() : '',
    purpose: obj.purpose.trim(),
    key_files: keyFiles,
    usage_notes: usageNotes
  }
}

export function useReadmeGenerator(
  llmConfig: LLMConfig | null,
  options: UseReadmeGeneratorOptions = {}
): UseReadmeGeneratorResult {
  const { $gettext, current: gettextLanguage } = useGettext()
  const llm = useLLM(llmConfig)
  const clientService = useClientService()
  const userStore = useUserStore()

  const isGenerating = ref(false)
  const error = ref<string | null>(null)

  function getUserLanguage(): string {
    return userStore.user?.preferredLanguage || gettextLanguage
  }

  const confirmOverwrite = options.confirmOverwrite ?? (() => mountOverwriteDialog(getUserLanguage()))

  async function sampleTextFiles(space: SpaceResource, children: Resource[]): Promise<FileSample[]> {
    const samples: FileSample[] = []
    let remaining = MAX_SAMPLE_CHARS

    const candidates = children.filter((child) => isSampleableFile(child)).slice(0, MAX_SAMPLE_FILES)

    for (const file of candidates) {
      if (remaining <= 0) {
        break
      }
      if (!file.path) {
        continue
      }
      try {
        const { body } = await clientService.webdav.getFileContents(
          space,
          { path: file.path },
          { responseType: 'text' }
        )
        const content = String(body ?? '').slice(0, remaining)
        if (!content) {
          continue
        }
        samples.push({ name: file.name ?? file.path, content })
        remaining -= content.length
      } catch {
        // Skip files that fail to load (deleted concurrently, permission issues, etc.)
        // and keep sampling the rest.
        continue
      }
    }

    return samples
  }

  function buildMessages(folderName: string, children: Resource[], samples: FileSample[]): ChatMessage[] {
    const fileList = children.map((child) => `- ${child.name}${child.isFolder ? '/' : ''}`).join('\n')
    const sampleText = samples
      .map((sample) => `--- ${sample.name} ---\n${sample.content}`)
      .join('\n\n')

    const systemPrompt = [
      'You write concise, accurate README.md files describing the purpose of a folder.',
      `Respond in the language with BCP 47 tag "${getUserLanguage()}".`,
      'Respond with a single JSON object and nothing else — no markdown code fences, no commentary.',
      'The JSON object must have exactly these keys:',
      '"headline": a short title for the folder (max 8 words).',
      '"subheadline": a one-sentence tagline expanding on the headline.',
      '"purpose": a 2-4 sentence paragraph describing what this folder is for.',
      '"key_files": an array of objects with "name" and "description", covering the most important files.',
      '"usage_notes": an array of 2-5 short strings with practical notes for someone using this folder.'
    ].join(' ')

    const userPrompt = [
      `Folder name: ${folderName}`,
      `Top-level contents (${children.length} items):\n${fileList || '(empty folder)'}`,
      samples.length > 0
        ? `Sampled file contents:\n${sampleText}`
        : 'No sampleable text/markdown files were found in this folder.'
    ].join('\n\n')

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  }

  function describeError(err: unknown): string {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return $gettext('The AI service did not respond in time. Please try again later.')
    }
    if (err instanceof TypeError) {
      return $gettext('Could not reach the AI service. Check your network connection and try again.')
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
        if (code === 404) {
          return $gettext('The AI endpoint could not be found. Check the endpoint URL in admin settings.')
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
    return $gettext('Something went wrong while generating the README. Please try again.')
  }

  async function generate(space: SpaceResource, resource: Resource): Promise<Resource | undefined> {
    if (!resource.path) {
      error.value = $gettext('Resource location not available')
      return undefined
    }
    if (llm.status.value !== 'ready') {
      error.value = $gettext('Admin needs to configure the AI endpoint.')
      return undefined
    }

    isGenerating.value = true
    error.value = null

    try {
      const { children = [] } = await clientService.webdav.listFiles(
        space,
        { path: resource.path },
        { depth: 1 }
      )

      const existingReadme = children.find((child) => child.name === README_FILENAME)
      if (existingReadme) {
        const confirmed = await confirmOverwrite(existingReadme)
        if (!confirmed) {
          return undefined
        }
      }

      const samples = await sampleTextFiles(space, children)
      const messages = buildMessages(resource.name ?? '', children, samples)

      const raw = await llm.complete(messages, { maxTokens: 1024, temperature: 0.4 })
      const json = parseReadmeJson(raw)
      const markdown = json ? renderMarkdown(json) : raw.trim()

      if (!markdown) {
        throw new Error($gettext('The AI service returned an empty response.'))
      }

      return await clientService.webdav.putFileContents(space, {
        path: urlJoin(resource.path, README_FILENAME),
        content: markdown,
        overwrite: true
      })
    } catch (err) {
      error.value = describeError(err)
      return undefined
    } finally {
      isGenerating.value = false
    }
  }

  return { status: llm.status, isGenerating, error, generate }
}
