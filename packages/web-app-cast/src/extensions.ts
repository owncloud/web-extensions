import { FileActionOptions, useClientService } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import { computed, Ref, unref } from 'vue'
import { Extension } from '@ownclouders/web-pkg'
import { ApplicationSetupOptions } from '@ownclouders/web-pkg'

export const extensions = ({
  applicationConfig,
  isAvailable
}: ApplicationSetupOptions & { isAvailable: Ref<boolean> }) => {
  const clientService = useClientService()
  const { $gettext } = useGettext()

  const handler = async ({ space, resources }: FileActionOptions) => {
    const resource = resources[0]

    const imageUrl = await clientService.webdav.getFileUrl(space, resource, {})
    const mimeType = resource.mimeType

    const castContext = cast.framework.CastContext.getInstance()
    let castSession = castContext.getCurrentSession()
    if (!castSession) {
      try {
        await castContext.requestSession()
        console.log('Cast session initiated')
        castSession = castContext.getCurrentSession()
      } catch (e) {
        console.error('Could not initiate cast session', e)
      }
    }
    if (castSession) {
      const mediaInfo = new chrome.cast.media.MediaInfo(imageUrl, mimeType)
      const request = new chrome.cast.media.LoadRequest(mediaInfo)

      try {
        await castSession.loadMedia(request)
        console.log('Resource Cast successful')
      } catch (e) {
        console.error('Error casting resource:', e)
      }
    } else {
      console.error('No Cast session available')
    }
  }

  return computed(
    () =>
      [
        {
          id: 'com.github.owncloud.cast.file-action',
          type: 'action',
          scopes: ['files', 'files.context-menu'],
          action: {
            name: 'cast',
            icon: 'cast',
            handler,
            label: () => $gettext('Cast'),
            isEnabled: ({ resources }: FileActionOptions) => {
              return unref(isAvailable) && !resources[0]?.isFolder
            },
            componentType: 'button'
          }
        }
      ] satisfies Extension[]
  )
}
