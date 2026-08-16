import { AppMenuItemExtension, SidebarPanelExtension } from '@ownclouders/web-pkg'
import { defaultComponentMocks, getComposableWrapper } from '@ownclouders/web-test-helpers'
import { mock } from 'vitest-mock-extended'
import { unref } from 'vue'
import type { ApplicationSetupOptions } from '@ownclouders/web-pkg'
import type { Resource, SpaceResource } from '@ownclouders/web-client'
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

  it('renders no sidebar panel when the jitsi-admin-proxy is not configured', () => {
    getWrapper({
      applicationConfig: { url: 'https://jitsi-admin.example.com' },
      setup: (instance) => {
        expect(unref(instance)).toHaveLength(1)
        expect(unref(instance)[0].type).toBe('appMenuItem')
      }
    })
  })

  it('renders both sidebar panels when the jitsi-admin-proxy is configured', () => {
    const endpoint = 'https://ocis.example.com/jitsi-admin-proxy/rooms'
    getWrapper({
      applicationConfig: {
        url: 'https://jitsi-admin.example.com',
        jitsiAdminProxy: { endpoint }
      },
      setup: (instance) => {
        const panelExtensions = unref(instance).filter((e) => e.type === 'sidebarPanel') as (
          | SidebarPanelExtension<SpaceResource, Resource, Resource>
          | SidebarPanelExtension<Resource, Resource, Resource>
        )[]
        expect(panelExtensions).toHaveLength(2)
        for (const panelExtension of panelExtensions) {
          expect(panelExtension.extensionPointIds).toEqual(['global.files.sidebar'])
        }
      }
    })
  })

  it('only shows the Space panel for a single selected project space', () => {
    const endpoint = 'https://ocis.example.com/jitsi-admin-proxy/rooms'
    getWrapper({
      applicationConfig: {
        url: 'https://jitsi-admin.example.com',
        jitsiAdminProxy: { endpoint }
      },
      setup: (instance) => {
        const panelExtension = unref(instance).find(
          (e) => e.type === 'sidebarPanel' && e.id.endsWith('.spaceCallPanel')
        ) as SidebarPanelExtension<SpaceResource, Resource, Resource> | undefined

        // `type: 'space'` matters here: isSpaceResource checks `.type`, not
        // `.driveType` (isProjectSpaceResource checks `.driveType` instead) —
        // a real SpaceResource built via buildSpace() always has both.
        const space = mock<SpaceResource>({ type: 'space', driveType: 'project' })
        const file = mock<Resource>()

        expect(panelExtension?.panel.isVisible({ items: [space] })).toBe(true)
        expect(panelExtension?.panel.isVisible({ items: [file] })).toBe(false)
        expect(panelExtension?.panel.isVisible({ items: [space, space] })).toBe(false)
        expect(panelExtension?.panel.isVisible({ items: [] })).toBeFalsy()
      }
    })
  })

  it('only shows the file/folder panel for a single selected non-Space resource', () => {
    const endpoint = 'https://ocis.example.com/jitsi-admin-proxy/rooms'
    getWrapper({
      applicationConfig: {
        url: 'https://jitsi-admin.example.com',
        jitsiAdminProxy: { endpoint }
      },
      setup: (instance) => {
        const panelExtension = unref(instance).find(
          (e) => e.type === 'sidebarPanel' && e.id.endsWith('.fileCallPanel')
        ) as SidebarPanelExtension<Resource, Resource, Resource> | undefined

        // `type: 'space'` matters here: isSpaceResource checks `.type`, not
        // `.driveType` (isProjectSpaceResource checks `.driveType` instead) —
        // a real SpaceResource built via buildSpace() always has both.
        const space = mock<SpaceResource>({ type: 'space', driveType: 'project' })
        const file = mock<Resource>()

        expect(panelExtension?.panel.isVisible({ items: [file] })).toBe(true)
        expect(panelExtension?.panel.isVisible({ items: [space] })).toBe(false)
        expect(panelExtension?.panel.isVisible({ items: [file, file] })).toBe(false)
        expect(panelExtension?.panel.isVisible({ items: [] })).toBeFalsy()
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
