import { describe, it, expect } from 'vitest'
import { useLlm } from '../../src/composables/useLlm'
import type { LlmConfig } from '../../src/composables/useLlm'

const VISION_CONFIG: LlmConfig = { endpoint: 'http://llm.local/v1', model: 'gpt-4o', vision: true }
const TEXT_CONFIG: LlmConfig = { endpoint: 'http://llm.local/v1', model: 'gpt-4', vision: false }

describe('useLlm', () => {
  it('status is unconfigured when no config provided', async () => {
    const { status, ensureReady } = useLlm(null)
    await ensureReady()
    expect(status.value).toBe('unconfigured')
  })

  it('status is vision-ready when vision: true', async () => {
    const { status, ensureReady } = useLlm(VISION_CONFIG)
    await ensureReady()
    expect(status.value).toBe('vision-ready')
  })

  it('status is text-only when vision: false', async () => {
    const { status, ensureReady } = useLlm(TEXT_CONFIG)
    await ensureReady()
    expect(status.value).toBe('text-only')
  })

  it('status is text-only when vision is absent', async () => {
    const { status, ensureReady } = useLlm({ endpoint: 'http://llm.local/v1', model: 'gpt-4' })
    await ensureReady()
    expect(status.value).toBe('text-only')
  })

  it('exposes the initial config', () => {
    const { config } = useLlm(VISION_CONFIG)
    expect(config.value).toEqual(VISION_CONFIG)
  })

  it('exposes null config when unconfigured', () => {
    const { config } = useLlm(null)
    expect(config.value).toBeNull()
  })
})
