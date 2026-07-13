/**
 * @fileoverview AnalysisOrchestrator 运行时 Store（Zustand）
 *
 * @module store/analysisOrchestratorStore
 * @created 2026-07-13 B1 阶段
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

export function makeAnalysisTraceId(symbol: string): string {
  return `analysis-${symbol}-${Date.now()}`
}
