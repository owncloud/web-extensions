import {
  dirname,
  FileAction,
  FileActionOptions,
  formatFileSize,
  resolveFileNameDuplicate,
  UppyService,
  useClientService,
  useLoadingService,
  useMessages,
  useResourcesStore,
  useService,
  useUserStore
} from '@ownclouders/web-pkg'
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { extractNameWithoutExtension, urlJoin } from '@ownclouders/web-client'
import { UppyFile, Meta, Body } from '@uppy/core'
import * as uuid from 'uuid'
import * as zip from '@zip.js/zip.js'
import PQueue from 'p-queue'
import Worker from './../../node_modules/@zip.js/zip.js/dist/z-worker.js?url'

const SUPPORTED_MIME_TYPES = ['application/zip']
const MAX_SIZE_MB = 64 // in mb

// TODO: import from web-pkg after next release
type OcUppyFile = UppyFile<Meta, Body>

export const useUnzipAction = () => {
  const { $gettext, current: currentLanguage } = useGettext()
  const clientService = useClientService()
  const loadingService = useLoadingService()
  const userStore = useUserStore()
  const resourcesStore = useResourcesStore()
  const { showErrorMessage } = useMessages()
  const uppyService = useService<UppyService>('$uppyService')

  const createRootFolder = async ({ space, resources }: FileActionOptions) => {
    const archiveName = extractNameWithoutExtension(resources[0])
    let folderName = archiveName
    if (resourcesStore.resources.some((r) => r.isFolder && r.name === folderName)) {
      folderName = resolveFileNameDuplicate(archiveName, '', resourcesStore.resources)
    }
    const path = urlJoin(resourcesStore.currentFolder.path, folderName)
    const resource = await clientService.webdav.createFolder(unref(space), { path })
    resourcesStore.upsertResource(resource)
    return resource
  }

  const getFileBlob = async ({ space, resources }: FileActionOptions) => {
    const { response } = await clientService.webdav.getFileContents(
      space,
      { path: resources[0].path },
      { responseType: 'blob' }
    )
    return new File([response.data], resources[0].name)
  }

  const handler = async ({ space, resources }: FileActionOptions) => {
    let zipReader: zip.ZipReader<zip.BlobReader>
    const workerUrl = urlJoin(dirname(import.meta.url), Worker)

    try {
      zip.configure({
        chunkSize: 128,
        useWebWorkers: true,
        workerScripts: {
          deflate: [workerUrl],
          inflate: [workerUrl]
        }
      })
      const fileBlob = await getFileBlob({ space, resources })
      const blobReader = new zip.BlobReader(fileBlob)
      zipReader = new zip.ZipReader(blobReader)
      const entries = await zipReader.getEntries()

      // password protected archives currently cannot be extracted
      if (entries.some(({ encrypted }) => encrypted)) {
        showErrorMessage({
          title: $gettext('Password protected archives cannot be extracted'),
          errors: [new Error()]
        })
        return
      }

      const folder = await createRootFolder({ space, resources })
      const queue = new PQueue({ concurrency: 4 })
      const uploadId = uuid.v4()

      // unzip and convert to UppyFile's
      const promises = entries
        .filter(({ filename }) => !filename.endsWith('/'))
        .map<Promise<OcUppyFile | void>>((result) => {
          const writer = new zip.BlobWriter()
          return queue.add(() =>
            result.getData(writer).then((data) => {
              const path = dirname(result.filename)
              const name =
                path === '.' ? result.filename : result.filename.substring(path.length + 1)

              return {
                name,
                data,
                meta: {
                  ...(path !== '.' && { webkitRelativePath: urlJoin(path, name) }),
                  uploadId
                }
              } as unknown as OcUppyFile
            })
          )
        })

      const filesToUpload = await Promise.all(promises)
      uppyService.setUploadFolder(uploadId, folder)
      uppyService.addFiles(filesToUpload)
    } catch (error) {
      showErrorMessage({ title: $gettext('Failed to extract archive'), errors: [error] })
    } finally {
      if (zipReader) {
        zipReader.close()
      }
    }
  }

  const action = computed<FileAction>(() => {
    return {
      name: 'unzip-archive',
      icon: 'inbox-unarchive',
      handler: (args) => loadingService.addTask(() => handler(args)),
      label: () => {
        return $gettext('Extract here')
      },
      isDisabled: ({ resources }) => {
        const archiveSize = Number(resources[0].size || 0)
        const maxSize = MAX_SIZE_MB * 1000000
        return archiveSize > maxSize
      },
      disabledTooltip: () =>
        $gettext('Archive exceeds the maximum size of %{maxSize}', {
          maxSize: formatFileSize(MAX_SIZE_MB * 1000000, currentLanguage)
        }),
      isVisible: ({ resources }) => {
        if (resources.length !== 1) {
          return false
        }
        if (!resourcesStore.currentFolder?.canUpload({ user: userStore.user })) {
          return false
        }
        return SUPPORTED_MIME_TYPES.includes(resources[0].mimeType)
      },
      componentType: 'button',
      class: 'oc-files-actions-unzip-archive'
    }
  })

  return action
}
