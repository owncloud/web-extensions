<template>
  <div data-testid="chat-with-file-panel" class="chat-panel">
    <!-- Unconfigured placeholder -->
    <div v-if="status === 'unconfigured'" class="chat-placeholder">
      {{
        $gettext(
          'File chat is not set up yet. Contact your administrator to configure an AI endpoint.'
        )
      }}
    </div>

    <template v-else>
      <!-- Message history -->
      <div ref="messagesEl" class="chat-messages">
        <div v-if="messages.length === 0 && !panelError" class="chat-placeholder">
          <template v-if="mode === 'edit'">
            {{ $gettext('Describe the change you want to make to this file.') }}
          </template>
          <template v-else>
            {{ $gettext('Ask a question about this file.') }}
          </template>
        </div>

        <template v-else>
          <div
            v-for="(message, index) in messages"
            :key="index"
            class="chat-message"
            :class="message.role === 'user' ? 'chat-message--user' : 'chat-message--assistant'"
          >
            <div
              class="chat-bubble"
              :class="message.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--assistant'"
            >
              <pre class="chat-content">{{ message.content }}</pre>
              <template v-if="message.editProposal">
                <div class="chat-diff oc-mt-xs">
                  <button
                    v-if="message.applied"
                    class="diff-toggle"
                    @click="toggleDiff(index)"
                  >
                    <span class="diff-toggle-icon">{{ isDiffExpanded(index) ? '▾' : '▸' }}</span>
                    {{
                      isDiffExpanded(index)
                        ? $gettext('Hide changes')
                        : $gettext('Show changes')
                    }}
                  </button>
                  <div v-if="!message.applied || isDiffExpanded(index)">
                    <div v-if="getDiff(index).length > 0" class="diff-block">
                      <div
                        v-for="(line, li) in getDiff(index)"
                        :key="li"
                        class="diff-line"
                        :class="`diff-line--${line.type}`"
                      >{{ diffPrefix(line.type) }}{{ line.text }}</div>
                    </div>
                    <div v-else class="diff-empty">{{ $gettext('No changes detected.') }}</div>
                  </div>
                </div>
                <div v-if="!message.applied" class="chat-apply-row oc-mt-xs">
                  <oc-button
                    size="small"
                    appearance="outline"
                    :disabled="isApplying"
                    @click="discardEdit(index)"
                  >
                    {{ $pgettext('Button to discard a proposed file edit', 'Discard') }}
                  </oc-button>
                  <oc-button
                    size="small"
                    variant="primary"
                    :disabled="isApplying"
                    @click="applyEdit(message.editProposal, index)"
                  >
                    {{
                      isApplying
                        ? $pgettext('Button label while saving a file edit', 'Saving…')
                        : $pgettext('Button to apply a proposed file edit', 'Apply to file')
                    }}
                  </oc-button>
                </div>
              </template>
            </div>
          </div>
        </template>

        <div v-if="isLoading" class="chat-message chat-message--assistant oc-mb-xs">
          <div class="chat-bubble chat-bubble--assistant chat-bubble--loading">
            {{ $gettext('Thinking…') }}
          </div>
        </div>
      </div>

      <!-- Error banner -->
      <div v-if="panelError" class="chat-error oc-mb-s" role="alert">
        {{ panelError }}
      </div>

      <!-- Clear button -->
      <div v-if="messages.length > 0" class="oc-flex oc-flex-right oc-mb-xs">
        <oc-button size="small" appearance="raw" @click="clearChat">
          {{ $pgettext('Button to clear the chat history', 'Clear chat') }}
        </oc-button>
      </div>

      <!-- Unified input card -->
      <div class="chat-input-card" :class="{ 'chat-input-card--focused': isFocused }">
        <textarea
          v-model="inputText"
          class="chat-textarea"
          :aria-label="$gettext('Chat message input')"
          :placeholder="
            mode === 'edit'
              ? $gettext('Describe the change… (Enter to send)')
              : $gettext('Ask about this file… (Enter to send)')
          "
          :disabled="isLoading"
          rows="3"
          @focus="isFocused = true"
          @blur="isFocused = false"
          @keydown.enter.exact.prevent="submit"
        />
        <div class="chat-input-footer">
          <div class="chat-mode-pills" role="group" :aria-label="$gettext('Chat mode')">
            <button
              class="mode-pill"
              :class="{ 'mode-pill--active': mode === 'chat' }"
              @click="mode = 'chat'"
            >
              {{ $pgettext('Mode toggle — ask questions about the file', 'Chat') }}
            </button>
            <button
              class="mode-pill"
              :class="{ 'mode-pill--active': mode === 'edit' }"
              :disabled="!isEditable"
              :title="isEditable ? undefined : $gettext('Editing is only available for text files')"
              @click="mode = 'edit'"
            >
              {{ $pgettext('Mode toggle — request changes to the file', 'Edit') }}
            </button>
          </div>

          <button
            class="send-btn"
            :disabled="isLoading || isApplying || !inputText.trim()"
            :aria-label="$gettext('Send message')"
            @click="submit"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, toRef, watch, nextTick, onMounted } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useChat, TEXT_EXTENSIONS, type ChatResource } from '../composables/useChat'
import type { LlmConfig } from '../composables/useLlm'
import { computeDiff } from '../utils/diff'
import type { DiffLineType } from '../utils/diff'

interface FlatLine {
  type: DiffLineType | 'sep'
  text: string
}

const { $gettext, $pgettext } = useGettext()

const props = defineProps<{
  resource?: ChatResource | null
  llmConfig?: LlmConfig | null
}>()

const {
  status,
  messages,
  isLoading,
  isApplying,
  panelError,
  sendMessage,
  applyEdit,
  discardEdit,
  clearChat,
  ensureReady
} = useChat(props.llmConfig ?? null, toRef(props, 'resource'))

const inputText = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const mode = ref<'chat' | 'edit'>('chat')
const isFocused = ref(false)

const isEditable = computed(() => {
  const ext = props.resource?.extension?.toLowerCase() ?? ''
  return TEXT_EXTENSIONS.has(ext)
})

// Keyed by `originalContent\0editProposal` so each proposal is computed at most once
// regardless of how many other messages change in the thread.
const diffCache = new Map<string, FlatLine[]>()

const messageDiffs = computed(() =>
  messages.value.map((msg): FlatLine[] | null => {
    if (!msg.editProposal || msg.originalContent === undefined) {
      return null
    }
    const key = `${msg.originalContent}\0${msg.editProposal}`
    const cached = diffCache.get(key)
    if (cached !== undefined) {
      return cached
    }
    const hunks = computeDiff(msg.originalContent, msg.editProposal)
    const flat: FlatLine[] = []
    for (const hunk of hunks) {
      flat.push({ type: 'sep', text: '@@ ... @@' })
      for (const line of hunk.lines) {
        flat.push(line)
      }
    }
    diffCache.set(key, flat)
    return flat
  })
)

function getDiff(index: number): FlatLine[] {
  return messageDiffs.value[index] ?? []
}

const expandedDiffs = ref<number[]>([])

function isDiffExpanded(index: number): boolean {
  return expandedDiffs.value.includes(index)
}

function toggleDiff(index: number): void {
  expandedDiffs.value = isDiffExpanded(index)
    ? expandedDiffs.value.filter((i) => i !== index)
    : [...expandedDiffs.value, index]
}

function diffPrefix(type: FlatLine['type']): string {
  if (type === 'added') return '+ '
  if (type === 'removed') return '- '
  if (type === 'unchanged') return '  '
  return ''
}

async function submit(): Promise<void> {
  const text = inputText.value.trim()
  if (!text || isLoading.value || isApplying.value) {
    return
  }
  inputText.value = ''
  await sendMessage(text, mode.value)
  if (panelError.value) {
    inputText.value = text
  }
}

async function scrollToBottom(): Promise<void> {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

watch(
  () => props.resource?.id,
  (newId, oldId) => {
    if (newId && oldId && newId !== oldId) {
      mode.value = 'chat'
      diffCache.clear()
    }
  }
)

watch(isEditable, (editable) => {
  if (!editable) {
    mode.value = 'chat'
  }
})

watch(messages, scrollToBottom)
watch(isLoading, (loading) => {
  if (loading) {
    scrollToBottom()
  }
})

onMounted(() => {
  ensureReady()
})
</script>

<style scoped>
.chat-panel {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 1rem;
}
.chat-messages {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0.5rem;
}

.chat-placeholder {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-style: italic;
  font-size: 0.875rem;
}

.chat-error {
  color: var(--oc-color-danger, #c00);
  font-size: 0.875rem;
}

.chat-message--user {
  display: flex;
  justify-content: flex-end;
}

.chat-message--assistant {
  display: flex;
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.875rem;
}

.chat-bubble--user {
  background-color: var(--oc-color-swatch-primary-default, #0d6efd);
  color: #fff;
}

.chat-bubble--assistant {
  background-color: var(--oc-color-background-muted, #f4f4f4);
  color: var(--oc-color-text-default, inherit);
}

.chat-bubble--loading {
  color: var(--oc-color-text-muted, #6f6f6f);
  font-style: italic;
}

.chat-content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: inherit;
}

.chat-apply-row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.diff-block {
  font-family: monospace;
  font-size: 0.78rem;
  border: 1px solid var(--oc-color-input-border, #ccc);
  border-radius: 4px;
  overflow-x: auto;
  max-height: 260px;
  overflow-y: auto;
}

.diff-line {
  display: block;
  white-space: pre;
  padding: 0 8px;
  line-height: 1.5;
  min-width: max-content;
}

.diff-line--added {
  background: #e6ffec;
  color: #1a7f37;
}

.diff-line--removed {
  background: #ffebe9;
  color: #cf222e;
}

.diff-line--unchanged {
  color: var(--oc-color-text-muted, #6f6f6f);
}

.diff-line--sep {
  background: #ddf4ff;
  color: #0550ae;
  padding: 1px 8px;
}

.diff-empty {
  font-size: 0.8rem;
  color: var(--oc-color-text-muted, #6f6f6f);
  font-style: italic;
}

.diff-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.78rem;
  font-family: inherit;
  color: var(--oc-color-text-muted, #6f6f6f);
  padding: 0;
  margin-bottom: 4px;
}

.diff-toggle:hover {
  color: var(--oc-color-text-default, inherit);
}

.diff-toggle-icon {
  font-size: 0.7rem;
}

/* Unified input card */
.chat-input-card {
  border: 1px solid var(--oc-color-input-border, #ccc);
  border-radius: 10px;
  overflow: hidden;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  background: var(--oc-color-input-bg, #fff);
}

.chat-input-card--focused {
  border-color: var(--oc-color-swatch-primary-default, #0d6efd);
  box-shadow: 0 0 0 2px
    color-mix(in srgb, var(--oc-color-swatch-primary-default, #0d6efd) 20%, transparent);
}

.chat-textarea {
  display: block;
  width: 100%;
  resize: none;
  border: none;
  outline: none;
  padding: 10px 12px 6px;
  font-size: 0.875rem;
  font-family: inherit;
  background: transparent;
  color: var(--oc-color-text-default, inherit);
  box-sizing: border-box;
}

.chat-textarea:disabled {
  opacity: 0.6;
}

.chat-input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
}

/* Mode pills */
.chat-mode-pills {
  display: flex;
  gap: 4px;
}

.mode-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 0.8rem;
  font-family: inherit;
  border: 1px solid var(--oc-color-input-border, #ccc);
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  color: var(--oc-color-text-default, inherit);
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.mode-pill:hover:not(:disabled):not(.mode-pill--active) {
  background: var(--oc-color-background-muted, #f4f4f4);
}

.mode-pill--active {
  background: var(--oc-color-swatch-primary-default, #0d6efd);
  border-color: var(--oc-color-swatch-primary-default, #0d6efd);
  color: #fff;
  cursor: default;
}

.mode-pill:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Send icon button */
.send-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: var(--oc-color-swatch-primary-default, #0d6efd);
  color: #fff;
  cursor: pointer;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.send-btn:not(:disabled):hover {
  opacity: 0.85;
}
</style>
