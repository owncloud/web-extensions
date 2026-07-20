import { computed, unref } from 'vue'
import {
  useFileActionsCreateNewFolder,
  useFileActionsCreateNewFile,
  useSpacesStore,
  useResourcesStore,
  useModals,
  useMessages,
  useCreateSpace,
  useSpaceHelpers,
  useRouter
} from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'

export function useVimCreate() {
  const spacesStore = useSpacesStore()
  const resourcesStore = useResourcesStore()
  const space = computed(() => spacesStore.currentSpace)
  const { actions: folderActions } = useFileActionsCreateNewFolder({ space })
  const { actions: fileActions } = useFileActionsCreateNewFile({ space })
  const { dispatchModal } = useModals()
  const { showMessage, showErrorMessage } = useMessages()
  const { createSpace } = useCreateSpace()
  const { checkSpaceNameModalInput } = useSpaceHelpers()
  const { $pgettext } = useGettext()
  const router = useRouter()

  const actionOptions = () => ({ space: spacesStore.currentSpace, resources: [] })

  const createFolder = () => {
    const action = unref(folderActions)[0]
    if (action?.isVisible()) action.handler(actionOptions())
  }

  const createFile = (ext: string) => {
    const action = unref(fileActions).find((a) => a.ext === ext)
    if (action?.isVisible()) action.handler(actionOptions())
  }

  const createSpaceModal = () => {
    dispatchModal({
      title: $pgettext('Vim nav create space dialog title', 'Create a new space'),
      confirmText: $pgettext('Vim nav create space dialog confirm button', 'Create'),
      hasInput: true,
      inputLabel: $pgettext('Vim nav create space dialog input label', 'Space name'),
      inputValue: $pgettext('Vim nav create space dialog default name', 'New space'),
      onConfirm: async (name: string) => {
        try {
          const createdSpace = await createSpace(name, 'project')
          resourcesStore.upsertResource(createdSpace)
          spacesStore.upsertSpace(createdSpace)
          showMessage({ title: $pgettext('Vim nav create space success message', 'Space was created successfully') })
          router.push({ name: 'files-spaces-projects' })
        } catch (error) {
          showErrorMessage({ title: $pgettext('Vim nav create space error message', 'Creating space failed…'), errors: [error] })
        }
      },
      onInput: checkSpaceNameModalInput
    })
  }

  return { createFolder, createFile, createSpaceModal }
}
