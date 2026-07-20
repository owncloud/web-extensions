import { useEventListener } from '@vueuse/core'
import { useRouter, useModals } from '@ownclouders/web-pkg'
import { KeySequence } from './keySequence'
import { useVimNavigation } from './useVimNavigation'
import { useVimClipboard } from './useVimClipboard'
import { useVimDelete } from './useVimDelete'
import { useVimGoTo, GO_TO_ROUTES } from './useVimGoTo'
import { useVimShortcutsHelp } from './useVimShortcutsHelp'
import { useVimOpen } from './useVimOpen'
import { useVimCreate } from './useVimCreate'
import { useVimFileActions } from './useVimFileActions'

const TRASH_ROUTE_NAME = 'files-trash-generic'
const TWO_KEY_SEQUENCES = ['gg', 'dd', 'gp', 'gs', 'gd', 'go', 'nd', 'nf', 'nm', 'ns', 'yy', 'dw']
const HANDLED_SINGLE_KEYS = new Set(['j', 'k', 'G', 'y', 'x', 'p', 'd', 'r', 'e', 'v', 'l', '/', '?', 'Escape'])

const NON_TEXT_INPUT_TYPES = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'file',
  'image',
  'range',
  'color',
  'hidden'
])

const isEditableTarget = (): boolean => {
  const activeElement = document.activeElement
  const tag = activeElement?.tagName?.toLowerCase()
  if (tag === 'input') {
    const type = (activeElement as HTMLInputElement).type
    return !NON_TEXT_INPUT_TYPES.has(type)
  }
  if (tag === 'textarea') {
    return true
  }
  if ((activeElement as HTMLElement)?.isContentEditable) {
    return true
  }
  return window.getSelection()?.type === 'Range'
}

const focusSearchInput = (): void => {
  const bar = document.getElementById('files-global-search-bar')
  const input = bar?.querySelector<HTMLInputElement>('input.oc-search-input')
  input?.focus()
}

export function useVimNav(): void {
  const router = useRouter()
  const { moveDown, moveUp, jumpToFirst, jumpToLast, toggleVisualMode, exitVisualMode } = useVimNavigation()
  const { yank, cut, paste } = useVimClipboard()
  const { deleteSelected, restoreSelected, emptyTrashBin } = useVimDelete()
  const { goTo } = useVimGoTo()
  const { showShortcutsHelp } = useVimShortcutsHelp()
  const { openSelected } = useVimOpen()
  const { createFolder, createFile, createSpaceModal } = useVimCreate()
  const { downloadSelected, duplicateSelected } = useVimFileActions()
  const modalsStore = useModals()

  const sequence = new KeySequence({
    sequences: TWO_KEY_SEQUENCES,
    onTimeout: (key) => handleSingleKey(key)
  })

  const isInTrash = (): boolean => router.currentRoute.value.name === TRASH_ROUTE_NAME

  const handleSingleKey = (key: string): void => {
    switch (key) {
      case 'j':
        moveDown()
        break
      case 'k':
        moveUp()
        break
      case 'G':
        jumpToLast()
        break
      case 'y':
        if (!isInTrash()) yank()
        break
      case 'x':
        if (!isInTrash()) { cut(); exitVisualMode() }
        break
      case 'p':
        if (!isInTrash()) paste()
        break
      case 'd':
        if (isInTrash()) { deleteSelected(); exitVisualMode() }
        break
      case 'r':
        if (isInTrash()) restoreSelected()
        break
      case 'e':
        if (isInTrash()) emptyTrashBin()
        break
      case 'v':
        toggleVisualMode()
        break
      case 'l':
        openSelected()
        break
      case '/':
        focusSearchInput()
        break
      case '?':
        showShortcutsHelp()
        break
      case 'Escape':
        exitVisualMode()
        sequence.reset()
        break
      default:
        break
    }
  }

  const handleCompletedSequence = (completed: string): void => {
    if (completed === 'gg') {
      jumpToFirst()
      return
    }
    if (completed === 'dd') {
      if (!isInTrash()) deleteSelected()
      exitVisualMode()
      return
    }
    if (completed === 'nd') {
      if (!isInTrash()) createFolder()
      return
    }
    if (completed === 'nf') {
      if (!isInTrash()) createFile('txt')
      return
    }
    if (completed === 'nm') {
      if (!isInTrash()) createFile('md')
      return
    }
    if (completed === 'ns') {
      createSpaceModal()
      return
    }
    if (completed === 'yy') {
      if (!isInTrash()) duplicateSelected()
      return
    }
    if (completed === 'dw') {
      if (!isInTrash()) downloadSelected()
      return
    }
    if (completed in GO_TO_ROUTES) {
      goTo(completed as keyof typeof GO_TO_ROUTES)
    }
  }

  useEventListener(document, 'keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && modalsStore.activeModal) {
      modalsStore.removeModal(modalsStore.activeModal.id)
      event.preventDefault()
      return
    }
    if (isEditableTarget()) {
      return
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return
    }

    const result = sequence.press(event.key)
    if (result.type === 'pending') {
      event.preventDefault()
      return
    }
    if (result.type === 'complete') {
      event.preventDefault()
      handleCompletedSequence(result.sequence)
      return
    }
    if (!HANDLED_SINGLE_KEYS.has(event.key)) return
    event.preventDefault()
    handleSingleKey(event.key)
  })
}
