<template>
  <div
    data-testid="version-changelog-panel"
    class="version-changelog-panel oc-background-muted oc-p-m oc-rounded"
  >
    <div v-if="!llmConfig" class="changelog-notice oc-mb-m" role="note">
      {{ $gettext('Configure an AI endpoint in admin settings to generate changelogs.') }}
    </div>

    <div v-if="isBinaryFile" class="changelog-placeholder">
      {{ $gettext('Binary files are not supported for changelog generation.') }}
    </div>

    <template v-else>
      <div v-if="isLoading" class="changelog-placeholder">
        {{ $gettext('Loading version history…') }}
      </div>

      <div v-else-if="historyError" class="changelog-error" role="alert">
        {{ historyError }}
      </div>

      <div v-else-if="!versions.length" class="changelog-placeholder">
        {{ $gettext('No version history available for this file.') }}
      </div>

      <template v-else>
        <div
          v-for="(version, index) in versions"
          :key="version.id ?? index"
          class="changelog-version-row oc-mb-s"
          data-testid="version-row"
        >
          <div class="oc-flex oc-flex-between oc-flex-middle oc-mb-xs">
            <div class="changelog-version-meta">
              <span class="changelog-version-number oc-mr-xs">
                {{ $gettext('v%{n}', { n: versions.length - index }) }}
              </span>
              <span class="changelog-version-date">
                {{ formatDate(version.mdate) }}
              </span>
            </div>
            <template v-if="llmConfig">
              <span v-if="isGeneratingKey(cacheKey(index))" class="changelog-generating">
                {{ $gettext('Generating…') }}
              </span>
              <oc-button
                v-else-if="!getEntry(cacheKey(index))"
                size="small"
                :aria-label="$gettext('Generate changelog entry')"
                @click="onGenerate(index)"
              >
                {{ $pgettext('Button to generate version changelog entry', 'Generate') }}
              </oc-button>
            </template>
            <oc-button
              v-else
              size="small"
              :disabled="true"
              :aria-label="$gettext('Configure AI to generate changelog')"
            >
              {{ $pgettext('Button to generate version changelog entry', 'Generate') }}
            </oc-button>
          </div>

          <div
            v-if="getError(cacheKey(index))"
            class="changelog-entry-error oc-mb-xs"
            role="alert"
          >
            <span>{{ getError(cacheKey(index)) }}</span>
            <oc-button
              v-if="llmConfig"
              size="small"
              appearance="raw"
              class="oc-ml-xs"
              @click="onRetry(index)"
            >
              {{ $pgettext('Button to retry changelog generation', 'Retry') }}
            </oc-button>
          </div>

          <p
            v-if="getEntry(cacheKey(index))"
            class="changelog-entry-plain oc-mt-xs"
          >
            {{ getEntry(cacheKey(index))!.summary }}
          </p>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useClientService, useConfigStore, useSpacesStore } from '@ownclouders/web-pkg'
import { useVersionHistory } from '../composables/useVersionHistory'
import { useChangelog } from '../composables/useChangelog'
import type { LlmConfig } from '../composables/useLlm'
import type { Resource } from '@ownclouders/web-client'

const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml', 'application/xhtml']

const { $gettext, $pgettext } = useGettext()

const props = defineProps<{
  resource?: Resource | null
  llmConfig?: LlmConfig | null
}>()

const clientService = useClientService()
const configStore = useConfigStore()
const spacesStore = useSpacesStore()

const { versions, isLoading, error: historyError, fetchVersions } = useVersionHistory()
const llmConfigRef = computed(() => props.llmConfig ?? null)
const { generateEntry, getEntry, isGeneratingKey, getError, clearError } = useChangelog(llmConfigRef)

const isBinaryFile = computed(() => {
  if (!props.resource) {
    return false
  }
  const mime = props.resource.mimeType
  if (!mime) {
    return true
  }
  return !TEXT_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))
})

function formatDate(mdate?: string): string {
  if (!mdate) {
    return $gettext('Unknown date')
  }
  const d = new Date(mdate)
  if (isNaN(d.getTime())) {
    return mdate
  }
  return d.toLocaleString()
}

function cacheKey(index: number): string {
  const fileId = props.resource?.fileId ?? props.resource?.id ?? 'unknown'
  const versionEtag = versions.value[index]?.etag || String(index)
  return `${fileId}:${versionEtag}`
}

async function fetchVersionContent(versionIndex: number): Promise<string> {
  const version = versions.value[versionIndex]
  if (!version?.path) {
    return ''
  }
  const serverUrl = configStore.serverUrl.replace(/\/$/, '')
  const url = `${serverUrl}/dav${version.path}`
  const response = await clientService.httpAuthenticated.get<string>(url, {
    responseType: 'text'
  })
  return response.data ?? ''
}

async function fetchHeadContent(): Promise<string> {
  const res = props.resource
  if (!res?.fileId || !res?.storageId) {
    return ''
  }
  const space = spacesStore.getSpace(res.storageId)
  if (!space) {
    return ''
  }
  const { response } = await clientService.webdav.getFileContents(
    space,
    { fileId: res.fileId },
    { responseType: 'text' }
  )
  return (response.data as string) ?? ''
}

function makeFetchOld(index: number): () => Promise<string> {
  return () => fetchVersionContent(index)
}

function makeFetchNew(index: number): () => Promise<string> {
  if (index === 0) {
    return fetchHeadContent
  }
  return () => fetchVersionContent(index - 1)
}

async function onGenerate(index: number): Promise<void> {
  await generateEntry(cacheKey(index), makeFetchOld(index), makeFetchNew(index))
}

async function onRetry(index: number): Promise<void> {
  clearError(cacheKey(index))
  await generateEntry(cacheKey(index), makeFetchOld(index), makeFetchNew(index))
}

async function loadVersions(): Promise<void> {
  if (!props.resource?.fileId) {
    versions.value = []
    return
  }
  await fetchVersions(props.resource.fileId)
}

onMounted(loadVersions)

watch(
  () => props.resource?.fileId,
  () => loadVersions()
)
</script>

<style scoped>
.changelog-placeholder {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-style: italic;
}
.changelog-error,
.changelog-entry-error {
  color: var(--oc-color-danger, #c00);
  font-size: 0.9em;
}
.changelog-notice {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-size: 0.9em;
  border-left: 3px solid var(--oc-color-warning, #e6a817);
  padding-left: 0.5em;
}
.changelog-version-row {
  border-bottom: 1px solid var(--oc-color-border, #e0e0e0);
  padding-bottom: 0.5em;
}
.changelog-version-row:last-child {
  border-bottom: none;
}
.changelog-version-number {
  font-weight: 600;
}
.changelog-version-date {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-size: 0.85em;
}
.changelog-generating {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-style: italic;
  font-size: 0.9em;
}
.changelog-entry-plain {
  color: var(--oc-color-text-default, #333);
  font-size: 0.9em;
}
</style>
