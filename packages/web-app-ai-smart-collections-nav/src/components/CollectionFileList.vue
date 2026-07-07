<template>
  <div class="collection-file-list">
    <div class="collection-file-list-header oc-flex oc-flex-middle oc-flex-between oc-mb-m">
      <div class="oc-flex oc-flex-middle oc-gap-s">
        <oc-button
          appearance="raw"
          size="small"
          :aria-label="$gettext('Back to collections')"
          @click="emit('back')"
        >
          <oc-icon name="arrow-left-s" />
        </oc-button>
        <h2 class="collection-file-list-title oc-text-truncate">{{ label }}</h2>
        <span class="oc-text-muted">{{ countLabel }}</span>
      </div>
      <oc-text-input
        v-model="filterTerm"
        class="collection-file-list-filter"
        :label="$gettext('Filter files')"
      />
    </div>

    <table v-if="filteredFiles.length" class="oc-table oc-table-hover collection-file-table">
      <thead>
        <tr>
          <th class="oc-table-header-cell">{{ $gettext('Name') }}</th>
          <th class="oc-table-header-cell">{{ $gettext('Path') }}</th>
          <th class="oc-table-header-cell">{{ $gettext('Size') }}</th>
          <th class="oc-table-header-cell">{{ $gettext('Modified') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="file in filteredFiles" :key="file.fileId">
          <td class="oc-table-cell collection-file-cell-name">
            <oc-icon name="file-3" class="oc-mr-s" />
            <span class="oc-text-truncate">{{ file.name }}</span>
          </td>
          <td class="oc-table-cell oc-text-muted collection-file-cell-path" :title="file.path">
            {{ file.path }}
          </td>
          <td class="oc-table-cell">{{ formatBytes(file.size) }}</td>
          <td class="oc-table-cell">{{ formatDate(file.mdate) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="oc-text-muted">{{ $gettext('No files match this filter.') }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { RecentFile } from '../composables/useRecentFiles'

const { $gettext, $ngettext } = useGettext()

const props = defineProps<{
  files: RecentFile[]
  label: string
}>()

const emit = defineEmits<{
  back: []
}>()

const filterTerm = ref('')

const filteredFiles = computed(() => {
  const term = filterTerm.value.trim().toLowerCase()
  if (!term) {
    return props.files
  }
  return props.files.filter(
    (file) => file.name.toLowerCase().includes(term) || file.path.toLowerCase().includes(term)
  )
})

const countLabel = computed(() =>
  $ngettext('%{n} file', '%{n} files', props.files.length, { n: String(props.files.length) })
)

function formatBytes(bytes: number): string {
  if (!bytes) {
    return '—'
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`
}

function formatDate(dateStr: string): string {
  if (!dateStr) {
    return '—'
  }
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.collection-file-list-title {
  margin: 0;
  font-size: 1.125rem;
  max-width: 20rem;
}

.collection-file-list-filter {
  max-width: 260px;
  width: 100%;
}

.collection-file-table {
  width: 100%;
  table-layout: fixed;
}

.collection-file-table th,
.collection-file-table td {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-file-cell-name {
  display: flex;
  align-items: center;
  font-weight: 500;
}

.collection-file-cell-path {
  font-size: 0.8125rem;
}
</style>
