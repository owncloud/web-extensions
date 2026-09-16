import { Resource, SpaceResource } from '@ownclouders/web-client'
import { User } from '@ownclouders/web-client/graph/generated'
import { ActionExtension, ApplicationSetupOptions } from '@ownclouders/web-pkg'
import { defaultComponentMocks, getComposableWrapper } from '@ownclouders/web-test-helpers'
import { mock } from 'vitest-mock-extended'
import { unref } from 'vue'
import { extensions } from '../../src/extensions'

const personalSpace = mock<SpaceResource>({ driveType: 'personal', isOwner: () => true })

describe('jupyter action', () => {
  describe('isVisible', () => {
    it('is false if more than one resource is selected', () => {
      getWrapper({
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const resources = [mock<Resource>({ extension: 'ipynb' }), mock<Resource>()]
          expect(action.isVisible({ space: personalSpace, resources })).toBeFalsy()
        }
      })
    })
    it('is false if the resource is not a notebook file', () => {
      getWrapper({
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const resource = mock<Resource>({ extension: 'txt', path: '/foo.txt' })
          expect(action.isVisible({ space: personalSpace, resources: [resource] })).toBeFalsy()
        }
      })
    })
    it('is false if the space is not a personal space', () => {
      getWrapper({
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const space = mock<SpaceResource>({ driveType: 'project', isOwner: () => true })
          const resource = mock<Resource>({ extension: 'ipynb', path: '/foo.ipynb' })
          expect(action.isVisible({ space, resources: [resource] })).toBeFalsy()
        }
      })
    })
    it('is false if the current user is not the owner of the personal space', () => {
      getWrapper({
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const space = mock<SpaceResource>({ driveType: 'personal', isOwner: () => false })
          const resource = mock<Resource>({ extension: 'ipynb', path: '/foo.ipynb' })
          expect(action.isVisible({ space, resources: [resource] })).toBeFalsy()
        }
      })
    })
    it('is false if a serverRootPath is configured and the resource is outside of it', () => {
      getWrapper({
        applicationConfig: { serverRootPath: 'notebooks/' },
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const resource = mock<Resource>({ extension: 'ipynb', path: '/other/foo.ipynb' })
          expect(action.isVisible({ space: personalSpace, resources: [resource] })).toBeFalsy()
        }
      })
    })
    it('is true for an .ipynb file owned by the current user in their personal space', () => {
      getWrapper({
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const resource = mock<Resource>({ extension: 'ipynb', path: '/foo.ipynb' })
          expect(action.isVisible({ space: personalSpace, resources: [resource] })).toBeTruthy()
        }
      })
    })
    it('is true if the resource is inside the configured serverRootPath', () => {
      getWrapper({
        applicationConfig: { serverRootPath: 'notebooks/' },
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const resource = mock<Resource>({ extension: 'ipynb', path: '/notebooks/foo.ipynb' })
          expect(action.isVisible({ space: personalSpace, resources: [resource] })).toBeTruthy()
        }
      })
    })
  })
  describe('href', () => {
    it('builds a url using the default serverPath', () => {
      getWrapper({
        applicationConfig: { serverUrl: 'https://jupyter.example.com/' },
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const resource = mock<Resource>({ path: '/foo.ipynb', id: '1' })
          expect(action.href({ space: personalSpace, resources: [resource] })).toEqual(
            'https://jupyter.example.com/hub/user-redirect/lab/tree/foo.ipynb?fileId=1'
          )
        }
      })
    })
    it('builds a url using a configured serverPath', () => {
      getWrapper({
        applicationConfig: {
          serverUrl: 'https://jupyter.example.com/',
          serverPath: 'custom/path'
        },
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const resource = mock<Resource>({ path: '/foo.ipynb', id: '1' })
          expect(action.href({ space: personalSpace, resources: [resource] })).toEqual(
            'https://jupyter.example.com/custom/path/foo.ipynb?fileId=1'
          )
        }
      })
    })
    it('strips the configured serverRootPath from the resource path', () => {
      getWrapper({
        applicationConfig: {
          serverUrl: 'https://jupyter.example.com/',
          serverRootPath: 'notebooks/'
        },
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const resource = mock<Resource>({ path: '/notebooks/foo.ipynb', id: '1' })
          expect(action.href({ space: personalSpace, resources: [resource] })).toEqual(
            'https://jupyter.example.com/hub/user-redirect/lab/tree/foo.ipynb?fileId=1'
          )
        }
      })
    })
  })
})

function getWrapper({
  setup,
  applicationConfig = {}
}: {
  setup: (instance: ReturnType<typeof extensions>) => void
  applicationConfig?: Record<string, string>
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
        provide: mocks,
        pluginOptions: {
          piniaOptions: { userState: { user: mock<User>({ id: 'admin' }) } }
        }
      }
    )
  }
}
