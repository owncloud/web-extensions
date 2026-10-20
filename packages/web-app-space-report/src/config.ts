import { reactive } from 'vue'

export interface ReportConfig {
  /** a space counts as "almost full" from this percentage of its quota */
  thresholdPercent: number
  /** entries in the "largest" / "fullest" lists */
  topN: number
  /** folder in the personal space for "Save to my files" */
  saveFolder: string
}

const state = reactive<ReportConfig>({
  thresholdPercent: 90,
  topN: 10,
  saveFolder: 'Space reports'
})

export function applyReportConfig(raw: Record<string, unknown> | undefined | null) {
  const t = Number(raw?.thresholdPercent)
  const n = Number(raw?.topN)
  if (Number.isFinite(t) && t > 0 && t <= 100) state.thresholdPercent = t
  if (Number.isInteger(n) && n > 0 && n <= 100) state.topN = n
  if (typeof raw?.saveFolder === 'string') state.saveFolder = raw.saveFolder
}

export const useReportConfig = () => state
