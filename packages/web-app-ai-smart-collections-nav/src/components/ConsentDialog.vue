<template>
  <div
    data-testid="ai-collections-consent"
    class="consent-dialog oc-background-muted oc-p-m oc-rounded oc-flex oc-flex-column oc-flex-center oc-text-center"
  >
    <p class="oc-mb-m">
      {{
        $gettext(
          'To group your files into collections, file names and short content excerpts will be sent to the AI service configured by your administrator. Continue?'
        )
      }}
    </p>
    <div class="oc-flex oc-flex-center oc-gap-xs">
      <oc-button size="small" variant="primary" @click="emit('confirm')">
        {{ $pgettext('Consent confirmation button', 'Group my files') }}
      </oc-button>
      <oc-button size="small" variant="passive" @click="emit('deny')">
        {{ $pgettext('Consent cancellation button', 'Cancel') }}
      </oc-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGettext } from 'vue3-gettext'

const { $gettext, $pgettext } = useGettext()

const emit = defineEmits<{
  confirm: []
  deny: []
}>()
</script>

<style scoped>
.consent-dialog {
  min-height: 8rem;
  justify-content: center;
}
</style>
