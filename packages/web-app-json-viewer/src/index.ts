import { AppWrapperRoute, defineWebApplication } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import JsonViewer from './App.vue'

const applicationId = 'json-viewer'
export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const routes = [
      {
        name: applicationId,
        path: '/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(JsonViewer, {
          applicationId
        }),
        meta: {
          authContext: 'hybrid',
          title: $gettext('JSON Viewer'),
          patchCleanPath: true
        }
      }
    ]

    const appInfo = {
      name: $gettext('JSON Viewer'),
      id: applicationId,
      icon: 'file-code',
      defaultExtension: 'json',
      extensions: [
        {
          extension: 'json',
          routeName: 'json-viewer'
        }
      ]
    }

    return {
      appInfo,
      routes
    }
  }
})
