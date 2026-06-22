<template>
  <form autocomplete="off" @submit.prevent="onConfirm">
    <oc-text-input
      id="group-management-input-display-name"
      v-model="displayName"
      class="oc-mb-s"
      :label="$gettext('Group name') + ' *'"
      :error-message="displayNameError"
      :fix-message-line="true"
      @update:model-value="validate"
    />
    <input type="submit" class="oc-hidden" />
  </form>
</template>

<script setup lang="ts">
import { computed, ref, unref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import { Modal, useMessages } from '@ownclouders/web-pkg'
import { Group } from '@ownclouders/web-client/graph/generated'
import { useGroupManagement } from '../composables/useGroupManagement'

const props = defineProps<{
  modal: Modal
  group?: Group
  onSaved?: (group: Group) => void
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'update:confirmDisabled', value: boolean): void
}>()

const { $gettext } = useGettext()
const { showMessage, showErrorMessage } = useMessages()
const { createGroup, editGroup, getGroup } = useGroupManagement()

const isEdit = computed(() => !!props.group?.id)

const displayName = ref(props.group?.displayName ?? '')
const displayNameError = ref('')

const validate = () => {
  const name = unref(displayName).trim()
  if (!name) {
    displayNameError.value = $gettext('Group name cannot be empty')
    return false
  }
  if (name.length > 255) {
    displayNameError.value = $gettext('Group name cannot exceed 255 characters')
    return false
  }
  displayNameError.value = ''
  return true
}

watch(
  displayName,
  () => {
    emit('update:confirmDisabled', !validate())
  },
  { immediate: true }
)

const onConfirm = async () => {
  if (!validate()) {
    return Promise.reject()
  }
  const name = unref(displayName).trim()
  const editing = unref(isEdit)
  // Capture the group identity before any await: the parent can unmount the
  // modal (clearing `props.group`) during the async mutation, so a later
  // `props.group.id` access would throw.
  const original = props.group
  const groupId = original?.id

  let mutated: Group
  try {
    if (editing) {
      await editGroup(groupId as string, name)
      mutated = { ...(original as Group), id: groupId as string, displayName: name }
    } else {
      mutated = await createGroup(name)
    }
  } catch (error) {
    console.error(error)
    showErrorMessage({
      title: editing ? $gettext('Failed to save group') : $gettext('Failed to create group'),
      errors: [error]
    })
    return
  }

  // The mutation succeeded on the server: confirm to the user and notify the
  // parent now, independently of the canonical re-fetch below. Otherwise a
  // transient re-fetch failure would show a false error and skip onSaved even
  // though the group was actually saved.
  showMessage({
    title: editing
      ? $gettext('Group "%{group}" was saved', { group: name })
      : $gettext('Group "%{group}" was created', { group: name })
  })

  try {
    const full = await getGroup(mutated.id)
    props.onSaved?.(full)
  } catch (error) {
    // Re-fetch failed but the save itself succeeded; hand back the best-known
    // group so the list still updates (it refreshes fully on the next load).
    console.error(error)
    props.onSaved?.(mutated)
  }
}

defineExpose({ onConfirm })
</script>
