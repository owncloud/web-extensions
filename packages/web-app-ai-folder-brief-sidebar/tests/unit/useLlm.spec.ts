import { describe, it, expect } from 'vitest'
import { useLlm } from '../../src/composables/useLlm'
import type { LlmConfig } from '../../src/composables/useLlm'

const CONFIG: LlmConfig = { endpoint: 'http://llm.local/v1', model: 'llama3.2' }

describe('useLlm', () => {
  it('status is unconfigured when no config provided', async () => {
    const { status, ensureReady } = useLlm(null)
    await ensureReady()
    expect(status.value).toBe('unconfigured')
  })

  it('status is ready when config is provided', async () => {
    const { status, ensureReady } = useLlm(CONFIG)
    await ensureReady()
    expect(status.value).toBe('ready')
  })

  it('exposes the initial config', () => {
    const { config } = useLlm(CONFIG)
    expect(config.value).toEqual(CONFIG)
  })

  it('exposes null config when unconfigured', () => {
    const { config } = useLlm(null)
    expect(config.value).toBeNull()
  })
})
