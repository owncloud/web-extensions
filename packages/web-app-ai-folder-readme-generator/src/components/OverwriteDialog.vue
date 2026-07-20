<template>
  <div class="oc-folder-readme-overwrite-dialog oc-p-m">
    <h2 class="oc-folder-readme-overwrite-dialog-title oc-mb-s">
      {{ $gettext('README already exists') }}
    </h2>
    <p class="oc-mb-m">
      {{ $gettext('This folder already contains a README.md file. Do you want to overwrite it?') }}
    </p>
    <div class="oc-flex oc-flex-right">
      <oc-button class="oc-folder-readme-overwrite-dialog-cancel oc-mr-s" appearance="outline" @click="$emit('cancel')">
        {{ $gettext('Cancel') }}
      </oc-button>
      <oc-button
        class="oc-folder-readme-overwrite-dialog-confirm"
        variant="primary"
        appearance="filled"
        @click="$emit('confirm')"
      >
        {{ $gettext('Overwrite') }}
      </oc-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGettext } from 'vue3-gettext'

defineEmits<{ confirm: []; cancel: [] }>()

const { $gettext } = useGettext()
</script>
