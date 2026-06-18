<template>
  <div
    class="group-management"
    role="main"
    :aria-label="$gettext('Group Management')"
    data-testid="group-management-view"
  >
    <div class="group-management-sidebar">
      <div class="group-management-sidebar-header">
        <oc-text-input
          v-model="searchTerm"
          class="group-management-search"
          :label="$gettext('Search groups')"
          @update:model-value="onSearch"
        />
        <oc-button
          variation="primary"
          appearance="filled"
          data-testid="group-management-create"
          :aria-label="$gettext('Create group')"
          @click="openCreateGroup"
        >
          <oc-icon name="add" />
          <span>{{ $gettext('Create group') }}</span>
        </oc-button>
      </div>

      <div v-if="loading" class="group-management-placeholder">
        <oc-spinner :aria-label="$gettext('Loading groups...')" />
      </div>
      <ul v-else-if="groups.length" class="group-management-list" :aria-label="$gettext('Groups')">
        <li
          v-for="group in groups"
          :key="group.id"
          :class="['group-management-list-item', { 'is-selected': group.id === selectedGroupId }]"
        >
          <button
            type="button"
            class="group-management-list-select"
            data-testid="group-management-group-row"
            @click="selectGroup(group.id)"
          >
            <oc-icon name="group-2" class="oc-mr-s" />
            <span class="oc-text-truncate">{{ group.displayName }}</span>
            <span class="group-management-member-count">{{ memberCount(group) }}</span>
          </button>
          <span v-if="isReadOnly(group)" class="group-management-readonly-badge">
            {{ $gettext('Read-only') }}
          </span>
        </li>
      </ul>
      <div v-else class="group-management-placeholder">
        <p>{{ $gettext('No groups found') }}</p>
      </div>
    </div>

    <div class="group-management-detail">
      <template v-if="selectedGroup">
        <div class="group-management-detail-header">
          <h2 class="oc-text-truncate">{{ selectedGroup.displayName }}</h2>
          <div class="group-management-detail-actions">
            <oc-button
              :disabled="isReadOnly(selectedGroup)"
              :aria-label="$gettext('Edit group')"
              @click="openEditGroup(selectedGroup)"
            >
              <oc-icon name="pencil" />
              <span>{{ $gettext('Edit') }}</span>
            </oc-button>
            <oc-button
              :disabled="isReadOnly(selectedGroup)"
              :aria-label="$gettext('Delete group')"
              @click="openDeleteGroup(selectedGroup)"
            >
              <oc-icon name="delete-bin" />
              <span>{{ $gettext('Delete') }}</span>
            </oc-button>
          </div>
        </div>

        <div class="group-management-members">
          <div class="group-management-members-header">
            <h3>{{ $gettext('Members') }} ({{ memberCount(selectedGroup) }})</h3>
            <oc-button
              variation="primary"
              appearance="filled"
              :disabled="isReadOnly(selectedGroup)"
              :aria-label="$gettext('Add members')"
              @click="openAddMembers(selectedGroup)"
            >
              <oc-icon name="user-add" />
              <span>{{ $gettext('Add members') }}</span>
            </oc-button>
          </div>

          <ul v-if="memberCount(selectedGroup)" class="group-management-member-list">
            <li
              v-for="member in selectedGroup.members"
              :key="member.id"
              class="group-management-member"
            >
              <oc-icon name="user" class="oc-mr-s" />
              <span class="oc-text-truncate group-management-member-name">
                {{ member.displayName }}
              </span>
              <span v-if="member.mail" class="oc-text-muted oc-text-truncate">{{ member.mail }}</span>
              <oc-button
                appearance="raw"
                class="group-management-member-remove"
                :disabled="isReadOnly(selectedGroup)"
                :aria-label="$gettext('Remove member')"
                @click="openRemoveMember(selectedGroup, member)"
              >
                <oc-icon name="close" />
              </oc-button>
            </li>
          </ul>
          <p v-else class="is-muted">{{ $gettext('This group has no members yet.') }}</p>
        </div>
      </template>
      <div v-else class="group-management-empty">
        <oc-icon name="group-2" size="xlarge" />
        <p>{{ $gettext('Select a group to view its details and members.') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useMessages, useModals } from '@ownclouders/web-pkg'
import { Group, User } from '@ownclouders/web-client/graph/generated'
import { useGroupManagement } from '../composables/useGroupManagement'
import GroupFormModal from '../components/GroupFormModal.vue'
import AddMembersModal from '../components/AddMembersModal.vue'

const { $gettext } = useGettext()
const { showMessage, showErrorMessage } = useMessages()
const { dispatchModal } = useModals()
const { listGroups, deleteGroup, removeMember, getGroup, isReadOnly, memberCount } =
  useGroupManagement()

const groups = ref<Group[]>([])
const loading = ref(true)
const selectedGroupId = ref<string | null>(null)
const searchTerm = ref('')

const selectedGroup = computed(
  () => unref(groups).find((g) => g.id === unref(selectedGroupId)) ?? null
)

let searchTimeout: ReturnType<typeof setTimeout> | null = null

const loadGroups = async (search = '') => {
  loading.value = true
  try {
    groups.value = await listGroups(search)
    if (unref(selectedGroupId) && !unref(selectedGroup)) {
      selectedGroupId.value = null
    }
  } catch (error) {
    console.error(error)
    showErrorMessage({ title: $gettext('Failed to load groups'), errors: [error] })
    groups.value = []
  } finally {
    loading.value = false
  }
}

const onSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(() => loadGroups(unref(searchTerm).trim()), 300)
}

const selectGroup = async (id: string) => {
  selectedGroupId.value = id
  // The list endpoint returns a lightweight projection; fetch the full group
  // (description + members) for the detail panel.
  try {
    upsertGroup(await getGroup(id))
  } catch (error) {
    console.error(error)
  }
}

const upsertGroup = (group: Group) => {
  const index = unref(groups).findIndex((g) => g.id === group.id)
  if (index === -1) {
    groups.value = [...unref(groups), group].sort((a, b) =>
      (a.displayName ?? '').localeCompare(b.displayName ?? '')
    )
  } else {
    const next = [...unref(groups)]
    next[index] = group
    groups.value = next
  }
  selectedGroupId.value = group.id
}

const openCreateGroup = () => {
  dispatchModal({
    title: $gettext('Create group'),
    confirmText: $gettext('Create'),
    customComponent: GroupFormModal,
    customComponentAttrs: () => ({ onSaved: upsertGroup })
  })
}

const openEditGroup = (group: Group) => {
  dispatchModal({
    title: $gettext('Edit group'),
    confirmText: $gettext('Save'),
    customComponent: GroupFormModal,
    customComponentAttrs: () => ({ group, onSaved: upsertGroup })
  })
}

const openAddMembers = (group: Group) => {
  dispatchModal({
    title: $gettext('Add members to "%{group}"', { group: group.displayName }),
    confirmText: $gettext('Add'),
    customComponent: AddMembersModal,
    customComponentAttrs: () => ({ group, onSaved: upsertGroup })
  })
}

const deleteGroupConfirmed = async (group: Group) => {
  try {
    await deleteGroup(group.id)
    showMessage({ title: $gettext('Group "%{group}" was deleted', { group: group.displayName }) })
    groups.value = unref(groups).filter((g) => g.id !== group.id)
    if (unref(selectedGroupId) === group.id) {
      selectedGroupId.value = null
    }
  } catch (error) {
    console.error(error)
    showErrorMessage({
      title: $gettext('Failed to delete group "%{group}"', { group: group.displayName }),
      errors: [error]
    })
  }
}

const openDeleteGroup = (group: Group) => {
  dispatchModal({
    variation: 'danger',
    title: $gettext('Delete group "%{group}"?', { group: group.displayName }),
    confirmText: $gettext('Delete'),
    message: $gettext(
      'Are you sure you want to delete this group? Members will lose any access granted through it. This cannot be undone.'
    ),
    onConfirm: () => deleteGroupConfirmed(group)
  })
}

const removeMemberConfirmed = async (group: Group, member: User) => {
  try {
    await removeMember(group.id, member.id)
    showMessage({
      title: $gettext('"%{member}" was removed from "%{group}"', {
        member: member.displayName,
        group: group.displayName
      })
    })
    const updated = await getGroup(group.id)
    upsertGroup(updated)
  } catch (error) {
    console.error(error)
    showErrorMessage({
      title: $gettext('Failed to remove "%{member}"', { member: member.displayName }),
      errors: [error]
    })
  }
}

const openRemoveMember = (group: Group, member: User) => {
  dispatchModal({
    variation: 'danger',
    title: $gettext('Remove "%{member}"?', { member: member.displayName }),
    confirmText: $gettext('Remove'),
    message: $gettext('Remove "%{member}" from "%{group}"?', {
      member: member.displayName,
      group: group.displayName
    }),
    onConfirm: () => removeMemberConfirmed(group, member)
  })
}

onMounted(() => loadGroups())
</script>

<style scoped>
.group-management {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.group-management-sidebar {
  width: 340px;
  min-width: 280px;
  border-right: 1px solid var(--oc-color-border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.group-management-sidebar-header {
  display: flex;
  flex-direction: column;
  gap: var(--oc-space-small);
  padding: var(--oc-space-medium);
  border-bottom: 1px solid var(--oc-color-border);
}

.group-management-list {
  list-style: none;
  margin: 0;
  padding: var(--oc-space-small);
}

.group-management-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-small);
  border-radius: 5px;
}

.group-management-list-item.is-selected {
  background-color: var(--oc-color-background-highlight);
}

.group-management-list-select {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--oc-space-xsmall);
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: var(--oc-space-small);
  text-align: left;
  color: var(--oc-color-text-default);
  min-width: 0;
}

.group-management-member-count {
  margin-left: auto;
  color: var(--oc-color-text-muted);
  font-size: 0.875rem;
}

.group-management-readonly-badge {
  font-size: 0.75rem;
  color: var(--oc-color-text-muted);
  padding-right: var(--oc-space-small);
}

.group-management-detail {
  flex: 1;
  overflow-y: auto;
  padding: var(--oc-space-medium);
}

.group-management-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-small);
}

.group-management-detail-actions {
  display: flex;
  gap: var(--oc-space-small);
}

.group-management-members-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-small);
  margin-bottom: var(--oc-space-small);
}

.group-management-member-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.group-management-member {
  display: flex;
  align-items: center;
  gap: var(--oc-space-small);
  padding: var(--oc-space-small) 0;
  border-bottom: 1px solid var(--oc-color-border);
}

.group-management-member-name {
  font-weight: 600;
}

.group-management-member-remove {
  margin-left: auto;
}

.group-management-empty,
.group-management-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--oc-space-medium);
  height: 100%;
  color: var(--oc-color-text-muted);
  text-align: center;
}

.is-muted {
  color: var(--oc-color-text-muted);
}
</style>
