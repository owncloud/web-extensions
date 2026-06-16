import { describe, it, expect } from 'vitest'
import { useLlm } from '../../src/composables/useLlm'
import type { LlmConfig } from '../../src/composables/useLlm'

const BASE_CONFIG: LlmConfig = {
  endpoint: 'http://llm.local/v1',
  model: 'test-model'
}

describe('useLlm', () => {
  describe('initial state', () => {
    it('status is unconfigured before ensureReady is called, even with a valid config', () => {
      const { status } = useLlm(BASE_CONFIG)
      expect(status.value).toBe('unconfigured')
    })

    it('status is unconfigured before ensureReady is called with null config', () => {
      const { status } = useLlm(null)
      expect(status.value).toBe('unconfigured')
    })
  })

  describe('ensureReady', () => {
    it('sets status to ready when a valid config is provided', () => {
      const { status, ensureReady } = useLlm(BASE_CONFIG)
      ensureReady()
      expect(status.value).toBe('ready')
    })

    it('keeps status as unconfigured when config is null', () => {
      const { status, ensureReady } = useLlm(null)
      ensureReady()
      expect(status.value).toBe('unconfigured')
    })

    it('is idempotent — calling it twice does not change the outcome', () => {
      const { status, ensureReady } = useLlm(BASE_CONFIG)
      ensureReady()
      ensureReady()
      expect(status.value).toBe('ready')
    })
  })

  describe('config exposure', () => {
    it('exposes the config passed to it', () => {
      const { config } = useLlm(BASE_CONFIG)
      expect(config.value).toEqual(BASE_CONFIG)
    })

    it('exposes null when no config is provided', () => {
      const { config } = useLlm(null)
      expect(config.value).toBeNull()
    })
  })
})
