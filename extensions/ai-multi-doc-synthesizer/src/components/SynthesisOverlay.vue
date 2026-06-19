<template>
  <Teleport to="body">
    <div
      class="synthesis-backdrop"
      data-testid="synthesis-overlay"
    >
      <!-- Invisible full-screen close target for backdrop clicks -->
      <button
        class="synthesis-backdrop-btn"
        :aria-label="$gettext('Close synthesis panel')"
        tabindex="-1"
        @click="$emit('close')"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="synthesis-title"
      >
      <div class="synthesis-panel">
        <div class="synthesis-header">
          <h2 id="synthesis-title" class="synthesis-title">
            {{ $gettext('Document Synthesis') }}
          </h2>
          <button
            class="synthesis-close"
            :aria-label="$gettext('Close synthesis panel')"
            @click="$emit('close')"
          >
            ✕
          </button>
        </div>

        <div class="synthesis-body">
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
            {{ $gettext('Synthesizing documents…') }}
          </div>

          <!-- Error -->
          <div
            v-else-if="panelError"
            class="synthesis-error"
            role="alert"
            data-testid="synthesis-error"
          >
            {{ panelError }}
            <div class="synthesis-actions oc-mt-s">
              <button class="synthesis-btn synthesis-btn--primary" @click="triggerSynthesis">
                {{ $pgettext('Button to retry synthesis', 'Try again') }}
              </button>
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
            <button
              class="synthesis-btn synthesis-btn--primary oc-mt-m"
              data-testid="synthesis-trigger-btn"
              @click="triggerSynthesis"
            >
              {{ $pgettext('Button to start document synthesis', 'Synthesize') }}
            </button>
          </div>
        </div>

        <!-- Action bar shown when result is available -->
        <div
          v-if="synthesisResult && !panelError"
          class="synthesis-footer"
          data-testid="synthesis-footer"
        >
          <button
            class="synthesis-btn"
            :disabled="isCopying"
            data-testid="synthesis-copy-btn"
            @click="handleCopy"
          >
            {{
              isCopying
                ? $pgettext('Button label while copying synthesis result', 'Copied!')
                : $pgettext('Button to copy synthesis result to clipboard', 'Copy to clipboard')
            }}
          </button>
          <button
            class="synthesis-btn"
            :disabled="isSaving"
            data-testid="synthesis-save-btn"
            @click="handleSave"
          >
            {{
              isSaving
                ? $pgettext('Button label while saving synthesis result', 'Saving…')
                : $pgettext('Button to save synthesis result as Markdown', 'Save as Markdown')
            }}
          </button>
          <button
            class="synthesis-btn synthesis-btn--primary"
            data-testid="synthesis-regenerate-btn"
            @click="triggerSynthesis"
          >
            {{ $pgettext('Button to re-run synthesis', 'Regenerate') }}
          </button>
        </div>

        <div v-if="saveError" class="synthesis-error oc-mt-xs" role="alert">
          {{ saveError }}
        </div>
        <div v-if="saveSuccess" class="synthesis-success oc-mt-xs" data-testid="synthesis-save-success">
          {{ saveSuccess }}
        </div>
      </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, toRef, onMounted, onUnmounted } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useSynthesis } from '../composables/useSynthesis'
import type { SynthesisResource } from '../composables/useSynthesis'
import type { LLMConfig } from '../composables/useLLM'

const { $gettext, $pgettext } = useGettext()

const props = defineProps<{
  resources: SynthesisResource[]
  llmConfig: LLMConfig | null
}>()

const emit = defineEmits<{
  close: []
}>()

function handleGlobalKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})

const { isSynthesizing, synthesisResult, panelError, triggerSynthesis, saveAsMarkdown } =
  useSynthesis(props.llmConfig, toRef(props, 'resources'))

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
    // Clipboard access denied; silently ignore (browser will show its own error)
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
  document.addEventListener('keydown', handleGlobalKeydown)
  if (props.llmConfig) {
    triggerSynthesis()
  }
})
</script>

<style scoped>
.synthesis-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}

/* Full-screen transparent button behind the panel — click anywhere outside panel to close. */
.synthesis-backdrop-btn {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  cursor: default;
  z-index: 0;
}

[role='dialog'] {
  position: relative;
  z-index: 1;
}

.synthesis-panel {
  background: var(--oc-color-background-default, #fff);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.22);
  width: 90vw;
  max-width: 680px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.synthesis-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--oc-color-border, #e0e0e0);
}

.synthesis-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--oc-color-text-default, inherit);
}

.synthesis-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: var(--oc-color-text-muted, #6f6f6f);
  padding: 4px 8px;
  border-radius: 4px;
  line-height: 1;
}

.synthesis-close:hover {
  background: var(--oc-color-background-muted, #f4f4f4);
  color: var(--oc-color-text-default, inherit);
}

.synthesis-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.synthesis-placeholder {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-style: italic;
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
  padding: 12px 20px;
  border-top: 1px solid var(--oc-color-border, #e0e0e0);
  flex-wrap: wrap;
}

.synthesis-actions {
  display: flex;
  gap: 8px;
}

.synthesis-btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  font-size: 0.875rem;
  font-family: inherit;
  border: 1px solid var(--oc-color-input-border, #ccc);
  border-radius: 6px;
  background: transparent;
  color: var(--oc-color-text-default, inherit);
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.synthesis-btn:hover:not(:disabled) {
  background: var(--oc-color-background-muted, #f4f4f4);
}

.synthesis-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.synthesis-btn--primary {
  background: var(--oc-color-swatch-primary-default, #0d6efd);
  border-color: var(--oc-color-swatch-primary-default, #0d6efd);
  color: #fff;
}

.synthesis-btn--primary:hover:not(:disabled) {
  background: var(--oc-color-swatch-primary-hover, #0b5ed7);
  border-color: var(--oc-color-swatch-primary-hover, #0b5ed7);
}
</style>
