<template>
  <main id="space-report" class="space-report oc-p-m" data-testid="space-report-view">
    <header class="space-report-header oc-mb-m">
      <div>
        <h1 class="oc-m-rm">{{ $gettext('Space report') }}</h1>
        <p class="oc-m-rm oc-text-muted oc-text-small">
          <template v-if="generatedAt">
            {{ $gettext('Generated %{date}', { date: generatedAt.toLocaleString() }) }} ·
          </template>
          {{ serverHost }}
        </p>
      </div>
      <div class="space-report-actions no-print">
        <oc-button :disabled="loading" @click="load">
          <oc-icon name="refresh" size="small" />{{ $gettext('Refresh') }}
        </oc-button>
        <oc-button
          :disabled="!rows.length || exporting || orphanStatus === 'running'"
          @click="downloadPdf"
        >
          <oc-icon name="file-pdf" size="small" />PDF
        </oc-button>
        <oc-button
          data-testid="space-report-markdown"
          :disabled="!rows.length || orphanStatus === 'running'"
          @click="downloadMarkdown"
        >
          <oc-icon name="markdown" size="small" />Markdown
        </oc-button>
        <oc-button
          id="space-report-save-btn"
          v-oc-tooltip="personalSpace ? '' : $gettext('You have no personal space to save into')"
          :disabled="!rows.length || saving || !personalSpace || orphanStatus === 'running'"
        >
          <oc-icon :name="saving ? 'loader-4' : 'save'" size="small" />{{
            $gettext('Save to my files')
          }}
        </oc-button>
        <oc-drop
          drop-id="space-report-save-drop"
          toggle="#space-report-save-btn"
          mode="click"
          close-on-click
          padding-size="small"
        >
          <ul class="space-report-menu">
            <li>
              <oc-button appearance="raw" @click="saveReport('pdf')">
                <oc-icon name="file-pdf" size="small" />{{ $gettext('Save as PDF') }}
              </oc-button>
            </li>
            <li>
              <oc-button appearance="raw" @click="saveReport('md')">
                <oc-icon name="markdown" size="small" />{{ $gettext('Save as Markdown') }}
              </oc-button>
            </li>
          </ul>
          <p class="oc-text-small oc-text-muted oc-m-rm oc-mt-xs">
            {{ $gettext('Folder: %{folder}', { folder: saveFolderLabel }) }}
          </p>
        </oc-drop>
        <oc-button :disabled="!rows.length" @click="downloadCsv">
          <oc-icon name="file-download" size="small" />CSV
        </oc-button>
        <oc-button :disabled="!rows.length" @click="print">
          <oc-icon name="printer" size="small" />{{ $gettext('Print') }}
        </oc-button>
      </div>
    </header>

    <div v-if="loading && !rows.length" class="oc-flex oc-flex-middle oc-p-l">
      <oc-spinner :aria-label="$gettext('Loading spaces')" class="oc-mr-s" />
      {{ $gettext('Loading spaces…') }}
    </div>

    <div v-if="error" class="space-report-notice space-report-notice-error oc-mb-m">
      <oc-icon name="error-warning" class="oc-mr-s" />{{ error }}
    </div>
    <div v-if="!canSeeForeignPersonal" class="space-report-notice oc-mb-m">
      <oc-icon name="information" class="oc-mr-s" />
      {{
        $gettext(
          "Other users' personal spaces are only listed for accounts with user management permission (Admin role). The numbers below may be incomplete."
        )
      }}
    </div>
    <div v-if="vaultStatus === 'mfa-required'" class="space-report-notice oc-mb-m">
      <oc-icon name="information" class="oc-mr-s" />
      {{ $gettext('Vault spaces are not included: listing them needs a session with MFA.') }}
    </div>
    <div v-else-if="vaultStatus === 'error'" class="space-report-notice oc-mb-m">
      <oc-icon name="information" class="oc-mr-s" />
      {{ $gettext('Vault spaces could not be loaded.') }}
    </div>

    <template v-if="rows.length || (!loading && !error)">
      <!-- summary tiles -->
      <section class="space-report-tiles oc-mb-l">
        <div class="space-report-tile" data-testid="space-report-tile-personal">
          <div class="space-report-tile-label">{{ $gettext('Personal spaces') }}</div>
          <div class="space-report-tile-value">{{ summary.byKind.personal.count }}</div>
          <div class="space-report-tile-sub">
            {{ formatBytes(summary.byKind.personal.used) }} {{ $gettext('used') }}
          </div>
        </div>
        <div class="space-report-tile" data-testid="space-report-tile-project">
          <div class="space-report-tile-label">{{ $gettext('Project spaces') }}</div>
          <div class="space-report-tile-value">{{ summary.byKind.project.count }}</div>
          <div class="space-report-tile-sub">
            {{ formatBytes(summary.byKind.project.used) }} {{ $gettext('used') }}
            <template v-if="summary.byKind.project.disabled">
              · {{ $gettext('%{n} disabled', { n: String(summary.byKind.project.disabled) }) }}
            </template>
          </div>
        </div>
        <div v-if="vaultStatus === 'ok'" class="space-report-tile">
          <div class="space-report-tile-label">{{ $gettext('Vault spaces') }}</div>
          <div class="space-report-tile-value">{{ vaultCount }}</div>
          <div class="space-report-tile-sub">
            {{ formatBytes(vaultUsed) }} {{ $gettext('used') }}
          </div>
        </div>
        <div class="space-report-tile">
          <div class="space-report-tile-label">{{ $gettext('Total used') }}</div>
          <div class="space-report-tile-value">{{ formatBytes(summary.total.used) }}</div>
          <div class="space-report-tile-sub">
            {{
              $gettext('%{quota} quota assigned', {
                quota: formatBytes(summary.total.quotaAssigned)
              })
            }}
            <template v-if="summary.total.unlimited">
              · {{ $gettext('%{n} unlimited', { n: String(summary.total.unlimited) }) }}
            </template>
          </div>
        </div>
        <div
          class="space-report-tile"
          :class="{ 'space-report-tile-warn': summary.total.overThreshold }"
        >
          <div class="space-report-tile-label">
            {{ $gettext('≥ %{p} % full', { p: String(thresholdPercent) }) }}
          </div>
          <div class="space-report-tile-value">{{ summary.total.overThreshold }}</div>
          <div class="space-report-tile-sub">
            {{ $gettext('%{n} at or over quota', { n: String(summary.total.exceeded) }) }}
          </div>
        </div>
        <div
          class="space-report-tile"
          :class="{ 'space-report-tile-warn': orphanStatus === 'ok' && orphanSummary.total }"
        >
          <div class="space-report-tile-label">{{ $gettext('Orphaned spaces') }}</div>
          <template v-if="orphanStatus === 'ok'">
            <div class="space-report-tile-value">{{ orphanSummary.total }}</div>
            <div class="space-report-tile-sub">
              {{
                $gettext('%{p} personal · %{s} project · %{size}', {
                  p: String(orphanSummary.personalOwnerMissing),
                  s: String(orphanSummary.projectNoMembers + orphanSummary.projectMembersGone),
                  size: formatBytes(orphanSummary.used)
                })
              }}
            </div>
          </template>
          <template v-else>
            <div class="space-report-tile-value">
              <oc-spinner
                v-if="orphanStatus === 'running' || orphanStatus === 'pending'"
                size="small"
                :aria-label="$gettext('Checking')"
              />
              <span v-else>–</span>
            </div>
            <div class="space-report-tile-sub">
              <template v-if="orphanStatus === 'skipped'">{{
                $gettext('needs the Admin role')
              }}</template>
              <template v-else-if="orphanStatus === 'error'">{{
                $gettext('check failed')
              }}</template>
              <template v-else>{{ $gettext('checking users and groups…') }}</template>
            </div>
          </template>
        </div>
        <div class="space-report-tile">
          <div class="space-report-tile-label">{{ $gettext('Avg. per personal space') }}</div>
          <div class="space-report-tile-value">{{ formatBytes(avgPersonal) }}</div>
          <div class="space-report-tile-sub">
            {{ $gettext('median %{m}', { m: formatBytes(medianPersonal) }) }}
          </div>
        </div>
      </section>

      <!-- top lists -->
      <section class="space-report-tops oc-mb-l">
        <div>
          <h2 class="oc-mb-s">{{ $gettext('Largest spaces') }}</h2>
          <ol class="space-report-bars">
            <li v-for="r in summary.largest" :key="'l' + r.id">
              <div class="space-report-bar-label">
                <span class="oc-text-truncate">{{ r.name }}</span>
                <span class="space-report-num">{{ formatBytes(r.used) }}</span>
              </div>
              <div class="space-report-bar-track">
                <div class="space-report-bar" :style="{ width: barWidth(r.used, maxUsed) }" />
              </div>
            </li>
            <li v-if="!summary.largest.length" class="oc-text-muted">{{ $gettext('No data') }}</li>
          </ol>
        </div>
        <div>
          <h2 class="oc-mb-s">{{ $gettext('Fullest spaces (by quota)') }}</h2>
          <ol class="space-report-bars">
            <li v-for="r in summary.fullest" :key="'f' + r.id">
              <div class="space-report-bar-label">
                <span class="oc-text-truncate">{{ r.name }}</span>
                <span class="space-report-num">
                  {{ formatPercent(r.ratio) }} · {{ formatBytes(r.used) }} /
                  {{ formatBytes(r.quota) }}
                </span>
              </div>
              <div class="space-report-bar-track">
                <div
                  class="space-report-bar"
                  :class="{ 'space-report-bar-warn': (r.ratio as number) >= threshold }"
                  :style="{ width: barWidth(r.ratio as number, 1) }"
                />
              </div>
            </li>
            <li v-if="!summary.fullest.length" class="oc-text-muted">
              {{ $gettext('No spaces with a quota') }}
            </li>
          </ol>
        </div>
      </section>

      <!-- orphaned spaces -->
      <section v-if="orphanStatus === 'ok'" class="oc-mb-l">
        <h2 class="oc-mb-s">{{ $gettext('Orphaned spaces') }}</h2>
        <p class="oc-text-small oc-text-muted oc-mt-rm">
          {{
            $gettext(
              'Personal spaces whose owner no longer exists in the user backend, and project spaces without members or whose members were all deleted (or are empty groups).'
            )
          }}
        </p>
        <table v-if="orphanRows.length" class="space-report-table oc-mb-s">
          <thead>
            <tr>
              <th>{{ $gettext('Type') }}</th>
              <th>{{ $gettext('Name') }}</th>
              <th>{{ $gettext('Reason') }}</th>
              <th class="space-report-num">{{ $gettext('Used') }}</th>
              <th class="space-report-num">{{ $gettext('Last modified') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in orphanRows" :key="'o' + r.kind + r.id">
              <td>{{ kindLabel(r.kind) }}</td>
              <td>
                {{ r.name }}
                <span v-if="r.disabled" class="oc-text-small oc-text-muted"
                  >({{ $gettext('disabled') }})</span
                >
              </td>
              <td>{{ orphanLabel(r) }}</td>
              <td class="space-report-num">{{ formatBytes(r.used) }}</td>
              <td class="space-report-num">
                {{ r.lastModified ? new Date(r.lastModified).toLocaleDateString() : '–' }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">{{ $gettext('%{n} spaces', { n: String(orphanRows.length) }) }}</td>
              <td class="space-report-num">{{ formatBytes(orphanSummary.used) }}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        <p v-else class="oc-text-muted">{{ $gettext('No orphaned spaces found.') }}</p>
        <ul class="oc-text-small space-report-hints">
          <li v-if="orphanSummary.noManager">
            {{
              $gettext('%{n} project spaces have members but no manager.', {
                n: String(orphanSummary.noManager)
              })
            }}
          </li>
          <li v-if="orphanSummary.ownerDisabled">
            {{
              $gettext('%{n} personal spaces belong to disabled accounts.', {
                n: String(orphanSummary.ownerDisabled)
              })
            }}
          </li>
          <li v-if="orphanUnverified">
            {{
              $gettext(
                '%{n} users/groups could not be verified; spaces depending on them are not counted as orphaned.',
                {
                  n: String(orphanUnverified)
                }
              )
            }}
          </li>
        </ul>
      </section>

      <!-- full list -->
      <section>
        <div class="space-report-filters oc-mb-s no-print">
          <h2 class="oc-m-rm oc-mr-m">{{ $gettext('All spaces') }}</h2>
          <oc-button
            v-for="f in kindFilters"
            :key="f.value"
            size="small"
            :appearance="kindFilter === f.value ? 'filled' : 'outline'"
            :variation="kindFilter === f.value ? 'primary' : 'passive'"
            @click="kindFilter = f.value"
          >
            {{ f.label }}
          </oc-button>
          <oc-text-input
            v-model="search"
            class="space-report-search"
            :label="$gettext('Search name or owner')"
            :clear-button-enabled="true"
          />
        </div>

        <table class="space-report-table">
          <thead>
            <tr>
              <th v-for="c in columns" :key="c.key" :class="c.class">
                <button class="space-report-sort" type="button" @click="sortBy(c.key)">
                  {{ c.label }}
                  <span v-if="sortKey === c.key">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in visibleRows"
              :key="r.kind + r.id"
              data-testid="space-report-row"
              :class="{ 'space-report-row-disabled': r.disabled }"
            >
              <td>{{ kindLabel(r.kind) }}</td>
              <td>
                {{ r.name }}
                <span v-if="r.disabled" class="oc-text-small oc-text-muted"
                  >({{ $gettext('disabled') }})</span
                >
                <span v-if="r.orphan" class="space-report-badge">{{ $gettext('orphaned') }}</span>
                <span v-else-if="r.noManager" class="space-report-badge space-report-badge-soft">{{
                  $gettext('no manager')
                }}</span>
              </td>
              <td>{{ r.owner }}</td>
              <td class="space-report-num">{{ formatBytes(r.used) }}</td>
              <td class="space-report-num">
                {{ r.quota ? formatBytes(r.quota) : $gettext('unlimited') }}
              </td>
              <td
                class="space-report-num"
                :class="{ 'space-report-warn-text': r.ratio !== null && r.ratio >= threshold }"
              >
                {{ formatPercent(r.ratio) }}
              </td>
              <td class="space-report-num">
                {{ r.lastModified ? new Date(r.lastModified).toLocaleDateString() : '–' }}
              </td>
            </tr>
            <tr v-if="!filteredRows.length">
              <td colspan="7" class="oc-text-muted">{{ $gettext('No spaces match.') }}</td>
            </tr>
          </tbody>
          <tfoot v-if="filteredRows.length">
            <tr>
              <td colspan="3">{{ $gettext('%{n} spaces', { n: String(filteredRows.length) }) }}</td>
              <td class="space-report-num">{{ formatBytes(filteredUsed) }}</td>
              <td colspan="3" />
            </tr>
          </tfoot>
        </table>
        <div v-if="filteredRows.length > visibleRows.length" class="oc-mt-s no-print">
          <oc-button size="small" @click="limit += 200">
            {{
              $gettext('Show more (%{n} left)', {
                n: String(filteredRows.length - visibleRows.length)
              })
            }}
          </oc-button>
        </div>
      </section>
    </template>
  </main>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, unref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import {
  useAbility,
  useAuthStore,
  useConfigStore,
  useClientService,
  useMessages,
  useSpacesStore,
  useUserStore
} from '@ownclouders/web-pkg'
import { useCapabilityStore } from '../compat'
import { exists, fetchDrives, fetchGroups, fetchUsers, GraphError } from '../api'
import { ORPHAN_LABEL, analyzeOrphans, summarizeOrphans } from '../orphans'
import {
  SpaceKind,
  SpaceRow,
  formatBytes,
  formatPercent,
  summarize,
  toCsv,
  toRows
} from '../report'
import { useReportConfig } from '../config'
import { ReportData, buildMarkdown, downloadBlob, reportFileName } from '../export'
import { normalizeFolder, saveToSpace, withTime } from '../save'

type SortKey = 'kind' | 'name' | 'owner' | 'used' | 'quota' | 'ratio' | 'lastModified'

const { $gettext } = useGettext()
const authStore = useAuthStore()
const configStore = useConfigStore()
const capabilityStore = useCapabilityStore()
const { can } = useAbility()
const reportConfig = useReportConfig()
const userStore = useUserStore()
const { showMessage, showErrorMessage } = useMessages()
const clientService = useClientService()
const spacesStore = useSpacesStore()

const threshold = computed(() => reportConfig.thresholdPercent / 100)
const thresholdPercent = computed(() => reportConfig.thresholdPercent)

const loading = ref(false)
const error = ref<string | null>(null)
const rows = ref<SpaceRow[]>([])
const vaultStatus = ref<'ok' | 'disabled' | 'mfa-required' | 'error'>('disabled')
const generatedAt = ref<Date | null>(null)
const orphanStatus = ref<'pending' | 'running' | 'ok' | 'skipped' | 'error'>('pending')
const orphanUnverified = ref(0)

const canSeeForeignPersonal = computed(() => can('read-all', 'Account'))
const serverHost = computed(() => {
  try {
    return new URL(configStore.serverUrl).host
  } catch {
    return configStore.serverUrl
  }
})

let controller: AbortController | undefined

const load = async () => {
  controller?.abort()
  controller = new AbortController()
  const { signal } = controller
  const common = { serverUrl: configStore.serverUrl, accessToken: authStore.accessToken, signal }

  loading.value = true
  error.value = null
  try {
    const [personal, project] = await Promise.all([
      fetchDrives({ ...common, driveType: 'personal' }),
      fetchDrives({ ...common, driveType: 'project' })
    ])
    let vaultRows: SpaceRow[] = []
    if (capabilityStore.vaultEnabled) {
      try {
        const [vp, vpr] = await Promise.all([
          fetchDrives({ ...common, driveType: 'personal', vault: true }),
          fetchDrives({ ...common, driveType: 'project', vault: true })
        ])
        vaultRows = [...toRows(vp, true), ...toRows(vpr, true)]
        vaultStatus.value = 'ok'
      } catch (e) {
        if (signal.aborted) return
        vaultStatus.value =
          e instanceof GraphError && (e.mfaRequired || e.status === 401 || e.status === 403)
            ? 'mfa-required'
            : 'error'
        console.warn('[space-report] vault spaces', e)
      }
    } else {
      vaultStatus.value = 'disabled'
    }
    rows.value = [...toRows(personal), ...toRows(project), ...vaultRows]
    generatedAt.value = new Date()
    loading.value = false
    await runOrphanAnalysis(signal)
  } catch (e) {
    if (signal.aborted) return
    console.error('[space-report]', e)
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

/** Cross-checks owners and members against the user/group backend (admins only). */
const runOrphanAnalysis = async (signal: AbortSignal) => {
  orphanUnverified.value = 0
  if (!unref(canSeeForeignPersonal)) {
    orphanStatus.value = 'skipped'
    return
  }
  orphanStatus.value = 'running'
  const { serverUrl } = configStore
  const token = authStore.accessToken
  try {
    const [users, groups] = await Promise.all([
      fetchUsers(serverUrl, token, signal),
      // without the group list, group memberships are treated as "unknown", never as orphaned
      fetchGroups(serverUrl, token, signal).catch((e) => {
        console.warn('[space-report] groups', e)
        return null
      })
    ])
    const result = await analyzeOrphans({
      rows: unref(rows),
      users,
      groups,
      lookups: {
        userExists: (id) => exists(serverUrl, token, 'users', id, signal),
        groupExists: (id) => exists(serverUrl, token, 'groups', id, signal)
      }
    })
    if (signal.aborted) return
    rows.value = result.rows
    orphanUnverified.value = result.unverified
    orphanStatus.value = 'ok'
  } catch (e) {
    if (signal.aborted) return
    console.error('[space-report] orphan analysis', e)
    orphanStatus.value = 'error'
  }
}

onMounted(load)

const orphanSummary = computed(() => summarizeOrphans(unref(rows)))
const orphanRows = computed(() =>
  unref(rows)
    .filter((r) => r.orphan)
    .sort((a, b) => b.used - a.used)
)
const orphanLabel = (r: SpaceRow) =>
  r.orphan
    ? {
        'owner-missing': $gettext('Owner no longer exists'),
        'no-members': $gettext('No members'),
        'members-gone': $gettext('All members deleted or empty groups')
      }[r.orphan] || ORPHAN_LABEL[r.orphan]
    : ''

// ---- summary --------------------------------------------------------------------------------

const summary = computed(() => summarize(unref(rows), unref(threshold), reportConfig.topN))
const vaultCount = computed(
  () => summary.value.byKind['vault-personal'].count + summary.value.byKind['vault-project'].count
)
const vaultUsed = computed(
  () => summary.value.byKind['vault-personal'].used + summary.value.byKind['vault-project'].used
)
const personalUsages = computed(() =>
  unref(rows)
    .filter((r) => r.kind === 'personal')
    .map((r) => r.used)
    .sort((a, b) => a - b)
)
const avgPersonal = computed(() => {
  const u = unref(personalUsages)
  return u.length ? u.reduce((a, b) => a + b, 0) / u.length : 0
})
const medianPersonal = computed(() => {
  const u = unref(personalUsages)
  if (!u.length) return 0
  const mid = Math.floor(u.length / 2)
  return u.length % 2 ? u[mid] : (u[mid - 1] + u[mid]) / 2
})
const maxUsed = computed(() => summary.value.largest[0]?.used || 0)
const barWidth = (value: number, max: number) =>
  `${max ? Math.max(1, Math.min(100, (value / max) * 100)) : 0}%`

// ---- table ----------------------------------------------------------------------------------

const kindLabel = (k: SpaceKind) =>
  ({
    personal: $gettext('Personal'),
    project: $gettext('Project'),
    'vault-personal': $gettext('Vault personal'),
    'vault-project': $gettext('Vault project')
  })[k]

const kindFilter = ref<'all' | 'personal' | 'project' | 'vault' | 'orphaned'>('all')
const kindFilters = computed(() => [
  { value: 'all' as const, label: $gettext('All') },
  { value: 'personal' as const, label: $gettext('Personal') },
  { value: 'project' as const, label: $gettext('Project') },
  ...(unref(vaultStatus) === 'ok' ? [{ value: 'vault' as const, label: $gettext('Vault') }] : []),
  ...(unref(orphanStatus) === 'ok'
    ? [{ value: 'orphaned' as const, label: $gettext('Orphaned') }]
    : [])
])

const search = ref('')
const sortKey = ref<SortKey>('used')
const sortDir = ref<'asc' | 'desc'>('desc')
const limit = ref(200)

const columns = computed<{ key: SortKey; label: string; class?: string }[]>(() => [
  { key: 'kind', label: $gettext('Type') },
  { key: 'name', label: $gettext('Name') },
  { key: 'owner', label: $gettext('Owner') },
  { key: 'used', label: $gettext('Used'), class: 'space-report-num' },
  { key: 'quota', label: $gettext('Quota'), class: 'space-report-num' },
  { key: 'ratio', label: $gettext('Full'), class: 'space-report-num' },
  { key: 'lastModified', label: $gettext('Last modified'), class: 'space-report-num' }
])

const sortBy = (key: SortKey) => {
  if (unref(sortKey) === key) {
    sortDir.value = unref(sortDir) === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = ['used', 'quota', 'ratio', 'lastModified'].includes(key) ? 'desc' : 'asc'
  }
}

const filteredRows = computed(() => {
  const q = unref(search).trim().toLowerCase()
  const kind = unref(kindFilter)
  const key = unref(sortKey)
  const dir = unref(sortDir) === 'asc' ? 1 : -1
  return unref(rows)
    .filter((r) => {
      if (kind === 'vault' && !r.kind.startsWith('vault-')) return false
      if (kind === 'orphaned' && !r.orphan) return false
      if ((kind === 'personal' || kind === 'project') && r.kind !== kind) return false
      return !q || r.name.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const va = a[key] ?? (key === 'ratio' ? -1 : '')
      const vb = b[key] ?? (key === 'ratio' ? -1 : '')
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb)) * dir
    })
})
watch([search, kindFilter], () => (limit.value = 200))
const visibleRows = computed(() => unref(filteredRows).slice(0, unref(limit)))
const filteredUsed = computed(() => unref(filteredRows).reduce((a, r) => a + r.used, 0))

// ---- export ---------------------------------------------------------------------------------

const downloadCsv = () => {
  const blob = new Blob([toCsv(unref(filteredRows))], { type: 'text/csv;charset=utf-8' })
  downloadBlob(
    blob,
    `space-report-${serverHost.value}-${new Date().toISOString().slice(0, 10)}.csv`
  )
}

/** Markdown/PDF always cover all spaces (not the current filter), like a status report should. */
const reportData = (): ReportData => ({
  meta: {
    server: unref(serverHost),
    generatedAt: unref(generatedAt) || new Date(),
    generatedBy: userStore.user?.displayName || userStore.user?.onPremisesSamAccountName || '',
    thresholdPercent: unref(thresholdPercent),
    vault: unref(vaultStatus),
    complete: unref(canSeeForeignPersonal),
    orphans: unref(orphanStatus),
    orphansUnverified: unref(orphanUnverified)
  },
  summary: unref(summary),
  rows: unref(rows)
})

const downloadMarkdown = () => {
  const data = reportData()
  const blob = new Blob([buildMarkdown(data)], { type: 'text/markdown;charset=utf-8' })
  downloadBlob(blob, reportFileName(data.meta, 'md'))
}

const personalSpace = computed(() => spacesStore.personalSpace)
const saveFolderLabel = computed(() => {
  const folder = normalizeFolder(reportConfig.saveFolder)
  return `${$gettext('Personal')}/${folder}`.replace(/\/$/, '')
})

const saving = ref(false)
const saveReport = async (format: 'pdf' | 'md') => {
  const space = unref(personalSpace)
  if (!space) return
  saving.value = true
  try {
    const data = reportData()
    let content: string | ArrayBuffer
    if (format === 'pdf') {
      const { buildPdf } = await import('../pdf')
      content = await buildPdf(data).arrayBuffer()
    } else {
      content = buildMarkdown(data)
    }
    const path = await saveToSpace({
      webdav: clientService.webdav as any,
      space,
      folder: reportConfig.saveFolder,
      fileName: withTime(reportFileName(data.meta, format), new Date()),
      content
    })
    showMessage({
      title: $gettext('Report saved'),
      desc: `${$gettext('Personal')}${path}`
    })
  } catch (e) {
    console.error('[space-report] save', e)
    showErrorMessage({ title: $gettext('Saving the report failed'), errors: [e as Error] })
  } finally {
    saving.value = false
  }
}

const exporting = ref(false)
const downloadPdf = async () => {
  exporting.value = true
  try {
    // jsPDF is only loaded when needed
    const { buildPdf } = await import('../pdf')
    const data = reportData()
    downloadBlob(buildPdf(data), reportFileName(data.meta, 'pdf'))
  } catch (e) {
    console.error('[space-report] pdf', e)
    showErrorMessage({ title: $gettext('Creating the PDF failed'), errors: [e as Error] })
  } finally {
    exporting.value = false
  }
}

const print = () => {
  // print everything, not only the rows loaded so far
  limit.value = Number.MAX_SAFE_INTEGER
  setTimeout(() => window.print(), 50)
}
</script>

<style>
/* print only the report, not the Web chrome (unscoped on purpose) */
@media print {
  body * {
    visibility: hidden !important;
  }
  #space-report,
  #space-report * {
    visibility: visible !important;
  }
  #space-report {
    position: absolute;
    inset: 0 auto auto 0;
    width: 100%;
    overflow: visible !important;
  }
  #space-report .no-print {
    display: none !important;
  }
}
</style>

<style scoped>
.space-report {
  overflow-y: auto;
  height: 100%;
  box-sizing: border-box;
}
.space-report-header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
  align-items: flex-end;
}
.space-report-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.space-report-menu {
  list-style: none;
  margin: 0;
  padding: 0;
}
.space-report-menu li {
  padding: 0.25rem 0.25rem;
}
.space-report-notice {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--oc-role-outline-variant, #ccc);
}
.space-report-notice-error {
  border-color: var(--oc-role-error, #c62828);
}
.space-report-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 0.75rem;
}
.space-report-tile {
  border: 1px solid var(--oc-role-outline-variant, #ddd);
  border-radius: 8px;
  padding: 0.75rem 1rem;
}
.space-report-tile-warn {
  border-color: var(--oc-role-error, #c62828);
}
.space-report-tile-label {
  font-size: 0.85rem;
  opacity: 0.75;
}
.space-report-tile-value {
  font-size: 1.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}
.space-report-tile-sub {
  font-size: 0.8rem;
  opacity: 0.75;
}
.space-report-tops {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
}
.space-report-bars {
  list-style: none;
  margin: 0;
  padding: 0;
}
.space-report-bars li {
  margin-bottom: 0.5rem;
}
.space-report-bar-label {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.85rem;
}
.space-report-bar-track {
  height: 6px;
  border-radius: 3px;
  background: var(--oc-role-surface-container-high, #eee);
  overflow: hidden;
}
.space-report-bar {
  height: 100%;
  background: var(--oc-role-primary, #4a76b8);
}
.space-report-bar-warn {
  background: var(--oc-role-error, #c62828);
}
.space-report-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.5rem;
}
.space-report-search {
  margin-left: auto;
  min-width: 240px;
}
.space-report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.space-report-table th,
.space-report-table td {
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--oc-role-outline-variant, #e5e5e5);
  text-align: left;
}
.space-report-table tfoot td {
  font-weight: 600;
  border-bottom: none;
}
.space-report-sort {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: inherit;
  cursor: pointer;
}
.space-report-num {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.space-report-warn-text {
  color: var(--oc-role-error, #c62828);
  font-weight: 600;
}
.space-report-badge {
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  font-size: 0.75rem;
  background: var(--oc-role-error, #c62828);
  color: var(--oc-role-on-error, #fff);
}
.space-report-badge-soft {
  background: var(--oc-role-surface-container-high, #eee);
  color: inherit;
}
.space-report-hints {
  margin: 0;
  padding-left: 1.2rem;
}
.space-report-row-disabled {
  opacity: 0.6;
}
</style>
