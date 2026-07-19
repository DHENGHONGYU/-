/**
 * @module strategySnapshotStore
 * @description 策略快照页面状态管理层（L2）。
 * 管理当前策略与历史快照的状态，封装股票池、V6 评分、轮动评分的加载与快照保存逻辑。
  * @doc [V9-DOC-DATA-021, V9-DOC-BACK-010, V9-DOC-ARCH-008, V9-DOC-BACK-003, V9-DOC-QA-010]
*/

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import {
  classifyStocks,
  listSnapshots,
  saveStrategySnapshot,
} from '@/services/trading/strategySnapshotService'
import { listPoolItems } from '@/services/pool/poolService'
import type { PoolItem } from '@/types/modules/pool.types'
import { getAllV6Scores } from '@/services/scoring/v6ScoreService'
import { listRotationScores } from '@/services/analysis/rotationScoreService'
import type { RotationSectorScore, Stock, StrategySnapshot, V6Score } from '@/data/types'
import type { StrategyGroupItem } from '@/services/trading/strategySnapshotService'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION } from '@/config/dbConfig'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

function poolItemToStock(item: PoolItem): Stock {
  return {
    ...item,
    researchStatus: item.status,
  }
}

type ActiveTab = 'current' | 'history'

export interface ClassifiedItems {
  core: StrategyGroupItem[]
  hot: StrategyGroupItem[]
  value: StrategyGroupItem[]
}

interface StrategySnapshotState {
  activeTab: ActiveTab
  stocks: Stock[]
  v6Scores: V6Score[]
  rotationScores: RotationSectorScore[]
  items: ClassifiedItems
  snapshots: StrategySnapshot[]
  selectedSnapshot: StrategySnapshot | null
  loading: boolean
  saving: boolean
  error: string | null
}

interface StrategySnapshotActions {
  setActiveTab: (tab: ActiveTab) => void
  loadCurrentStrategy: () => Promise<void>
  loadHistorySnapshots: () => Promise<void>
  saveSnapshot: (trigger?: string) => Promise<void>
  selectSnapshot: (id: string) => void
  clearError: () => void
}

const initialItems: ClassifiedItems = { core: [], hot: [], value: [] }

const initialState: StrategySnapshotState = {
  activeTab: 'current',
  stocks: [],
  v6Scores: [],
  rotationScores: [],
  items: initialItems,
  snapshots: [],
  selectedSnapshot: null,
  loading: false,
  saving: false,
  error: null,
}

function buildClassifiedItems(items: StrategyGroupItem[]): ClassifiedItems {
  return {
    core: items.filter((item) => item.classification === 'core'),
    hot: items.filter((item) => item.classification === 'hot'),
    value: items.filter((item) => item.classification === 'value'),
  }
}

/**
 * useStrategySnapshotStore
 */
export const useStrategySnapshotStore = create<StrategySnapshotState & StrategySnapshotActions>(
  (set, get) => ({
    ...initialState,

    setActiveTab: (tab) => {
      set({ activeTab: tab, error: null })
    },

    loadCurrentStrategy: async () => {
      const t0 = Date.now()
      set({ loading: true, error: null })
      logger.info('[strategySnapshotStore] loadCurrentStrategy 开始')

      try {
        logger.info('[strategySnapshotStore] Promise.all 发起: poolItems + v6Scores + rotationScores')
        const [poolResult, v6Result, rotationResult] = await Promise.all([
          listPoolItems(),
          getAllV6Scores(),
          listRotationScores(),
        ])

        logger.info('[strategySnapshotStore] Promise.all 返回', {
          stocksOk: poolResult.success,
          stocksCount: poolResult.data?.length ?? 0,
          v6Ok: v6Result.success,
          v6Count: v6Result.data?.length ?? 0,
          rotationOk: rotationResult.success,
          rotationCount: rotationResult.data?.length ?? 0,
          elapsedMs: Date.now() - t0,
        })

        if (!poolResult.success || !v6Result.success || !rotationResult.success) {
          throw new Error(
            poolResult.error ?? v6Result.error ?? rotationResult.error ?? '加载当前数据失败',
          )
        }

        const stocks = (poolResult.data ?? []).map((item) => poolItemToStock(item))
        const v6Scores = v6Result.data ?? []
        const rotationScores = rotationResult.data ?? []

        // 用户在 await 期间切换了 tab，丢弃本次结果并释放 loading，
        // 否则 loading 永久为 true，StrategySnapshotPage 永远显示「加载中...」
        if (get().activeTab !== 'current') {
          logger.warn('[strategySnapshotStore] loadCurrentStrategy 期间 activeTab 已切换，丢弃结果', {
            elapsedMs: Date.now() - t0,
          })
          set({ loading: false })
          return
        }

        logger.info('[strategySnapshotStore] classifyStocks 调用中...')
        const classified = classifyStocks({ stocks, v6Scores, rotationScores })
        const items = buildClassifiedItems(classified)
        logger.info('[strategySnapshotStore] classifyStocks 完成', {
          core: items.core.length,
          hot: items.hot.length,
          value: items.value.length,
        })

        set({ stocks, v6Scores, rotationScores, items, loading: false })
        logger.info(`[strategySnapshotStore] loadCurrentStrategy 完成, 耗时 ${Date.now() - t0}ms`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error('[strategySnapshotStore] loadCurrentStrategy 失败', { error: message, elapsedMs: Date.now() - t0 })
        set({ error: message, loading: false })
      }
    },

    loadHistorySnapshots: async () => {
      const t0 = Date.now()
      set({ loading: true, error: null })
      logger.info('[strategySnapshotStore] loadHistorySnapshots 开始')

      try {
        logger.info('[strategySnapshotStore] listSnapshots(20) 调用中...')
        const result = await listSnapshots(20)

        logger.info('[strategySnapshotStore] listSnapshots 返回', {
          success: result.success,
          count: result.data?.length ?? 0,
          elapsedMs: Date.now() - t0,
        })

        // 用户在 await 期间切换了 tab，丢弃本次结果并释放 loading
        if (get().activeTab !== 'history') {
          logger.warn('[strategySnapshotStore] loadHistorySnapshots 期间 activeTab 已切换，丢弃结果', {
            elapsedMs: Date.now() - t0,
          })
          set({ loading: false })
          return
        }

        if (!result.success) {
          logger.error('[strategySnapshotStore] loadHistorySnapshots 失败', { error: result.error })
          set({ error: result.error ?? '加载历史快照失败', loading: false })
          return
        }

        const snapshots = result.data ?? []
        const selectedSnapshot = snapshots.length > 0 ? snapshots[0] : null

        set({ snapshots, selectedSnapshot, loading: false })
        logger.info(`[strategySnapshotStore] loadHistorySnapshots 完成: ${snapshots.length} 条, 耗时 ${Date.now() - t0}ms`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error('[strategySnapshotStore] loadHistorySnapshots 失败', { error: message, elapsedMs: Date.now() - t0 })
        set({ error: message, loading: false })
      }
    },

    saveSnapshot: async (trigger) => {
      const t0 = Date.now()
      const { stocks, v6Scores, rotationScores, activeTab } = get()
      if (stocks.length === 0) {
        logger.warn('[strategySnapshotStore] saveSnapshot 跳过：股票池为空')
        return
      }

      set({ saving: true, error: null })
      logger.info('[strategySnapshotStore] saveSnapshot 开始', { trigger, stockCount: stocks.length })

      try {
        logger.info('[strategySnapshotStore] saveStrategySnapshot 调用中...')
        const result = await saveStrategySnapshot({ stocks, v6Scores, rotationScores }, trigger)

        logger.info('[strategySnapshotStore] saveStrategySnapshot 返回', {
          success: result.success,
          elapsedMs: Date.now() - t0,
        })

        if (!result.success) {
          logger.error('[strategySnapshotStore] saveSnapshot 失败', { error: result.error })
          set({ error: result.error ?? '保存失败', saving: false })
          return
        }

        if (activeTab === 'history') {
          logger.info('[strategySnapshotStore] activeTab=history，刷新历史列表')
          await get().loadHistorySnapshots()
        }

        set({ saving: false })
        logger.info(`[strategySnapshotStore] saveSnapshot 完成, 耗时 ${Date.now() - t0}ms`)
        withBroadcast(EVENT_NAMES.STRATEGY_SNAPSHOTS_CHANGED, { action: 'save', trigger })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error('[strategySnapshotStore] saveSnapshot 失败', { error: message, elapsedMs: Date.now() - t0 })
        set({ error: message, saving: false })
      }
    },

    selectSnapshot: (id) => {
      const { snapshots } = get()
      const selectedSnapshot = snapshots.find((snapshot) => snapshot.id === id) ?? null
      set({ selectedSnapshot })
      withBroadcast(EVENT_NAMES.STRATEGY_SNAPSHOTS_CHANGED, { action: 'select', id })
    },

    clearError: () => {
      set({ error: null })
    },
  }),
)

// ============================================================
// DataBridge 订阅（用于跨模块数据同步）
// ============================================================

let _unsubscribeStrategySnapshots: (() => void) | undefined

/**
 * initStrategySnapshotStoreSubscriptions
 */
export function initStrategySnapshotStoreSubscriptions(): () => void {
  destroyStrategySnapshotStoreSubscriptions()
  logger.info('[strategySnapshotStore] 初始化 DataBridge strategy_snapshots 频道订阅')

  _unsubscribeStrategySnapshots = dataBridge.subscribe(
    'strategy_snapshots',
    (envelope) => {
      if (envelope.meta.action === ENVELOPE_ACTION.saveStrategySnapshots) {
        logger.info('[strategySnapshotStore] DataBridge event received: saveStrategySnapshot', {
          traceId: envelope.meta.traceId,
        })
      }
    },
  )

  return () => destroyStrategySnapshotStoreSubscriptions()
}

/**
 * destroyStrategySnapshotStoreSubscriptions
 * @returns void
 */
export function destroyStrategySnapshotStoreSubscriptions(): void {
  if (_unsubscribeStrategySnapshots) {
    _unsubscribeStrategySnapshots()
    _unsubscribeStrategySnapshots = undefined
  }
}
