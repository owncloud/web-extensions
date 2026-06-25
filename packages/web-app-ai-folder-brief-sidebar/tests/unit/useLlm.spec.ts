import { describe, it, expect, vi } from 'vitest'

vi.mock('@ownclouders/web-pkg', async () => {
  const actual = await vi.importActual<typeof import('@ownclouders/web-pkg')>('@ownclouders/web-pkg')
  return { ...actual, useAuthStore: vi.fn().mockReturnValue({ accessToken: 'test-token' }) }
})

import { useLlm } from '../../src/composables/useLlm'
import type { LlmConfig } from '../../src/composables/useLlm'
import { useAuthStore } from '@ownclouders/web-pkg'

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

  it('buildHeaders returns Content-Type and Authorization when token is present', () => {
    const { buildHeaders } = useLlm(CONFIG)
    const headers = buildHeaders()
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['Authorization']).toBe('Bearer test-token')
  })

  it('buildHeaders omits Authorization when no token is present', () => {
    vi.mocked(useAuthStore).mockReturnValueOnce({ accessToken: '' } as any)
    const { buildHeaders } = useLlm(CONFIG)
    const headers = buildHeaders()
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['Authorization']).toBeUndefined()
  })
})
