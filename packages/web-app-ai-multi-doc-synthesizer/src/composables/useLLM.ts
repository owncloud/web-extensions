import { ref, readonly } from 'vue'

// LLMConfig is sourced from the oCIS admin-configured extension config.
// It is never hardcoded; the admin sets endpoint + model via oCIS config.
export interface LLMConfig {
  endpoint: string  // OpenAI-compatible base URL (e.g. https://ollama.internal/v1)
  model: string
  apiKey?: string   // optional; empty for keyless endpoints
}

// LLMCapabilities describes what the configured model supports.
// Derived by probing the endpoint once per endpoint+model pair.
export interface LLMCapabilities {
  structuredOutput: boolean  // JSON mode / response_format
  toolUse: boolean           // function calling
  contextTokens: number      // usable context window in tokens
  streaming: boolean         // SSE streaming
}

const _caps = ref<LLMCapabilities | null>(null)
const _probeKey = ref('')   // cache key: endpoint + model

// Tier degradation thresholds
const MIN_CONTEXT_TOKENS = 4096

// probe sends a minimal request to detect model capabilities.
// Results are cached per endpoint+model so probing is not per-request.
async function probe(cfg: LLMConfig): Promise<LLMCapabilities> {
  const key = `${cfg.endpoint}::${cfg.model}`
  if (_caps.value !== null && _probeKey.value === key) {
    return _caps.value
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.apiKey) {
    headers['Authorization'] = `Bearer ${cfg.apiKey}`
  }

  // Probe 1: JSON / structured output — attempt with response_format
  let structuredOutput = false
  try {
    const r = await fetch(`${cfg.endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: 'Reply with: {"ok":true}' }],
        response_format: { type: 'json_object' },
        max_tokens: 20
      })
    })
    if (r.ok) {
      const d = await r.json() as { choices?: { message?: { content?: string } }[] }
      const content = d.choices?.[0]?.message?.content ?? ''
      structuredOutput = content.includes('{')
    }
  } catch {
    // structured output not supported or endpoint unreachable
  }

  // Probe 2: tool/function calling — attempt with tools array
  let toolUse = false
  try {
    const r = await fetch(`${cfg.endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: 'What is 2+2?' }],
        tools: [{
          type: 'function',
          function: { name: 'answer', description: 'Return the answer', parameters: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] } }
        }],
        max_tokens: 50
      })
    })
    if (r.ok) {
      const d = await r.json() as { choices?: { message?: { tool_calls?: unknown[] } }[] }
      toolUse = (d.choices?.[0]?.message?.tool_calls?.length ?? 0) > 0
    }
  } catch {
    // tool use not supported
  }

  // Probe 3: context window — read from model info if available
  let contextTokens = MIN_CONTEXT_TOKENS
  try {
    const r = await fetch(`${cfg.endpoint}/models`, { headers })
    if (r.ok) {
      const d = await r.json() as { data?: { id: string; context_length?: number }[] }
      const modelInfo = d.data?.find(m => m.id === cfg.model)
      if (modelInfo?.context_length && modelInfo.context_length > 0) {
        contextTokens = modelInfo.context_length
      }
    }
  } catch {
    // /models endpoint not available; use minimum
  }

  // Probe 4: streaming — check if SSE works
  let streaming = false
  try {
    const r = await fetch(`${cfg.endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true,
        max_tokens: 5
      })
    })
    streaming = r.ok && (r.headers.get('content-type') ?? '').includes('text/event-stream')
    // We don't consume the body; close immediately.
    await r.body?.cancel()
  } catch {
    // streaming not supported
  }

  const caps: LLMCapabilities = { structuredOutput, toolUse, contextTokens, streaming }
  _probeKey.value = key
  _caps.value = caps
  return caps
}

export interface UseLLMReturn {
  capabilities: ReturnType<typeof readonly<typeof _caps>>
  complete(messages: ChatMessage[], opts?: CompletionOptions): Promise<string>
  completeJSON<T>(messages: ChatMessage[], schema?: string): Promise<T>
  stream(messages: ChatMessage[], onChunk: (chunk: string) => void): Promise<void>
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionOptions {
  maxTokens?: number
  temperature?: number
}

// useLLM is the required integration point for all agentic extensions.
// It configures itself from the admin-provided LLMConfig, probes the
// endpoint once, and exposes a capabilities object + tier-degraded methods.
//
// No telemetry, no provider phone-home, no hardcoded keys.
// All traffic goes to cfg.endpoint only.
export function useLLM(cfg: LLMConfig): UseLLMReturn {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.apiKey) {
    headers['Authorization'] = `Bearer ${cfg.apiKey}`
  }

  // Initiate probe (cached; safe to call multiple times)
  probe(cfg).catch(() => { /* probe failure is non-fatal */ })

  // complete sends a single chat-completion request and returns the response text.
  // Falls back to a simpler format if the model can't handle the request.
  async function complete(messages: ChatMessage[], opts: CompletionOptions = {}): Promise<string> {
    const caps = await probe(cfg)

    // Chunk large inputs if context window is small
    const approxTokens = messages.reduce((n, m) => n + Math.ceil(m.content.length / 4), 0)
    const truncated = approxTokens > caps.contextTokens * 0.8
    let effectiveMessages = messages
    if (truncated) {
      // Summarise earlier messages to fit in context
      effectiveMessages = summariseMessages(messages, caps.contextTokens)
    }

    const body = {
      model: cfg.model,
      messages: effectiveMessages,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.7
    }

    const r = await fetch(`${cfg.endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    if (!r.ok) {
      throw new Error(`LLM request failed: ${r.status} ${r.statusText}`)
    }
    const d = await r.json() as { choices: { message: { content: string } }[] }
    const content = d.choices[0]?.message?.content ?? ''
    return truncated ? `[Note: large input was summarised]\n\n${content}` : content
  }

  // completeJSON requests a structured JSON response.
  // Degrades to prompt-with-format-instructions if the model lacks JSON mode.
  async function completeJSON<T>(messages: ChatMessage[], schema?: string): Promise<T> {
    const caps = await probe(cfg)

    if (caps.structuredOutput) {
      const body = {
        model: cfg.model,
        messages,
        response_format: { type: 'json_object' },
        max_tokens: 2048
      }
      const r = await fetch(`${cfg.endpoint}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
      if (!r.ok) throw new Error(`LLM JSON request failed: ${r.status}`)
      const d = await r.json() as { choices: { message: { content: string } }[] }
      return JSON.parse(d.choices[0].message.content) as T
    }

    // Degradation: inject format instructions into the prompt
    const formatInstruction = schema
      ? `\n\nRespond ONLY with valid JSON matching this schema:\n${schema}`
      : '\n\nRespond ONLY with valid JSON. No explanation.'
    const augmented: ChatMessage[] = [
      ...messages.slice(0, -1),
      { ...messages[messages.length - 1], content: messages[messages.length - 1].content + formatInstruction }
    ]
    const text = await complete(augmented)
    // Tolerant parsing: find the first {...} or [...] block
    const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    if (!match) throw new Error('LLM did not return parseable JSON')
    return JSON.parse(match[1]) as T
  }

  // stream delivers response chunks to onChunk as they arrive.
  // Degrades to a buffered single response if the model doesn't support SSE.
  async function stream(messages: ChatMessage[], onChunk: (chunk: string) => void): Promise<void> {
    const caps = await probe(cfg)

    if (caps.streaming) {
      const r = await fetch(`${cfg.endpoint}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: cfg.model, messages, stream: true, max_tokens: 1024 })
      })
      if (!r.ok) throw new Error(`LLM stream failed: ${r.status}`)

      const reader = r.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
          try {
            const data = JSON.parse(line.slice(6)) as { choices: { delta: { content?: string } }[] }
            const chunk = data.choices[0]?.delta?.content
            if (chunk) onChunk(chunk)
          } catch { /* malformed SSE chunk; skip */ }
        }
      }
    } else {
      // Buffered degradation: show spinner in caller, deliver all at once
      const text = await complete(messages)
      onChunk(text)
    }
  }

  return {
    capabilities: readonly(_caps),
    complete,
    completeJSON,
    stream
  }
}

// summariseMessages truncates early messages to fit within the context budget.
// In production, a more sophisticated summarisation approach would be used.
function summariseMessages(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
  const budget = Math.floor(maxTokens * 0.7 * 4) // rough char budget
  let total = 0
  const kept: ChatMessage[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    total += messages[i].content.length
    if (total > budget && kept.length > 0) {
      kept.unshift({ role: 'system', content: '[Earlier context was truncated to fit the model context window]' })
      break
    }
    kept.unshift(messages[i])
  }
  return kept
}
