<template>
  <div class="draft-creator-modal">
    <div v-if="error" class="draft-creator-modal__error oc-mt-s oc-text-error" role="alert">
      {{ error }}
    </div>

    <div class="oc-mb-m">
      <label class="oc-label" for="draft-description">
        {{ $gettext('Describe the document you need') }}
      </label>
      <textarea
        id="draft-description"
        v-model="description"
        class="oc-input draft-creator-modal__description"
        :placeholder="
          $gettext('e.g. Q3 budget review for EMEA team, include agenda and action-items table')
        "
        rows="4"
        :disabled="creating"
        data-testid="draft-description"
      />
    </div>

    <div class="oc-mb-m">
      <label class="oc-label" for="draft-format">
        {{ $gettext('Output format') }}
      </label>
      <select
        id="draft-format"
        v-model="format"
        class="oc-input"
        :disabled="creating"
        data-testid="draft-format"
      >
        <option value="markdown">{{ $gettext('Markdown') }}</option>
        <option value="plain">{{ $gettext('Plain text') }}</option>
      </select>
    </div>

    <div class="draft-creator-modal__actions oc-flex oc-flex-right oc-mt-m">
      <oc-button
        appearance="outline"
        class="oc-mr-s oc-modal-body-actions-cancel"
        :disabled="creating"
        data-testid="draft-cancel"
        @click="$emit('cancel')"
      >
        {{ $gettext('Cancel') }}
      </oc-button>
      <oc-button
        appearance="filled"
        variation="primary"
        :disabled="creating || !description.trim()"
        data-testid="draft-create"
        @click="handleCreate"
      >
        <oc-spinner v-if="creating" size="small" :aria-label="$gettext('Creating draft…')" />
        <span v-if="creating">{{ $gettext('Creating…') }}</span>
        <span v-else>{{ $gettext('Create draft') }}</span>
      </oc-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useFileActions } from '@ownclouders/web-pkg'
import { useDraftCreator, type DraftFormat } from '../composables/useDraftCreator'
import type { LLMConfig } from '../composables/useLLM'

interface Props {
  llmConfig: LLMConfig | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const { $gettext } = useGettext()
const description = ref('')
const format = ref<DraftFormat>('markdown')

const { creating, error, createDraft } = useDraftCreator(props.llmConfig)
const { triggerDefaultAction } = useFileActions()

async function handleCreate(): Promise<void> {
  const result = await createDraft(description.value.trim(), format.value)
  if (result) {
    emit('confirm')
    triggerDefaultAction({ space: result.space, resources: [result.resource] })
  }
}
</script>
