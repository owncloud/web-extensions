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

const includeUIOptions = {
  includeUI: {
    initMenu: 'filter'
  }
}
const editorDefaultOptions = {
  cssMaxWidth: 700,
  cssMaxHeight: 500,
  usageStatistics: false
}

export default defineComponent({
  props: {
    includeUi: {
      type: Boolean,
      default: true
    },
    options: {
      type: Object,
      default() {
        return editorDefaultOptions
      }
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

    const getRootElement = () => {
      return tuiImageEditor.value
    }

    const invoke = (methodName, ...args) => {
      let result = null
      if (editorInstance[methodName]) {
        result = editorInstance[methodName](...args)
      } else if (methodName.indexOf('.') > -1) {
        const func = getMethod(editorInstance, methodName)
        if (typeof func === 'function') {
          result = func(...args)
        }
      }
      return result
    }

    const getMethod = (instance, methodName) => {
      const { first, rest } = parseDotMethodName(methodName)
      const isInstance = instance.constructor.name !== 'Object'
      const type = typeof instance[first]
      let obj

      if (isInstance && type === 'function') {
        obj = instance[first].bind(instance)
      } else {
        obj = instance[first]
      }

      if (rest.length > 0) {
        return getMethod(obj, rest)
      }

      return obj
    }

    const parseDotMethodName = (methodName) => {
      const firstDotIdx = methodName.indexOf('.')
      let firstMethodName = methodName
      let restMethodName = ''

      if (firstDotIdx > -1) {
        firstMethodName = methodName.substring(0, firstDotIdx)
        restMethodName = methodName.substring(firstDotIdx + 1, methodName.length)
      }

      return {
        first: firstMethodName,
        rest: restMethodName
      }
    }

    onMounted(() => {
      let options = props.options
      if (props.includeUi) {
        options = Object.assign(includeUIOptions, props.options)
      }
      editorInstance = new ImageEditor(tuiImageEditor.value, options)
      addEventListener()
    })

    onBeforeUnmount(() => {
      Object.keys(emit).forEach((eventName) => {
        editorInstance.off(eventName)
      })
      editorInstance.destroy()
      editorInstance = null
    })

    return {
      tuiImageEditor,
      invoke,
      getRootElement
    }
  }
})
</script>
