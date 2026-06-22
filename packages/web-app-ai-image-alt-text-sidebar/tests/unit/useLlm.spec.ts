import { describe, it, expect, vi } from 'vitest'
import { useLlm } from '../../src/composables/useLlm'
import type { LlmConfig } from '../../src/composables/useLlm'

const CONFIG: LlmConfig = { endpoint: 'http://llm.local/v1', model: 'llava' }

describe('useLlm', () => {
  it('status is unconfigured when no config provided', async () => {
    const { status, ensureReady } = useLlm(null)
    await ensureReady()
    expect(status.value).toBe('unconfigured')
  })

  it('status is vision-ready when config is present and no probe is given', async () => {
    const { status, ensureReady } = useLlm(CONFIG)
    await ensureReady()
    expect(status.value).toBe('vision-ready')
  })

  it('status is vision-ready when probe returns true', async () => {
    const { status, ensureReady } = useLlm(CONFIG)
    await ensureReady(async () => true)
    expect(status.value).toBe('vision-ready')
  })

  it('status is text-only when probe returns false', async () => {
    const { status, ensureReady } = useLlm(CONFIG)
    await ensureReady(async () => false)
    expect(status.value).toBe('text-only')
  })

  it('stays unconfigured when probe throws', async () => {
    const { status, ensureReady } = useLlm(CONFIG)
    await ensureReady(async () => { throw new Error('infra error') })
    expect(status.value).toBe('unconfigured')
  })

  it('does not re-probe after status is already determined', async () => {
    const { status, ensureReady } = useLlm(CONFIG)
    const probe = vi.fn().mockResolvedValue(true)
    await ensureReady(probe)
    await ensureReady(probe)
    expect(probe).toHaveBeenCalledTimes(1)
    expect(status.value).toBe('vision-ready')
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
