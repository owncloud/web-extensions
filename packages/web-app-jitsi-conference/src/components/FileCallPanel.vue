<template>
  <div data-testid="jitsi-file-call-panel" class="jitsi-file-call-panel oc-p-m">
    <div v-if="status === 'unconfigured'" class="jitsi-call-placeholder">
      {{
        $gettext(
          'Calling all recipients is not set up yet. Contact your administrator to configure the jitsi-admin proxy.'
        )
      }}
    </div>

    <template v-else>
      <div v-if="panelError" class="jitsi-call-error" role="alert">
        {{ panelError }}
      </div>

      <template v-else-if="callResult">
        <p class="oc-mt-rm">
          {{
            $gettext('Invited %{invited} recipients.', { invited: String(callResult.invited) })
          }}
        </p>
        <p v-if="callResult.skipped > 0" class="jitsi-call-placeholder">
          {{
            $gettext('%{skipped} recipients could not be invited automatically.', {
              skipped: String(callResult.skipped)
            })
          }}
        </p>
        <ul v-if="callResult.failed.length" class="oc-mt-s">
          <li v-for="failure in callResult.failed" :key="failure.email">
            {{ failure.email }} — {{ failure.error }}
          </li>
        </ul>
        <div class="oc-flex oc-flex-right oc-mt-s">
          <oc-button size="small" variant="primary" @click="openJitsiAdmin">
            {{ $gettext('Open jitsi-admin') }}
          </oc-button>
        </div>
      </template>

      <div v-else class="oc-flex oc-flex-column oc-flex-center oc-text-center">
        <p class="jitsi-call-placeholder oc-mb-m oc-mt-rm">
          {{ $gettext('Start a video call with everyone who has access to this item.') }}
        </p>
        <oc-button size="small" variant="primary" :disabled="isCalling" @click="triggerCall">
          {{ isCalling ? $gettext('Starting call…') : $gettext('Call all recipients') }}
        </oc-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { Resource } from '@ownclouders/web-client'
import { useFileCall, type JitsiAdminProxyConfig } from '../composables/useFileCall'

const { $gettext } = useGettext()

const props = defineProps<{
  resource?: Resource | null
  proxyConfig?: JitsiAdminProxyConfig | null
  jitsiAdminUrl?: string
}>()

const { status, isCalling, callResult, panelError, triggerCall } = useFileCall(
  props.proxyConfig ?? null,
  toRef(props, 'resource')
)

function openJitsiAdmin(): void {
  if (props.jitsiAdminUrl) {
    window.open(props.jitsiAdminUrl, '_blank', 'noopener')
  }
}
</script>

<style scoped>
.jitsi-call-placeholder {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-style: italic;
}
.jitsi-call-error {
  color: var(--oc-color-danger, #c00);
}
</style>
