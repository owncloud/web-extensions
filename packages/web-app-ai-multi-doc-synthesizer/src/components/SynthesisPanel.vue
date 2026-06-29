<template>
  <div class="synthesis-panel">
    <!-- Truncation warning -->
    <oc-info-drop
      v-if="truncationWarning"
      class="oc-mb-s"
      :text="truncationWarning"
      data-testid="synthesis-truncation-warning"
    />

    <!-- Unconfigured -->
    <div
      v-if="!llmConfig"
      class="synthesis-placeholder"
      data-testid="synthesis-unconfigured"
    >
      {{
        $gettext(
          'Document synthesis is not set up yet. Contact your administrator to configure an AI endpoint.'
        )
      }}
    </div>

    <!-- Loading -->
    <div
      v-else-if="isSynthesizing"
      class="synthesis-placeholder"
      data-testid="synthesis-loading"
    >
      <oc-spinner :aria-label="$gettext('Synthesizing documents…')" />
      <span class="oc-ml-s">{{ $gettext('Synthesizing documents…') }}</span>
    </div>

    <!-- Error -->
    <div
      v-else-if="panelError"
      class="synthesis-error"
      role="alert"
      data-testid="synthesis-error"
    >
      {{ panelError }}
      <div class="oc-mt-s">
        <oc-button
          variation="primary"
          data-testid="synthesis-retry-btn"
          @click="triggerSynthesis"
        >
          {{ $pgettext('Button to retry synthesis', 'Try again') }}
        </oc-button>
      </div>
    </div>

    <!-- Result -->
    <div v-else-if="synthesisResult" data-testid="synthesis-result">
      <section v-if="synthesisResult.themes.length > 0" class="synthesis-section">
        <h3 class="synthesis-section-title" data-testid="synthesis-themes-heading">
          {{ $gettext('Shared Themes') }}
        </h3>
        <ul class="synthesis-list" data-testid="synthesis-themes">
          <li v-for="theme in synthesisResult.themes" :key="theme">{{ theme }}</li>
        </ul>
      </section>

      <section v-if="synthesisResult.differences.length > 0" class="synthesis-section">
        <h3 class="synthesis-section-title" data-testid="synthesis-differences-heading">
          {{ $gettext('Key Differences') }}
        </h3>
        <ul class="synthesis-list" data-testid="synthesis-differences">
          <li v-for="diff in synthesisResult.differences" :key="diff">{{ diff }}</li>
        </ul>
      </section>

      <section v-if="synthesisResult.actionItems.length > 0" class="synthesis-section">
        <h3 class="synthesis-section-title" data-testid="synthesis-action-items-heading">
          {{ $gettext('Action Items') }}
        </h3>
        <ul class="synthesis-list" data-testid="synthesis-action-items">
          <li v-for="item in synthesisResult.actionItems" :key="item">{{ item }}</li>
        </ul>
      </section>
    </div>

    <!-- Idle (configured but not yet run) -->
    <div v-else-if="llmConfig" class="synthesis-idle" data-testid="synthesis-idle">
      <p class="synthesis-placeholder">
        {{ $gettext('Ready to synthesize the selected documents.') }}
      </p>
      <oc-button
        variation="primary"
        class="oc-mt-m"
        data-testid="synthesis-trigger-btn"
        @click="triggerSynthesis"
      >
        {{ $pgettext('Button to start document synthesis', 'Synthesize') }}
      </oc-button>
    </div>

    <!-- Action bar shown when result is available -->
    <div
      v-if="synthesisResult && !panelError"
      class="synthesis-footer oc-mt-m"
      data-testid="synthesis-footer"
    >
      <oc-button
        :disabled="isCopying"
        data-testid="synthesis-copy-btn"
        @click="handleCopy"
      >
        {{
          isCopying
            ? $pgettext('Button label while copying synthesis result', 'Copied!')
            : $pgettext('Button to copy synthesis result to clipboard', 'Copy to clipboard')
        }}
      </oc-button>
      <oc-button
        :disabled="isSaving"
        data-testid="synthesis-save-btn"
        @click="handleSave"
      >
        {{
          isSaving
            ? $pgettext('Button label while saving synthesis result', 'Saving…')
            : $pgettext('Button to save synthesis result as Markdown', 'Save as Markdown')
        }}
      </oc-button>
      <oc-button
        variation="primary"
        data-testid="synthesis-regenerate-btn"
        @click="triggerSynthesis"
      >
        {{ $pgettext('Button to re-run synthesis', 'Regenerate') }}
      </oc-button>
    </div>

    <div v-if="saveError" class="synthesis-error oc-mt-xs" role="alert">
      {{ saveError }}
    </div>
    <div v-if="saveSuccess" class="synthesis-success oc-mt-xs" data-testid="synthesis-save-success">
      {{ saveSuccess }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useSynthesis } from '../composables/useSynthesis'
import type { SynthesisResource } from '../composables/useSynthesis'
import type { LLMConfig } from '../composables/useLLM'

const { $gettext, $pgettext } = useGettext()

const props = defineProps<{
  resources: SynthesisResource[]
  llmConfig: LLMConfig | null
}>()

const {
  isSynthesizing,
  synthesisResult,
  panelError,
  truncationWarning,
  triggerSynthesis,
  saveAsMarkdown
} = useSynthesis(props.llmConfig, ref(props.resources))

const isCopying = ref(false)
const isSaving = ref(false)
const saveError = ref<string | null>(null)
const saveSuccess = ref<string | null>(null)

function formatResultAsText(): string {
  const result = synthesisResult.value
  if (!result) return ''
  const sections: string[] = []
  if (result.themes.length > 0) {
    sections.push(`SHARED THEMES\n${result.themes.map((t) => `• ${t}`).join('\n')}`)
  }
  if (result.differences.length > 0) {
    sections.push(`KEY DIFFERENCES\n${result.differences.map((d) => `• ${d}`).join('\n')}`)
  }
  if (result.actionItems.length > 0) {
    sections.push(`ACTION ITEMS\n${result.actionItems.map((a) => `• ${a}`).join('\n')}`)
  }
  return sections.join('\n\n')
}

async function handleCopy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(formatResultAsText())
    isCopying.value = true
    setTimeout(() => {
      isCopying.value = false
    }, 2000)
  } catch {
    // Clipboard access denied; silently ignore
  }
}

async function handleSave(): Promise<void> {
  isSaving.value = true
  saveError.value = null
  saveSuccess.value = null
  try {
    const path = await saveAsMarkdown()
    saveSuccess.value = `${$gettext('Saved as')} ${path}`
  } catch (err) {
    saveError.value =
      err instanceof Error ? err.message : $gettext('Could not save the file. Please try again.')
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  if (props.llmConfig) {
    triggerSynthesis()
  }
})
</script>

<style scoped>
.synthesis-panel {
  padding: 4px 0;
}

.synthesis-placeholder {
  display: flex;
  align-items: center;
  color: var(--oc-color-text-muted, #6f6f6f);
  font-size: 0.9rem;
}

.synthesis-error {
  color: var(--oc-color-danger, #c00);
  font-size: 0.9rem;
}

.synthesis-success {
  color: var(--oc-color-success, #1f8c3b);
  font-size: 0.875rem;
}

.synthesis-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.synthesis-section {
  margin-bottom: 20px;
}

.synthesis-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--oc-color-text-muted, #6f6f6f);
  margin: 0 0 8px 0;
}

.synthesis-list {
  margin: 0;
  padding-left: 20px;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--oc-color-text-default, inherit);
}

.synthesis-list li + li {
  margin-top: 4px;
}

.synthesis-footer {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
