/**
 * 注册与契约状态查询 Store
 *
 * @module store/registrationContractStore
 * @since 2026-07-18
  * @doc [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076, V9-DOC-DATA-075, V9-DOC-DATA-073]
*/

import { create } from 'zustand'
import type {
  StatusQueryInput,
  StatusQueryResult,
} from '@/types/modules/registration-contract.types'
import { queryStatusService } from '@/services/analysis/registrationContractService'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export interface RegistrationContractState {
  /** 当前查询结果 */
  result: StatusQueryResult | null
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 上次查询参数 */
  lastInput: StatusQueryInput | null

  /** 执行状态查询 */
  queryStatus: (input: StatusQueryInput) => Promise<void>
  /** 清空结果 */
  clearResult: () => void
  /** 重置 */
  reset: () => void
}

const initialState = {
  result: null as StatusQueryResult | null,
  loading: false,
  error: null as string | null,
  lastInput: null as StatusQueryInput | null,
}

/**
 * useRegistrationContractStore
 */
export const useRegistrationContractStore = create<RegistrationContractState>()(
  (set) => ({
    ...initialState,

    queryStatus: async (input: StatusQueryInput) => {
      logger.info('[RegistrationContractStore] queryStatus 开始', { userId: input.userId })
      set({ loading: true, error: null, lastInput: input })

      try {
        const result = await queryStatusService(input)
        set({ result, loading: false })
        logger.info('[RegistrationContractStore] queryStatus 完成', {
          anomalies: result.summary.totalAnomalies,
          healthScore: result.summary.healthScore,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error(`[RegistrationContractStore] queryStatus 失败: ${message}`)
        set({ error: message, loading: false })
      }
    },

    clearResult: () => set({ result: null, lastInput: null }),

    reset: () => set({ ...initialState }),
  }),
)
