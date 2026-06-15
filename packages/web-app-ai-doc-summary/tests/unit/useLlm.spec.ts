import { describe, it, expect } from 'vitest'
import { useLlm } from '../../src/composables/useLlm'
import type { LlmConfig } from '../../src/composables/useLlm'

const BASE_CONFIG: LlmConfig = {
  endpoint: 'http://llm.local/v1',
  model: 'test-model'
}

describe('useLlm', () => {
  it('status is unconfigured when no config is provided', async () => {
    const { status, ensureReady } = useLlm(null)
    await ensureReady()
    expect(status.value).toBe('unconfigured')
  })

  it('status is ready when config is provided', async () => {
    const { status, ensureReady } = useLlm(BASE_CONFIG)
    await ensureReady()
    expect(status.value).toBe('ready')
  })

  it('exposes the initial config', () => {
    const { config } = useLlm(BASE_CONFIG)
    expect(config.value).toEqual(BASE_CONFIG)
  })

  it('exposes null config when unconfigured', () => {
    const { config } = useLlm(null)
    expect(config.value).toBeNull()
  })
})
