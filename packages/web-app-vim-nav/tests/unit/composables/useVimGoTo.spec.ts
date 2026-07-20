import { describe, it, expect, vi } from 'vitest'
import { useRouter } from '@ownclouders/web-pkg'
import { useVimGoTo, GO_TO_ROUTES } from '../../../src/composables/useVimGoTo'

vi.mock('@ownclouders/web-pkg', async () => {
  const actual = await vi.importActual<object>('@ownclouders/web-pkg')
  return {
    ...actual,
    useRouter: vi.fn()
  }
})

describe('useVimGoTo', () => {
  it('pushes the personal route for gp', () => {
    const push = vi.fn()
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)

    const { goTo } = useVimGoTo()
    goTo('gp')

    expect(push).toHaveBeenCalledWith({ name: 'files-spaces-generic' })
  })

  it('pushes the shares route for gs', () => {
    const push = vi.fn()
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)

    const { goTo } = useVimGoTo()
    goTo('gs')

    expect(push).toHaveBeenCalledWith({ name: 'files-shares-with-me' })
  })

  it('pushes the trash route for gd', () => {
    const push = vi.fn()
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)

    const { goTo } = useVimGoTo()
    goTo('gd')

    expect(push).toHaveBeenCalledWith({ name: 'files-trash-generic' })
  })

  it('pushes the spaces overview route for go', () => {
    const push = vi.fn()
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)

    const { goTo } = useVimGoTo()
    goTo('go')

    expect(push).toHaveBeenCalledWith({ name: 'files-spaces-projects' })
  })

  it('exposes all four route mappings', () => {
    expect(GO_TO_ROUTES).toEqual({
      gp: 'files-spaces-generic',
      gs: 'files-shares-with-me',
      gd: 'files-trash-generic',
      go: 'files-spaces-projects'
    })
  })
})
