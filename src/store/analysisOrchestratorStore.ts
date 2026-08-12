/**
 * @fileoverview AnalysisOrchestrator 运行时 Store（Zustand）
 * @unused — 已实现但当前无 UI 层消费者，待后续产品规划接入。
 *
 * @module store/analysisOrchestratorStore
 * @created 2026-07-13 B1 阶段
  * @doc [V9-DOC-PROJ-053, V9-DOC-BACK-006, V9-DOC-PROJ-124, V9-DOC-PROJ-107, V9-DOC-PROD-001]
*/

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { withBroadcast } from '@/lib/withBroadcast'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { runAnalysis } from '@/services/analysis/analysisOrchestrator'
import type { AnalysisRequest, AnalysisResult } from '@/types/modules/analysisOrchestrator.types'

const logger = getLogger()

interface AnalysisOrchestratorState {
  results: Record<string, AnalysisResult>
  loading: boolean
  error: string | undefined
  analyze: (symbol: string, options?: Omit<AnalysisRequest, 'symbol'>) => Promise<AnalysisResult | undefined>
}

/**
 * useAnalysisOrchestratorStore
 */
export const useAnalysisOrchestratorStore = create<AnalysisOrchestratorState>((set) => ({
  results: {},
  loading: false,
  error: undefined,

  analyze: async (symbol, options) => {
    set({ loading: true, error: undefined })
    try {
      const result = await runAnalysis({ symbol, ...options })
      if (result.success && result.data) {
        set((s) => ({
          results: { ...s.results, [symbol]: result.data! },
          loading: false,
        }))
        withBroadcast(EVENT_NAMES.ANALYSIS_RESULT_CHANGED, {
          action: 'analyze',
          symbol,
          docId: result.data.docId,
        })
        return result.data
      }
      set({ loading: false, error: result.error })
      return undefined
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[analysisOrchestratorStore] analyze failed: ${message}`)
      set({ loading: false, error: message })
      return undefined
    }
  },
}))

/**
 * makeAnalysisTraceId
 * @param symbol
 * @returns string
 */
export function makeAnalysisTraceId(symbol: string): string {
  return `analysis-${symbol}-${Date.now()}`
}
