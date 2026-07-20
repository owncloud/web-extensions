import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({ $gettext: (s: string) => s })
}))

import OverwriteDialog from '../../src/components/OverwriteDialog.vue'

describe('OverwriteDialog', () => {
  it('renders the cancel button', () => {
    const wrapper = mount(OverwriteDialog)
    const cancel = wrapper.find('.oc-folder-readme-overwrite-dialog-cancel')
    expect(cancel.exists()).toBe(true)
    expect(cancel.text()).toBe('Cancel')
  })

  it('renders the confirm button', () => {
    const wrapper = mount(OverwriteDialog)
    const confirm = wrapper.find('.oc-folder-readme-overwrite-dialog-confirm')
    expect(confirm.exists()).toBe(true)
    expect(confirm.text()).toBe('Overwrite')
  })

  it('renders the title and explanatory copy', () => {
    const wrapper = mount(OverwriteDialog)
    expect(wrapper.find('.oc-folder-readme-overwrite-dialog-title').text()).toBe(
      'README already exists'
    )
    expect(wrapper.text()).toContain('Do you want to overwrite it?')
  })

  it('emits "cancel" and not "confirm" when the cancel button is clicked', async () => {
    const wrapper = mount(OverwriteDialog)
    await wrapper.find('.oc-folder-readme-overwrite-dialog-cancel').trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('emits "confirm" and not "cancel" when the confirm button is clicked', async () => {
    const wrapper = mount(OverwriteDialog)
    await wrapper.find('.oc-folder-readme-overwrite-dialog-confirm').trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toBeUndefined()
  })
})
