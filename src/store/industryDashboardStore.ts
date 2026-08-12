/**
 * @module industryDashboardStore
 * @description 行业仪表盘页面状态管理。封装 V4 行业分析 + 轮动信号数据加载，
 * 通过 fetchIndustryDashboardUseCase 执行业务编排。
 *
 * @compliance DF-002 合规：数据访问经由 Store action 分发
 * @doc [V9-DOC-PROJ-124, V9-DOC-BACK-006, V9-DOC-PROJ-001, V9-DOC-PROD-001]
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { fetchIndustryDashboardUseCase } from '@/services/useCase/fetchIndustryDashboard.useCase'
import type {
  IndustryV4AnalysisEnhanced,
  IndustryRotationSignal,
} from '@/data/types/types.sector'

const logger = getLogger()

// ============================================================
// Store 接口
// ============================================================

interface IndustryDashboardState {
  /** V4 行业分析列表 */
  v4Analyses: IndustryV4AnalysisEnhanced[]
  /** 行业轮动信号 */
  rotationSignals: IndustryRotationSignal[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 空态原因 */
  emptyReason: string | null
  /** 最后更新时间戳 */
  lastUpdated: number
  /** 是否正在刷新（防重入锁） */
  isRefreshing: boolean

  // Actions
  fetchDashboard: (forceRefresh?: boolean) => Promise<void>
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  /** 重置 store 到初始空状态 */
  reset: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  v4Analyses: [] as IndustryV4AnalysisEnhanced[],
  rotationSignals: [] as IndustryRotationSignal[],
  loading: false,
  error: null as string | null,
  emptyReason: null as string | null,
  lastUpdated: 0,
  isRefreshing: false,
}

// ============================================================
// Store
// ============================================================

/**
 * useIndustryDashboardStore
 */
export const useIndustryDashboardStore = create<IndustryDashboardState>((set, get) => ({
  ...initialState,

  fetchDashboard: async (forceRefresh = false) => {
    const { isRefreshing } = get()
    if (isRefreshing) {
      logger.debug('[industryDashboardStore] fetchDashboard 已在进行中，跳过并发调用')
      return
    }

    const isFirstLoad = get().v4Analyses.length === 0 && get().lastUpdated === 0
    logger.info(`[industryDashboardStore] fetchDashboard 开始 (${isFirstLoad ? '首次加载' : '增量刷新'})`)
    set({ isRefreshing: true, loading: isFirstLoad, error: null, emptyReason: null })

    try {
      const result = await fetchIndustryDashboardUseCase({ forceRefresh })

      if (!result.success) {
        logger.error('[industryDashboardStore] 数据加载失败', { error: result.error })
        set({
          error: result.error ?? '加载失败',
          v4Analyses: [],
          rotationSignals: [],
          emptyReason: null,
        })
        return
      }

      logger.info('[industryDashboardStore] 数据加载完成', {
        industryCount: result.v4Analyses.length,
        signalCount: result.rotationSignals.length,
      })

      set({
        v4Analyses: result.v4Analyses,
        rotationSignals: result.rotationSignals,
        emptyReason: result.emptyReason ?? null,
        lastUpdated: Date.now(),
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[industryDashboardStore] 加载异常', { error: message })
      set({
        error: message,
        v4Analyses: [],
        rotationSignals: [],
      })
    } finally {
      set({ isRefreshing: false, loading: false })
    }
  },

  setLoading: (loading: boolean) => set({ loading }),

  setError: (error: string | null) => set({ error }),

  reset: () => set({ ...initialState }),
}))
