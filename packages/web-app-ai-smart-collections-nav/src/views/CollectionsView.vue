<template>
  <div
    class="collections-view oc-p-m"
    role="main"
    :aria-label="$gettext('Collections')"
    data-testid="collections-view"
  >
    <div class="collections-view-header oc-mb-m">
      <h1>{{ $gettext('Collections') }}</h1>
      <p class="oc-text-muted">
        {{ $gettext('Your recent files, grouped into AI-inferred themes.') }}
      </p>
    </div>

    <div v-if="isBusy" class="collections-view-placeholder">
      <oc-spinner :aria-label="busyLabel" />
      <p class="oc-mt-s">{{ busyLabel }}</p>
    </div>

    <template v-else-if="showConsent">
      <ConsentDialog @confirm="onConsentConfirm" @deny="onConsentDeny" />
    </template>

    <template v-else-if="errorMessage && collections.length === 0">
      <div class="collections-view-placeholder" role="alert">
        <p class="collections-view-error">{{ errorMessage }}</p>
        <oc-button size="small" variant="primary" @click="loadAndCluster">
          {{ $gettext('Retry') }}
        </oc-button>
      </div>
    </template>

    <template v-else-if="consentDeclined">
      <div class="collections-view-placeholder">
        <p class="oc-text-muted">
          {{ $gettext('Grouping was cancelled. No file data was sent to the AI service.') }}
        </p>
        <oc-button size="small" variant="primary" @click="startClustering(recentFiles)">
          {{ $gettext('Group my files') }}
        </oc-button>
      </div>
    </template>

    <template v-else-if="selectedCollection">
      <CollectionFileList
        :files="selectedFiles"
        :label="selectedCollection.label"
        @back="backToGrid"
      />
    </template>

    <template v-else-if="collections.length">
      <p v-if="errorMessage" class="collections-view-error collections-view-inline-error" role="alert">
        {{ errorMessage }}
      </p>
      <div class="collections-grid">
        <CollectionCard
          v-for="collection in collections"
          :key="collection.label"
          :label="collection.label"
          :file-count="collection.fileIds.length"
          @click="selectCollection(collection)"
        />
      </div>
    </template>

    <div v-else class="collections-view-placeholder">
      <oc-icon name="sparkling-2" size="xlarge" />
      <p class="oc-text-muted">
        {{
          recentFiles.length === 0
            ? $gettext('No recent files were found to group into collections.')
            : $gettext('No collections could be inferred from your recent files.')
        }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useRecentFiles, type RecentFile } from '../composables/useRecentFiles'
import { useCollections, type Collection } from '../composables/useCollections'
import { hasSessionConsent, giveSessionConsent } from '../composables/useConsent'
import type { LLMConfig } from '../composables/useLLM'
import CollectionCard from '../components/CollectionCard.vue'
import CollectionFileList from '../components/CollectionFileList.vue'
import ConsentDialog from '../components/ConsentDialog.vue'

const { $gettext } = useGettext()

const props = defineProps<{
  llmConfig?: LLMConfig | null
}>()

const { isLoading: filesLoading, error: filesError, fetchRecentFiles } = useRecentFiles()
const { status, isClustering, collections, clusterError, clusterFiles } = useCollections(
  props.llmConfig ?? null
)

const recentFiles = ref<RecentFile[]>([])
const selectedCollection = ref<Collection | null>(null)
const showConsent = ref(false)
const consentDeclined = ref(false)

const isBusy = computed(() => filesLoading.value || isClustering.value)
const errorMessage = computed(() => filesError.value ?? clusterError.value)
const busyLabel = computed(() =>
  filesLoading.value
    ? $gettext('Looking for your recent files…')
    : $gettext('Grouping your files into collections…')
)

const selectedFiles = computed(() => {
  if (!selectedCollection.value) {
    return []
  }
  const ids = new Set(selectedCollection.value.fileIds)
  return recentFiles.value.filter((file) => ids.has(file.fileId))
})

async function startClustering(files: RecentFile[]): Promise<void> {
  consentDeclined.value = false
  if (status.value !== 'ready') {
    // No consent needed: clusterFiles short-circuits before any data leaves the browser
    // and surfaces the unconfigured/cross-origin message via clusterError.
    await clusterFiles(files)
    return
  }
  if (!hasSessionConsent()) {
    showConsent.value = true
    return
  }
  await clusterFiles(files)
}

async function loadAndCluster(): Promise<void> {
  selectedCollection.value = null
  consentDeclined.value = false
  recentFiles.value = await fetchRecentFiles()
  if (filesError.value || recentFiles.value.length === 0) {
    return
  }
  await startClustering(recentFiles.value)
}

async function onConsentConfirm(): Promise<void> {
  giveSessionConsent()
  showConsent.value = false
  await clusterFiles(recentFiles.value)
}

function onConsentDeny(): void {
  showConsent.value = false
  consentDeclined.value = true
}

function selectCollection(collection: Collection): void {
  selectedCollection.value = collection
}

function backToGrid(): void {
  selectedCollection.value = null
}

onMounted(loadAndCluster)
</script>

<style scoped>
.collections-view {
  height: 100%;
  overflow-y: auto;
}

.collections-view-header h1 {
  margin: 0 0 var(--oc-space-xsmall) 0;
}

.collections-view-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--oc-space-small);
  padding: var(--oc-space-large) 0;
  text-align: center;
}

.collections-view-error {
  color: var(--oc-color-swatch-danger-default);
}

.collections-view-inline-error {
  margin: 0 0 var(--oc-space-medium) 0;
}

.collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--oc-space-medium);
}
</style>
