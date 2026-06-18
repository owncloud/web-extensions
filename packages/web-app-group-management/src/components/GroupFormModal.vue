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
  try {
    if (unref(isEdit)) {
      await editGroup(props.group.id, name)
      const updated = await getGroup(props.group.id)
      showMessage({ title: $gettext('Group "%{group}" was saved', { group: name }) })
      props.onSaved?.(updated)
    } else {
      const created = await createGroup(name)
      // Re-fetch the canonical group (with members) before handing it back.
      const full = await getGroup(created.id)
      showMessage({ title: $gettext('Group "%{group}" was created', { group: name }) })
      props.onSaved?.(full)
    }
  } catch (error) {
    console.error(error)
    showErrorMessage({
      title: unref(isEdit)
        ? $gettext('Failed to save group')
        : $gettext('Failed to create group'),
      errors: [error]
    })
  }
}

defineExpose({ onConfirm })
</script>
