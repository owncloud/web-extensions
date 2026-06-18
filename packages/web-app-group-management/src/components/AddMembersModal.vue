<template>
  <div class="group-management-add-members">
    <oc-select
      :model-value="selectedUsers"
      :multiple="true"
      :options="userOptions"
      option-label="displayName"
      :loading="searching"
      :label="$gettext('Users')"
      :fix-message-line="true"
      :placeholder="$gettext('Search users...')"
      :filter="serverSideFilter"
      @update:model-value="onSelect"
      @search:input="onSearch"
    >
      <template #option="{ displayName, mail }">
        <span class="oc-text-truncate">{{ displayName }}</span>
        <span v-if="mail" class="oc-text-muted oc-ml-s">{{ mail }}</span>
      </template>
      <template #no-options>{{ $gettext('No users found') }}</template>
    </oc-select>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, unref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import { Modal, useMessages } from '@ownclouders/web-pkg'
import { Group, User } from '@ownclouders/web-client/graph/generated'
import { useGroupManagement } from '../composables/useGroupManagement'

const props = defineProps<{
  modal: Modal
  group: Group
  onSaved?: (group: Group) => void
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'update:confirmDisabled', value: boolean): void
}>()

const { $gettext, $ngettext } = useGettext()
const { showMessage, showErrorMessage } = useMessages()
const { searchUsers, addMembers, getGroup } = useGroupManagement()

const selectedUsers = ref<User[]>([])
const userOptions = ref<User[]>([])
const searching = ref(false)

let searchTimeout: ReturnType<typeof setTimeout> | null = null

const existingMemberIds = () => new Set((props.group.members ?? []).map((m) => m.id))

// The user list is already filtered server-side via $search; returning the
// options unchanged disables oc-select's default client-side (Fuse) filter,
// which would otherwise hide users matched only by mail or username.
const serverSideFilter = (users: User[]) => users

const runSearch = async (query: string) => {
  searching.value = true
  try {
    const members = existingMemberIds()
    const selected = new Set(unref(selectedUsers).map((u) => u.id))
    const users = await searchUsers(query)
    userOptions.value = users.filter((u) => !members.has(u.id) && !selected.has(u.id))
  } catch (error) {
    console.error(error)
    userOptions.value = []
  } finally {
    searching.value = false
  }
}

const onSearch = (query: string) => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(() => runSearch(query), 250)
}

const onSelect = (users: User[]) => {
  selectedUsers.value = users
}

watch(
  selectedUsers,
  () => {
    emit('update:confirmDisabled', unref(selectedUsers).length === 0)
  },
  { immediate: true }
)

onMounted(() => runSearch(''))

const onConfirm = async () => {
  const users = unref(selectedUsers)
  if (!users.length) {
    return Promise.reject()
  }

  const { succeeded, failed } = await addMembers(
    props.group,
    users.map((u) => u.id)
  )

  if (succeeded.length) {
    showMessage({
      title: $ngettext(
        '%{count} member was added',
        '%{count} members were added',
        succeeded.length,
        { count: succeeded.length.toString() }
      )
    })
  }
  if (failed.length) {
    showErrorMessage({
      title: $ngettext(
        'Failed to add %{count} member',
        'Failed to add %{count} members',
        failed.length,
        { count: failed.length.toString() }
      ),
      errors: failed.map((f) => f.reason)
    })
  }

  try {
    const updated = await getGroup(props.group.id)
    props.onSaved?.(updated)
  } catch (error) {
    console.error(error)
  }
}

defineExpose({ onConfirm })
</script>

<style scoped>
.group-management-add-members {
  min-height: 12rem;
}
</style>
