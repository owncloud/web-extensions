<template>
  <div
    data-testid="ai-alt-text-panel"
    class="ai-alt-text-panel oc-background-muted oc-p-m oc-rounded"
  >
    <div v-if="status === 'unconfigured'" class="ai-alt-text-placeholder">
      {{
        $gettext(
          'Alt text generation is not set up. Contact your administrator to configure an AI endpoint.'
        )
      }}
    </div>

    <div v-else-if="status === 'text-only'" class="ai-alt-text-placeholder">
      {{
        $gettext(
          'The configured AI model does not support image input. Ask your administrator to switch to a vision-capable model.'
        )
      }}
    </div>

    <div v-else-if="isGenerating" class="ai-alt-text-placeholder">
      {{ $gettext('Generating…') }}
    </div>

    <template v-else>
      <div v-if="panelError" class="ai-alt-text-error oc-mb-m" role="alert">
        {{ panelError }}
      </div>

      <template v-if="editableText !== null">
        <oc-textarea
          v-model="currentText"
          class="oc-mt-s"
          :label="$pgettext('Alt text editable field label', 'Alt text')"
          :submit-on-enter="false"
        />
        <div v-if="storageError" class="ai-alt-text-error oc-mt-s" role="alert">
          {{ storageError }}
        </div>
        <div class="oc-flex oc-flex-right oc-mt-s">
          <oc-button size="small" appearance="raw" @click="copyToClipboard">
            {{ $pgettext('Button to copy alt text to clipboard', 'Copy') }}
          </oc-button>
          <oc-button size="small" appearance="raw" class="oc-ml-s" @click="triggerGenerate">
            {{ $pgettext('Button to regenerate alt text', 'Regenerate') }}
          </oc-button>
          <oc-button
            size="small"
            variant="primary"
            class="oc-ml-s"
            :disabled="isSaving"
            @click="handleSave"
          >
            {{ isSaving ? $gettext('Saving…') : $pgettext('Button to save alt text', 'Save') }}
          </oc-button>
        </div>
      </template>

      <div v-else class="oc-flex oc-flex-column oc-flex-center oc-text-center">
        <p class="ai-alt-text-placeholder oc-mb-m oc-mt-rm">
          {{ $gettext('Generate an AI description for this image.') }}
        </p>
        <oc-button size="small" variant="primary" @click="triggerGenerate">
          {{ $pgettext('Button to generate image alt text', 'Generate') }}
        </oc-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, toRef, watch, onMounted } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useAltText, type AltTextResource } from '../composables/useAltText'
import { useAltTextStorage } from '../composables/useAltTextStorage'
import type { LlmConfig } from '../composables/useLlm'

const { $gettext, $pgettext } = useGettext()

const props = defineProps<{
  resource?: AltTextResource | null
  llmConfig?: LlmConfig | null
}>()

const resourceRef = toRef(props, 'resource')

const { status, isGenerating, altText, panelError, triggerGenerate, ensureReady } = useAltText(
  props.llmConfig ?? null,
  resourceRef
)

const { storedText, isSaving, saveError: storageError, loadStoredText, saveText } = useAltTextStorage()

const editableText = ref<string | null>(null)

const currentText = computed({
  get: () => editableText.value ?? '',
  set: (v: string) => {
    editableText.value = v
  }
})

watch(
  altText,
  (val) => {
    if (val !== null) editableText.value = val
  },
  { immediate: true }
)

watch(
  storedText,
  (val) => {
    if (val !== null && editableText.value === null) editableText.value = val
  },
  { immediate: true }
)

async function handleSave() {
  if (editableText.value !== null && props.resource) {
    await saveText(props.resource as any, editableText.value)
  }
}

async function copyToClipboard() {
  if (editableText.value) {
    await navigator.clipboard?.writeText(editableText.value)
  }
}

onMounted(async () => {
  await ensureReady()
  if (props.resource) {
    await loadStoredText(props.resource as any)
  }
})
</script>

<style scoped>
.ai-alt-text-panel {
  min-height: 8rem;
}
.ai-alt-text-placeholder {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-style: italic;
}
.ai-alt-text-error {
  color: var(--oc-color-swatch-danger-default, #c00);
}
</style>
