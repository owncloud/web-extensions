import { AppMenuItemExtension, ApplicationSetupOptions } from '@ownclouders/web-pkg'
import { defaultComponentMocks, getComposableWrapper } from '@ownclouders/web-test-helpers'
import { mock } from 'vitest-mock-extended'
import { unref } from 'vue'
import { extensions } from '../../src/extensions'

describe('jitsi-conference extensions', () => {
  it('renders no menu item when no url is configured', () => {
    getWrapper({
      applicationConfig: {},
      setup: (instance) => {
        expect(unref(instance)).toEqual([])
      }
    })
  })

  it('renders a menu item pointing at the configured url when one is set', () => {
    const url = 'https://jitsi-admin.example.com'
    getWrapper({
      applicationConfig: { url },
      setup: (instance) => {
        const menuItem = unref(instance)[0] as AppMenuItemExtension
        expect(menuItem.url).toBe(url)
        // no `path` must be set: the call opens in a new tab, never inside an
        // oCIS-nested iframe, see DECISIONS.md (D1).
        expect(menuItem.path).toBeUndefined()
      }
    })
  })
})

function getWrapper({
  setup,
  applicationConfig
}: {
  setup: (instance: ReturnType<typeof extensions>) => void
  applicationConfig: Record<string, unknown>
}) {
  const mocks = { ...defaultComponentMocks() }

  return {
    wrapper: getComposableWrapper(
      () => {
        const instance = extensions({
          ...mock<ApplicationSetupOptions>(),
          applicationConfig
        })
        setup(instance)
      },
      {
        mocks,
        provide: mocks
      }
    )
  }
}
