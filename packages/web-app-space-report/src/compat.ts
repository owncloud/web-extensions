// @ownclouders/web-pkg 12.5.0 on npm ships without the .d.ts for piniaStores/capabilities,
// although the store is exported at runtime. Typed shim for the parts we use.
import * as webPkg from '@ownclouders/web-pkg'

export interface CapabilityStoreSubset {
  vaultEnabled: boolean
  authMfaEnabled: boolean
  authMfaRequiredLevelname: string
}

export const useCapabilityStore = (): CapabilityStoreSubset =>
  (webPkg as unknown as { useCapabilityStore: () => CapabilityStoreSubset }).useCapabilityStore()
