import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import ChatPanel from '../../src/components/ChatPanel.vue'

// --- module-level mocks ---

vi.mock('../../src/composables/useChat')

vi.mock('vue3-gettext', () => ({
  useGettext: () => ({
    $gettext: (s: string) => s,
    $pgettext: (_ctx: string, s: string) => s
  })
}))

// --- imports after mocks ---

import { useChat } from '../../src/composables/useChat'
import type { ChatMessage } from '../../src/composables/useChat'
import type { LlmStatus } from '../../src/composables/useLlm'

// -------------------------------------------------------------------------

const sendMessageMock = vi.fn().mockResolvedValue(undefined)
const applyEditMock = vi.fn().mockResolvedValue(undefined)
const discardEditMock = vi.fn()
const clearChatMock = vi.fn()
const ensureReadyMock = vi.fn()

function setupUseChatMock({
  status = 'unconfigured' as LlmStatus,
  messages = [] as ChatMessage[],
  isLoading = false,
  isApplying = false,
  panelError = null as string | null
} = {}) {
  vi.mocked(useChat).mockReturnValue({
    status: ref(status),
    messages: ref(messages),
    isLoading: ref(isLoading),
    isApplying: ref(isApplying),
    panelError: ref(panelError),
    sendMessage: sendMessageMock,
    applyEdit: applyEditMock,
    discardEdit: discardEditMock,
    clearChat: clearChatMock,
    ensureReady: ensureReadyMock
  })
}

// Minimal OcButton stub that forwards click events and respects disabled
const OcButton = {
  name: 'OcButton',
  props: ['disabled', 'size', 'variant', 'appearance'],
  emits: ['click'],
  template: '<button :disabled="disabled" @click="!disabled && $emit(\'click\')"><slot /></button>'
}

function createWrapper(props: Record<string, unknown> = {}) {
  return mount(ChatPanel, {
    props: {
      resource: null,
      llmConfig: null,
      ...props
    },
    global: {
      components: { OcButton },
      stubs: { OcButton: false } // use the real stub above, not auto-stub
    }
  })
}

// =========================================================================

describe('ChatPanel', () => {
  beforeEach(() => {
    sendMessageMock.mockReset().mockResolvedValue(undefined)
    applyEditMock.mockReset().mockResolvedValue(undefined)
    discardEditMock.mockReset()
    clearChatMock.mockReset()
    ensureReadyMock.mockReset()
    setupUseChatMock()
  })

  // -----------------------------------------------------------------------

  describe('unconfigured state', () => {
    it('shows a setup placeholder when status is unconfigured', async () => {
      setupUseChatMock({ status: 'unconfigured' })
      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.find('.chat-placeholder').exists()).toBe(true)
      expect(wrapper.find('.chat-placeholder').text()).toMatch(/configure|admin|set up/i)
    })

    it('does not render the message list or input when unconfigured', async () => {
      setupUseChatMock({ status: 'unconfigured' })
      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.find('.chat-messages').exists()).toBe(false)
      expect(wrapper.find('.chat-input-card').exists()).toBe(false)
    })
  })

  // -----------------------------------------------------------------------

  describe('empty state (ready, no messages)', () => {
    it('shows "Ask a question" placeholder in chat mode', async () => {
      setupUseChatMock({ status: 'ready' })
      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.find('.chat-placeholder').text()).toMatch(/ask a question/i)
    })

    it('shows "Describe the change" placeholder in edit mode for a text file', async () => {
      setupUseChatMock({ status: 'ready' })
      const wrapper = createWrapper({ resource: { extension: 'txt' } })
      await flushPromises()

      // Switch to edit mode
      const editPill = wrapper.findAll('.mode-pill').find((b) => b.text().includes('Edit'))
      await editPill?.trigger('click')

      expect(wrapper.find('.chat-placeholder').text()).toMatch(/describe the change/i)
    })
  })

  // -----------------------------------------------------------------------

  describe('message rendering', () => {
    it('renders user messages with the user class', async () => {
      setupUseChatMock({
        status: 'ready',
        messages: [{ role: 'user', content: 'Hello' }]
      })
      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.find('.chat-message--user').exists()).toBe(true)
      expect(wrapper.find('.chat-message--user .chat-content').text()).toBe('Hello')
    })

    it('renders assistant messages with the assistant class', async () => {
      setupUseChatMock({
        status: 'ready',
        messages: [{ role: 'assistant', content: 'Hi there!' }]
      })
      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.find('.chat-message--assistant').exists()).toBe(true)
      expect(wrapper.find('.chat-message--assistant .chat-content').text()).toBe('Hi there!')
    })

    it('renders all messages in order', async () => {
      setupUseChatMock({
        status: 'ready',
        messages: [
          { role: 'user', content: 'Question' },
          { role: 'assistant', content: 'Answer' }
        ]
      })
      const wrapper = createWrapper()
      await flushPromises()

      const bubbles = wrapper.findAll('.chat-content')
      expect(bubbles[0].text()).toBe('Question')
      expect(bubbles[1].text()).toBe('Answer')
    })
  })

  // -----------------------------------------------------------------------

  describe('loading state', () => {
    it('shows a "Thinking…" bubble while isLoading is true', async () => {
      setupUseChatMock({ status: 'ready', isLoading: true })
      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.find('.chat-bubble--loading').exists()).toBe(true)
      expect(wrapper.find('.chat-bubble--loading').text()).toMatch(/thinking/i)
    })

    it('disables the textarea while loading', async () => {
      setupUseChatMock({ status: 'ready', isLoading: true })
      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    })
  })

  // -----------------------------------------------------------------------

  describe('error banner', () => {
    it('renders the error message in an alert element', async () => {
      setupUseChatMock({ status: 'ready', panelError: 'AI service unreachable.' })
      const wrapper = createWrapper()
      await flushPromises()

      const alert = wrapper.find('[role="alert"]')
      expect(alert.exists()).toBe(true)
      expect(alert.text()).toBe('AI service unreachable.')
    })

    it('does not show an alert element when panelError is null', async () => {
      setupUseChatMock({ status: 'ready', panelError: null })
      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    })
  })

  // -----------------------------------------------------------------------

  describe('clear chat button', () => {
    it('is not visible when there are no messages', async () => {
      setupUseChatMock({ status: 'ready', messages: [] })
      const wrapper = createWrapper()
      await flushPromises()

      const buttons = wrapper.findAllComponents(OcButton)
      const clearBtn = buttons.find((b) => b.text().includes('Clear chat'))
      expect(clearBtn).toBeUndefined()
    })

    it('is visible when messages exist', async () => {
      setupUseChatMock({
        status: 'ready',
        messages: [{ role: 'user', content: 'hi' }]
      })
      const wrapper = createWrapper()
      await flushPromises()

      const buttons = wrapper.findAllComponents(OcButton)
      const clearBtn = buttons.find((b) => b.text().includes('Clear chat'))
      expect(clearBtn).toBeDefined()
    })

    it('calls clearChat when clicked', async () => {
      setupUseChatMock({
        status: 'ready',
        messages: [{ role: 'user', content: 'hi' }]
      })
      const wrapper = createWrapper()
      await flushPromises()

      const buttons = wrapper.findAllComponents(OcButton)
      const clearBtn = buttons.find((b) => b.text().includes('Clear chat'))
      await clearBtn?.trigger('click')

      expect(clearChatMock).toHaveBeenCalledTimes(1)
    })
  })

  // -----------------------------------------------------------------------

  describe('mode pills', () => {
    it('starts in chat mode with the chat pill active', async () => {
      setupUseChatMock({ status: 'ready' })
      const wrapper = createWrapper()
      await flushPromises()

      const chatPill = wrapper.findAll('.mode-pill').find((b) => b.text().includes('Chat'))
      expect(chatPill?.classes()).toContain('mode-pill--active')
    })

    it('disables the Edit pill for non-text files (e.g. PDF)', async () => {
      setupUseChatMock({ status: 'ready' })
      const wrapper = createWrapper({ resource: { extension: 'pdf' } })
      await flushPromises()

      const editPill = wrapper.findAll('.mode-pill').find((b) => b.text().includes('Edit'))
      expect(editPill?.attributes('disabled')).toBeDefined()
    })

    it('enables the Edit pill for text files', async () => {
      setupUseChatMock({ status: 'ready' })
      const wrapper = createWrapper({ resource: { extension: 'txt' } })
      await flushPromises()

      const editPill = wrapper.findAll('.mode-pill').find((b) => b.text().includes('Edit'))
      expect(editPill?.attributes('disabled')).toBeUndefined()
    })

    it('switches to edit mode when the Edit pill is clicked', async () => {
      setupUseChatMock({ status: 'ready' })
      const wrapper = createWrapper({ resource: { extension: 'txt' } })
      await flushPromises()

      const editPill = wrapper.findAll('.mode-pill').find((b) => b.text().includes('Edit'))
      await editPill?.trigger('click')

      expect(editPill?.classes()).toContain('mode-pill--active')
    })
  })

  // -----------------------------------------------------------------------

  describe('message submission', () => {
    it('calls sendMessage with trimmed text and current mode when send button is clicked', async () => {
      setupUseChatMock({ status: 'ready' })
      const wrapper = createWrapper()
      await flushPromises()

      await wrapper.find('textarea').setValue('  my question  ')
      await wrapper.find('.send-btn').trigger('click')

      expect(sendMessageMock).toHaveBeenCalledWith('my question', 'chat')
    })

    it('clears the textarea after sending', async () => {
      setupUseChatMock({ status: 'ready' })
      const wrapper = createWrapper()
      await flushPromises()

      const textarea = wrapper.find('textarea')
      await textarea.setValue('hello')
      await wrapper.find('.send-btn').trigger('click')
      await flushPromises()

      expect((textarea.element as HTMLTextAreaElement).value).toBe('')
    })

    it('restores the typed text when sendMessage results in an error', async () => {
      const panelErrorRef = ref<string | null>(null)
      vi.mocked(useChat).mockReturnValue({
        status: ref('ready' as const),
        messages: ref([]),
        isLoading: ref(false),
        isApplying: ref(false),
        panelError: panelErrorRef,
        sendMessage: vi.fn().mockImplementation(async () => {
          panelErrorRef.value = 'Something went wrong.'
        }),
        applyEdit: applyEditMock,
        discardEdit: discardEditMock,
        clearChat: clearChatMock,
        ensureReady: ensureReadyMock
      })

      const wrapper = createWrapper()
      await flushPromises()

      const textarea = wrapper.find('textarea')
      await textarea.setValue('fix this typo')
      await wrapper.find('.send-btn').trigger('click')
      await flushPromises()

      expect((textarea.element as HTMLTextAreaElement).value).toBe('fix this typo')
    })

    it('does not call sendMessage when textarea is empty', async () => {
      setupUseChatMock({ status: 'ready' })
      const wrapper = createWrapper()
      await flushPromises()

      await wrapper.find('.send-btn').trigger('click')
      expect(sendMessageMock).not.toHaveBeenCalled()
    })

    it('disables the send button when input is blank', async () => {
      setupUseChatMock({ status: 'ready' })
      const wrapper = createWrapper()
      await flushPromises()

      expect(wrapper.find('.send-btn').attributes('disabled')).toBeDefined()
    })

    it('passes the current mode to sendMessage', async () => {
      setupUseChatMock({ status: 'ready' })
      const wrapper = createWrapper({ resource: { extension: 'txt' } })
      await flushPromises()

      // Switch to edit mode
      const editPill = wrapper.findAll('.mode-pill').find((b) => b.text().includes('Edit'))
      await editPill?.trigger('click')

      await wrapper.find('textarea').setValue('rewrite this')
      await wrapper.find('.send-btn').trigger('click')

      expect(sendMessageMock).toHaveBeenCalledWith('rewrite this', 'edit')
    })
  })

  // -----------------------------------------------------------------------

  describe('edit proposal UI', () => {
    function msgWithProposal(applied = false): ChatMessage {
      return {
        role: 'assistant',
        content: applied ? 'Edit applied successfully.' : 'Edit ready — click "Apply to file" to save.',
        editProposal: 'new file content',
        originalContent: 'old file content',
        applied
      }
    }

    it('shows Apply and Discard buttons for an unapplied proposal', async () => {
      setupUseChatMock({ status: 'ready', messages: [msgWithProposal(false)] })
      const wrapper = createWrapper()
      await flushPromises()

      const buttons = wrapper.findAllComponents(OcButton)
      const labels = buttons.map((b) => b.text())
      expect(labels.some((l) => l.includes('Apply'))).toBe(true)
      expect(labels.some((l) => l.includes('Discard'))).toBe(true)
    })

    it('hides Apply and Discard buttons once the edit is applied', async () => {
      setupUseChatMock({ status: 'ready', messages: [msgWithProposal(true)] })
      const wrapper = createWrapper()
      await flushPromises()

      const buttons = wrapper.findAllComponents(OcButton)
      const labels = buttons.map((b) => b.text())
      expect(labels.some((l) => l.includes('Apply'))).toBe(false)
      expect(labels.some((l) => l.includes('Discard'))).toBe(false)
    })

    it('calls applyEdit with the proposal and message index when Apply is clicked', async () => {
      setupUseChatMock({ status: 'ready', messages: [msgWithProposal(false)] })
      const wrapper = createWrapper()
      await flushPromises()

      const applyBtn = wrapper.findAllComponents(OcButton).find((b) => b.text().includes('Apply'))
      await applyBtn?.trigger('click')

      expect(applyEditMock).toHaveBeenCalledWith('new file content', 0)
    })

    it('calls discardEdit with the message index when Discard is clicked', async () => {
      setupUseChatMock({ status: 'ready', messages: [msgWithProposal(false)] })
      const wrapper = createWrapper()
      await flushPromises()

      const discardBtn = wrapper
        .findAllComponents(OcButton)
        .find((b) => b.text().includes('Discard'))
      await discardBtn?.trigger('click')

      expect(discardEditMock).toHaveBeenCalledWith(0)
    })

    it('disables Apply and Discard when isApplying is true', async () => {
      setupUseChatMock({ status: 'ready', messages: [msgWithProposal(false)], isApplying: true })
      const wrapper = createWrapper()
      await flushPromises()

      const applyBtn = wrapper.findAllComponents(OcButton).find((b) => b.text().includes('Saving'))
      expect(applyBtn?.attributes('disabled')).toBeDefined()
    })
  })

  // -----------------------------------------------------------------------

  describe('lifecycle', () => {
    it('calls ensureReady on mount', async () => {
      setupUseChatMock({ status: 'ready' })
      createWrapper()
      await flushPromises()

      expect(ensureReadyMock).toHaveBeenCalledTimes(1)
    })

    it('passes llmConfig and resource props to useChat', async () => {
      const llmConfig = { endpoint: 'http://llm.local/v1', model: 'gpt-4' }
      const resource = { id: 'f1', extension: 'txt', name: 'report.txt' }
      setupUseChatMock({ status: 'ready' })
      createWrapper({ llmConfig, resource })
      await flushPromises()

      expect(vi.mocked(useChat)).toHaveBeenCalledWith(
        llmConfig,
        expect.objectContaining({ value: resource })
      )
    })
  })
})
