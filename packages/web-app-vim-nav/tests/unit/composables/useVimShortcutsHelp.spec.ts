import { describe, it, expect } from 'vitest'
import { defaultComponentMocks, defaultPlugins, mount } from '@ownclouders/web-test-helpers'
import { useModals } from '@ownclouders/web-pkg'
import { useVimShortcutsHelp } from '../../../src/composables/useVimShortcutsHelp'
import { defineComponent, h } from 'vue'

function setup() {
  const mocks = defaultComponentMocks()
  let modalsStore: ReturnType<typeof useModals>
  let shortcutsHelp: ReturnType<typeof useVimShortcutsHelp>

  const Wrapper = defineComponent({
    setup() {
      modalsStore = useModals()
      shortcutsHelp = useVimShortcutsHelp()
      return () => h('div')
    }
  })

  mount(Wrapper, {
    global: {
      plugins: [...defaultPlugins({ piniaOptions: { stubActions: false } })],
      mocks,
      provide: mocks
    }
  })

  return { modalsStore, shortcutsHelp }
}

describe('useVimShortcutsHelp', () => {
  it('dispatches a modal when showShortcutsHelp is called', () => {
    const { modalsStore, shortcutsHelp } = setup()

    shortcutsHelp.showShortcutsHelp()

    expect(modalsStore.modals).toHaveLength(1)
  })

  it('the modal has hideActions set so no confirm/cancel buttons appear', () => {
    const { modalsStore, shortcutsHelp } = setup()

    shortcutsHelp.showShortcutsHelp()

    expect(modalsStore.modals[0].hideActions).toBe(true)
  })

  it('the modal uses a custom component for its content', () => {
    const { modalsStore, shortcutsHelp } = setup()

    shortcutsHelp.showShortcutsHelp()

    expect(modalsStore.modals[0].customComponent).toBeDefined()
  })
})
