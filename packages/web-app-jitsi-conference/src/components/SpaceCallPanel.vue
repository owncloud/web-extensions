<template>
  <div data-testid="jitsi-space-call-panel" class="jitsi-space-call-panel oc-p-m">
    <div v-if="status === 'unconfigured'" class="jitsi-call-placeholder">
      {{
        $gettext(
          'Calling all Space members is not set up yet. Contact your administrator to configure the jitsi-admin proxy.'
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
            $gettext('Invited %{invited} members.', { invited: String(callResult.invited) })
          }}
        </p>
        <p v-if="callResult.skipped > 0" class="jitsi-call-placeholder">
          {{
            $gettext('%{skipped} members could not be invited automatically.', {
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
          {{ $gettext('Start a video call with everyone who has access to this Space.') }}
        </p>
        <oc-button
          size="small"
          variant="primary"
          :disabled="isCalling"
          @click="triggerCall"
        >
          {{ isCalling ? $gettext('Starting call…') : $gettext('Call all members') }}
        </oc-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { SpaceResource } from '@ownclouders/web-client'
import { useSpaceCall, type JitsiAdminProxyConfig } from '../composables/useSpaceCall'

const { $gettext } = useGettext()

const props = defineProps<{
  space?: SpaceResource | null
  proxyConfig?: JitsiAdminProxyConfig | null
  jitsiAdminUrl?: string
}>()

const { status, isCalling, callResult, panelError, triggerCall } = useSpaceCall(
  props.proxyConfig ?? null,
  toRef(props, 'space')
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
