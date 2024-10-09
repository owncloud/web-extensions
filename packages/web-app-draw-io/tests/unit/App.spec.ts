import App from '../../src/App.vue'
import { mock } from 'vitest-mock-extended'
import { Resource } from '@ownclouders/web-client'
import { AppConfigObject } from '@ownclouders/web-pkg'
import { defaultPlugins, mount } from '@ownclouders/web-test-helpers'

describe('Draw.io app', () => {
  it('uses the url from the app config as base iFrame url', () => {
    const url = 'https://foo.bar'
    const { wrapper } = createWrapper({ url })
    expect(wrapper.find('iFrame').attributes('src').startsWith(url)).toBeTruthy()
  })
})

function createWrapper({ url = '' }: { url?: string } = {}) {
  return {
    wrapper: mount(App, {
      props: {
        resource: mock<Resource>(),
        applicationConfig: mock<AppConfigObject>({ url }),
        currentContent: '',
        isReadOnly: false,
        isDirty: false
      },
      global: { plugins: [...defaultPlugins()] }
    })
  }
}
