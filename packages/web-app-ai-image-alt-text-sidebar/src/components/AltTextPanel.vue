<template>
  <div
    data-testid="ai-alt-text-panel"
    class="ai-alt-text-panel oc-background-muted oc-p-m oc-rounded"
  >
    <div v-if="isProbing" class="ai-alt-text-placeholder">
      {{ $gettext('Checking AI capabilities…') }}
    </div>

    <div v-else-if="status === 'unconfigured'" class="ai-alt-text-placeholder">
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
      <div v-if="loadError" class="ai-alt-text-error oc-mb-m" role="alert">
        {{ loadError }}
      </div>

      <template v-if="editableText !== null">
        <label class="ai-alt-text-label oc-mt-s">
          {{ $pgettext('Alt text editable field label', 'Alt text') }}
          <textarea
            ref="textareaRef"
            v-model="currentText"
            class="ai-alt-text-textarea oc-mt-xs"
            rows="1"
            @input="autoGrow"
          />
        </label>
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
import { ref, computed, toRef, watch, onMounted, nextTick } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useMessages } from '@ownclouders/web-pkg'
import type { Resource } from '@ownclouders/web-client'
import { useAltText } from '../composables/useAltText'
import { useAltTextStorage } from '../composables/useAltTextStorage'
import type { LlmConfig } from '../composables/useLlm'

const { $gettext, $pgettext } = useGettext()
const { showMessage } = useMessages()

const props = defineProps<{
  resource?: Resource | null
  llmConfig?: LlmConfig | null
}>()

const resourceRef = toRef(props, 'resource')

const { status, isGenerating, isProbing, altText, panelError, triggerGenerate, ensureReady, reset } = useAltText(
  props.llmConfig ?? null,
  resourceRef
)

const { storedText, isSaving, loadError, saveError: storageError, loadStoredText, saveText } = useAltTextStorage()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const editableText = ref<string | null>(null)

function autoGrow() {
  if (!textareaRef.value) return
  textareaRef.value.style.height = 'auto'
  textareaRef.value.style.height = `${textareaRef.value.scrollHeight}px`
}

const currentText = computed({
  get: () => editableText.value ?? '',
  set: (v: string) => {
    editableText.value = v
  }
})

watch(
  altText,
  (val) => {
    if (val !== null) {
      editableText.value = val
      nextTick(autoGrow)
    }
  },
  { immediate: true }
)

watch(
  storedText,
  (val) => {
    if (val !== null && editableText.value === null) {
      editableText.value = val
      nextTick(autoGrow)
    }
  },
  { immediate: true }
)

async function handleSave() {
  if (editableText.value !== null && props.resource) {
    await saveText(props.resource, editableText.value)
    if (!storageError.value) {
      showMessage({ title: $gettext('Alt text saved.'), status: 'success' })
    }
  }
}

async function copyToClipboard() {
  if (!editableText.value) return
  try {
    if (!navigator.clipboard) throw new Error('unavailable')
    await navigator.clipboard.writeText(editableText.value)
  } catch {
    showMessage({ title: $gettext('Could not copy to clipboard.'), status: 'danger' })
  }
}

watch(
  () => props.resource?.id,
  (newId, oldId) => {
    if (newId === oldId) return
    reset()
    editableText.value = null
    if (props.resource) {
      loadStoredText(props.resource)
    }
  }
)

onMounted(async () => {
  await ensureReady()
  if (props.resource) {
    await loadStoredText(props.resource)
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
.ai-alt-text-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--oc-color-text-default, #1d1d1d);
}
.ai-alt-text-textarea {
  display: block;
  box-sizing: border-box;
  width: 100%;
  resize: none;
  overflow: hidden;
  padding: 0.5rem;
  border: 1px solid var(--oc-color-border, #c8c8c8);
  border-radius: 0.25rem;
  background: var(--oc-color-background-default, #fff);
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  line-height: 1.5;
}
</style>
