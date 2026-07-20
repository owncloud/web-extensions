import { useModals } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import ShortcutsHelp from '../components/ShortcutsHelp.vue'

export function useVimShortcutsHelp() {
  const { dispatchModal } = useModals()
  const { $pgettext } = useGettext()

  const showShortcutsHelp = () => {
    dispatchModal({
      title: $pgettext('Title of the keyboard shortcuts help dialog', 'Keyboard shortcuts'),
      hideActions: true,
      customComponent: ShortcutsHelp
    })
  }

  return { showShortcutsHelp }
}
