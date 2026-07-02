/**
 * @module sectorAnalysisStore
 * @description 板块分析页面状态管理。管理板块轮动评分与行业评分数据，
 * 通过 sectorAnalysisEngine 计算并从 dataLayer 加载数据。
 *
 * @compliance DF-002 合规：引擎调用经由 Store action 分发
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import type { RotationSectorScore, IndustryScore } from '@/data/types'
import {
  calculateAndSaveDefaultRotationScores,
  calculateAndSaveDefaultIndustryScores,
  getRotationScores,
  getIndustryScores,
} from '@/services/analysis/sectorAnalysisEngine'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION } from '@/config/dbConfig'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

// ============================================================
// Store 接口
// ============================================================

interface SectorAnalysisState {
  /** 板块轮动评分列表 */
  rotationScores: RotationSectorScore[]
  /** 行业评分列表 */
  industryScores: IndustryScore[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 最后更新时间戳 */
  lastUpdated: number
  /** 是否正在刷新（防重入锁） */
  isRefreshing: boolean

  // Actions
  fetchSectorAnalysis: () => Promise<void>
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clear: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  rotationScores: [] as RotationSectorScore[],
  industryScores: [] as IndustryScore[],
  loading: false,
  error: null as string | null,
  lastUpdated: 0,
  isRefreshing: false,
}

// ============================================================
// Store
// ============================================================

export const useSectorAnalysisStore = create<SectorAnalysisState>((set, get) => ({
  ...initialState,

  fetchSectorAnalysis: async () => {
    const { isRefreshing } = get()
    if (isRefreshing) {
      logger.debug('[sectorAnalysisStore] fetchSectorAnalysis 已在进行中，跳过并发调用')
      return
    }

    const isFirstLoad = get().rotationScores.length === 0 && get().industryScores.length === 0 && get().lastUpdated === 0
    logger.info(`[sectorAnalysisStore] fetchSectorAnalysis 开始 (${isFirstLoad ? '首次加载' : '增量刷新'})`)
    set({ isRefreshing: true, loading: isFirstLoad, error: null })

    try {
      // 首先尝试从 dataLayer 读取已持久化的数据
      const [rotationResult, industryResult] = await Promise.all([
        getRotationScores(),
        getIndustryScores(),
      ])

      let rotation: RotationSectorScore[] = []
      let industry: IndustryScore[] = []

      // 处理板块轮动评分结果
      if (!rotationResult.success) {
        // 如果查询失败，设置错误信息
        logger.error(`[sectorAnalysisStore] 板块轮动评分查询失败: ${rotationResult.error}`)
        set({ error: rotationResult.error ?? '板块轮动评分查询失败', loading: false, isRefreshing: false })
        return
      }

      if (rotationResult.data && rotationResult.data.length > 0) {
        rotation = rotationResult.data
        logger.info(`[sectorAnalysisStore] 从 dataLayer 加载 ${rotation.length} 条板块轮动评分`)
      } else {
        // 数据为空时，计算并保存默认评分
        logger.info('[sectorAnalysisStore] 板块轮动评分为空，开始计算默认数据')
        const calcResult = await calculateAndSaveDefaultRotationScores()
        if (calcResult.success && calcResult.data) {
          rotation = calcResult.data
        } else if (calcResult.error) {
          logger.error(`[sectorAnalysisStore] 计算默认板块轮动评分失败: ${calcResult.error}`)
          set({ error: calcResult.error, loading: false, isRefreshing: false })
          return
        }
      }

      // 处理行业评分结果
      if (!industryResult.success) {
        // 如果查询失败，设置错误信息
        logger.error(`[sectorAnalysisStore] 行业评分查询失败: ${industryResult.error}`)
        set({ error: industryResult.error ?? '行业评分查询失败', loading: false, isRefreshing: false })
        return
      }

      if (industryResult.data && industryResult.data.length > 0) {
        industry = industryResult.data
        logger.info(`[sectorAnalysisStore] 从 dataLayer 加载 ${industry.length} 条行业评分`)
      } else {
        // 数据为空时，计算并保存默认评分
        logger.info('[sectorAnalysisStore] 行业评分为空，开始计算默认数据')
        const calcResult = await calculateAndSaveDefaultIndustryScores()
        if (calcResult.success && calcResult.data) {
          industry = calcResult.data
        } else if (calcResult.error) {
          logger.error(`[sectorAnalysisStore] 计算默认行业评分失败: ${calcResult.error}`)
          set({ error: calcResult.error, loading: false, isRefreshing: false })
          return
        }
      }

      // 排序
      const sortedRotation = rotation.sort((a, b) => b.total - a.total)
      const sortedIndustry = industry.sort((a, b) => (b.scoredAt ?? 0) - (a.scoredAt ?? 0))

      set({
        rotationScores: sortedRotation,
        industryScores: sortedIndustry,
        loading: false,
        isRefreshing: false,
        lastUpdated: Date.now(),
      })

      logger.info('[sectorAnalysisStore] 数据加载完成', {
        rotation: sortedRotation.length,
        industry: sortedIndustry.length,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('[sectorAnalysisStore] 数据加载失败', { error: message })
      set({ error: message, loading: false, isRefreshing: false })
    }
  },

  setLoading: (loading: boolean) => {
    set({ loading })
  },

  setError: (error: string | null) => {
    set({ error })
  },

  clear: () => {
    logger.info('[sectorAnalysisStore] clear')
    set({ ...initialState })
    withBroadcast(EVENT_NAMES.SECTOR_ANALYSIS_CHANGED, { action: 'clear' })
  },
}))

// ============================================================
// DataBridge 订阅（用于跨模块数据同步）
// ============================================================

let _unsubscribeSectorScores: (() => void) | undefined

export function initSectorAnalysisStoreSubscriptions(): () => void {
  destroySectorAnalysisStoreSubscriptions()
  logger.info('[sectorAnalysisStore] 初始化 DataBridge sector_scores 频道订阅')

  _unsubscribeSectorScores = dataBridge.subscribe(
    'sector_scores',
    (envelope) => {
      if (envelope.meta.action === ENVELOPE_ACTION.saveSectorScores) {
        logger.info('[sectorAnalysisStore] DataBridge event received: saveSectorScore', {
          traceId: envelope.meta.traceId,
        })
      }
    },
  )

  return () => destroySectorAnalysisStoreSubscriptions()
}

export function destroySectorAnalysisStoreSubscriptions(): void {
  if (_unsubscribeSectorScores) {
    _unsubscribeSectorScores()
    _unsubscribeSectorScores = undefined
  }
}
