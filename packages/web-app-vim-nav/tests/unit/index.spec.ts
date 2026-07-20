import { describe, it, expect } from 'vitest'
import { defaultComponentMocks, defaultPlugins, mount } from '@ownclouders/web-test-helpers'
import { defineComponent, h } from 'vue'
import app from '../../src/index'

function mountApp() {
  const mocks = defaultComponentMocks()
  let result: ReturnType<Required<typeof app>['setup']>
  const Wrapper = defineComponent({
    setup() {
      result = app.setup({ applicationConfig: {} })
      return () => h('div')
    }
  })
  mount(Wrapper, { global: { plugins: [...defaultPlugins()], mocks, provide: mocks } })
  return result
}

describe('web-app-vim-nav entry point', () => {
  it('exposes an appInfo with id vim-nav', () => {
    const result = mountApp()
    expect(result.appInfo).toMatchObject({ id: 'vim-nav' })
  })

  it('exposes translations', () => {
    const result = mountApp()
    expect(result.translations).toBeDefined()
  })
})
