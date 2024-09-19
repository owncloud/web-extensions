<template>
  <div class="oc-media-editor oc-width-1-1 oc-height-1-1">
    <div ref="tuiImageEditor" class="oc-width-1-1 oc-height-1-1"></div>
  </div>
</template>

<script lang="ts">
import 'tui-color-picker/dist/tui-color-picker.css'
import 'tui-image-editor/dist/tui-image-editor.css'
import ImageEditor from 'tui-image-editor'
import { defineComponent, onBeforeUnmount, onMounted, PropType, ref, unref } from 'vue'
import { storeToRefs } from 'pinia'

import { Resource } from '@ownclouders/web-client'
import { FileContext, useThemeStore } from '@ownclouders/web-pkg'

export default defineComponent({
  props: {
    currentFileContext: { type: Object as PropType<FileContext>, required: true },
    resource: { type: Object as PropType<Resource>, required: true },
    url: {
      type: String,
      required: true
    },
    currentContent: {
      type: String,
      required: true
    }
  },
  emits: ['update:currentContent'],
  setup(props, { emit }) {
    const tuiImageEditor = ref(null)
    let editorInstance = null

    const themeStore = useThemeStore()
    const { currentTheme } = storeToRefs(themeStore)

    const addEventListener = () => {
      Object.keys(emit).forEach((eventName) => {
        editorInstance.on(eventName, (...args) => emit(eventName, ...args))
      })
    }

    onMounted(() => {
      editorInstance = new ImageEditor(tuiImageEditor.value, {
        includeUI: {
          theme: {
            // Note: These two options don't exist on the type, but get applied nonetheless
            // @ts-ignore
            'loadButton.display': 'none',
            // @ts-ignore
            'downloadButton.display': 'none',

            'common.bi.image': '',
            'common.bisize.width': '',
            'common.bisize.height': '',

            'common.backgroundColor':
              unref(currentTheme).designTokens.colorPalette['background-default']
          },
          loadImage: {
            path: props.url,
            name: props.resource.name
          }
        },
        cssMaxWidth: 700,
        cssMaxHeight: 500,
        usageStatistics: false
      })

      // TODO: Check if we need to watch for more changes
      editorInstance.on('undoStackChanged', function (length) {
        const format = props.resource.mimeType.replace('image/', '')

        const currentImageContent = editorInstance
          .toDataURL({
            format,
            quality: 0.8
          })
          .replace(`data:${props.resource.mimeType};base64,`, '')

        emit('update:currentContent', currentImageContent)
      })
    })

    onBeforeUnmount(() => {
      Object.keys(emit).forEach((eventName) => {
        editorInstance.off(eventName)
      })
      editorInstance.destroy()
      editorInstance = null
    })

    return {
      tuiImageEditor
    }
  }
})
</script>
