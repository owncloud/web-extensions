import App from '../../src/App.vue'
import { mount } from '@vue/test-utils'
import { createGettext } from 'vue3-gettext'
import { mock } from 'vitest-mock-extended'
import { Resource } from '@ownclouders/web-client'
import { AppConfigObject } from '@ownclouders/web-pkg'

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
      global: {
        plugins: [createGettext({ translations: {}, silent: true })]
      }
    })
  }
}
