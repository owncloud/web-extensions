import { describe, it, expect, vi } from 'vitest'
import { useLLM } from '../../src/composables/useLLM'

vi.mock('@ownclouders/web-pkg', () => ({
  useAuthStore: () => ({ accessToken: null }),
}))

describe('useLLM', () => {
  it('is unconfigured when no config is provided', () => {
    const { status } = useLLM(null)
    expect(status.value).toBe('unconfigured')
  })

  it('marks cross-origin endpoints as cross-origin', () => {
    const { status } = useLLM({ endpoint: 'https://external-llm.example.com/v1', model: 'llama3.2' })
    expect(status.value).toBe('cross-origin')
  })
})
