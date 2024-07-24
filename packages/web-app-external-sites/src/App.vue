<template>
  <main class="external-site-container">
    <iframe :title="$gettext(name)" :src="url" class="oc-width-1-1 oc-height-1-1" />
  </main>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ExternalSite',
  props: {
    name: { type: String, required: true },
    url: { type: String, required: true }
  }
})
</script>
