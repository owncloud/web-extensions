import { AppWrapperRoute, defineWebApplication } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import MediaEditor from './App.vue'

const applicationId = 'media-editor'
export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const routes = [
      {
        name: applicationId,
        path: '/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(MediaEditor, {
          applicationId
        }),
        meta: {
          authContext: 'hybrid',
          title: $gettext('Media Editor'),
          patchCleanPath: true
        }
      }
    ]

    const appInfo = {
      name: $gettext('Media Editor'),
      id: applicationId,
      icon: 'file-code',
      defaultExtension: 'png',
      // TODO: add more extensions from web media viewer
      extensions: [
        {
          extension: 'png',
          routeName: 'media-editor'
        }
      ]
    }

    return {
      appInfo,
      routes
    }
  }
})
