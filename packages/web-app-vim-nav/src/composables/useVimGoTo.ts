import { useRouter } from '@ownclouders/web-pkg'

export const GO_TO_ROUTES = {
  gp: 'files-spaces-generic',
  gs: 'files-shares-with-me',
  gd: 'files-trash-generic',
  go: 'files-spaces-projects'
} as const

export function useVimGoTo() {
  const router = useRouter()

  const goTo = (sequence: keyof typeof GO_TO_ROUTES) => {
    router.push({ name: GO_TO_ROUTES[sequence] })
  }

  return { goTo }
}
