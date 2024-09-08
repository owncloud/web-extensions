<template>
  <div class="oc-image-editor oc-width-1-1 oc-height-1-1">
    <div ref="tuiImageEditor" class="oc-width-1-1 oc-height-1-1"></div>
  </div>
</template>

<script lang="ts">
import 'tui-color-picker/dist/tui-color-picker.css'
import 'tui-image-editor/dist/tui-image-editor.css'
import ImageEditor from 'tui-image-editor'
import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue'

export default defineComponent({
  props: {
    url: {
      type: String,
      required: true
    }
  },
  setup(props, { emit }) {
    const tuiImageEditor = ref(null)
    let editorInstance = null

    const addEventListener = () => {
      Object.keys(emit).forEach((eventName) => {
        editorInstance.on(eventName, (...args) => emit(eventName, ...args))
      })
    }

    onMounted(() => {
      editorInstance = new ImageEditor(tuiImageEditor.value, {
        includeUI: {
          loadImage: {
            path: props.url,
            name: 'SampleImage'
          }
        },
        // TODO: Grab window width and height via VueUse
        cssMaxWidth: 700,
        cssMaxHeight: 500,
        usageStatistics: false
      })
      addEventListener()

      // TODO: Communicate to AppTopBar whether the image has been modified
      // checkIfDirty = setInterval(() => {
      //   const isDirty = !editorInstance.isEmptyUndoStack()
      //   if (isDirty) {
      //     emit('update:currentContent', isDirty)
      //   }
      // }, 300)
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
