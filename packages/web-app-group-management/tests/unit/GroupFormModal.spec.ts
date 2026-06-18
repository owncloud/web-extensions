import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({
    $gettext: (s: string, params?: Record<string, unknown>) =>
      params ? s.replace(/%\{(\w+)\}/g, (_, k) => String(params[k] ?? '')) : s
  })
}))

const showMessage = vi.fn()
const showErrorMessage = vi.fn()
vi.mock('@ownclouders/web-pkg', () => ({
  useMessages: () => ({ showMessage, showErrorMessage })
}))

vi.mock('../../src/composables/useGroupManagement', () => ({
  useGroupManagement: vi.fn()
}))

import GroupFormModal from '../../src/components/GroupFormModal.vue'
import { useGroupManagement } from '../../src/composables/useGroupManagement'

const api = {
  createGroup: vi.fn().mockResolvedValue({ id: 'g-new', displayName: 'NewGroup' }),
  editGroup: vi.fn().mockResolvedValue(undefined),
  getGroup: vi.fn().mockResolvedValue({ id: 'g1', displayName: 'Renamed' })
}

const OcTextInputStub = {
  props: ['modelValue', 'label', 'errorMessage'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
}

function createWrapper(props: Record<string, unknown> = {}) {
  return mount(GroupFormModal, {
    props: { modal: {} as any, ...props },
    global: { stubs: { OcTextInput: OcTextInputStub } }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useGroupManagement).mockReturnValue(api as any)
})

describe('GroupFormModal', () => {
  it('disables confirm while the name is empty (create mode)', () => {
    const wrapper = createWrapper()
    const emitted = wrapper.emitted('update:confirmDisabled')
    expect(emitted?.at(-1)).toEqual([true])
  })

  it('enables confirm once a valid name is entered and creates the group', async () => {
    const onSaved = vi.fn()
    const created = { id: 'g-new', displayName: 'NewGroup', description: '' }
    api.getGroup.mockResolvedValueOnce(created)
    const wrapper = createWrapper({ onSaved })

    await wrapper.find('#group-management-input-display-name').setValue('NewGroup')
    expect(wrapper.emitted('update:confirmDisabled')?.at(-1)).toEqual([false])

    await (wrapper.vm as any).onConfirm()
    await flushPromises()

    expect(api.createGroup).toHaveBeenCalledWith('NewGroup')
    // create response is re-fetched for the canonical group (members)
    expect(api.getGroup).toHaveBeenCalledWith('g-new')
    expect(api.editGroup).not.toHaveBeenCalled()
    expect(showMessage).toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledWith(created)
  })

  it('renames an existing group and reports the refreshed group', async () => {
    const onSaved = vi.fn()
    const wrapper = createWrapper({
      group: { id: 'g1', displayName: 'Old' },
      onSaved
    })

    // edit mode starts valid (prefilled name)
    expect(wrapper.emitted('update:confirmDisabled')?.at(-1)).toEqual([false])

    await wrapper.find('#group-management-input-display-name').setValue('Renamed')
    await (wrapper.vm as any).onConfirm()
    await flushPromises()

    expect(api.editGroup).toHaveBeenCalledWith('g1', 'Renamed')
    expect(api.getGroup).toHaveBeenCalledWith('g1')
    expect(api.createGroup).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledWith({ id: 'g1', displayName: 'Renamed' })
  })

  it('rejects and does not call the API when the name is invalid', async () => {
    const wrapper = createWrapper()
    await expect((wrapper.vm as any).onConfirm()).rejects.toBeUndefined()
    expect(api.createGroup).not.toHaveBeenCalled()
  })
})
