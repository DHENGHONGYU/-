/**
 * @module strategySnapshotStore
 * @description 策略快照页面状态管理层（L2）。
 * 管理当前策略与历史快照的状态，封装股票池、V6 评分、轮动评分的加载与快照保存逻辑。
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import {
  classifyStocks,
  listSnapshots,
  saveStrategySnapshot,
} from '@/services/trading/strategySnapshotService'
import { listStocks } from '@/services/stockpool/stockpoolService'
import { getAllV6Scores } from '@/services/scoring/v6ScoreService'
import { listRotationScores } from '@/services/analysis/rotationScoreService'
import type { RotationSectorScore, Stock, StrategySnapshot, V6Score } from '@/data/types'
import type { StrategyGroupItem } from '@/services/trading/strategySnapshotService'
import { dataBridge } from '@/core/databridge'
import { ENVELOPE_ACTION } from '@/config/dbConfig'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

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

export const useStrategySnapshotStore = create<StrategySnapshotState & StrategySnapshotActions>(
  (set, get) => ({
    ...initialState,

    setActiveTab: (tab) => {
      set({ activeTab: tab, error: null })
    },

    loadCurrentStrategy: async () => {
      set({ loading: true, error: null })
      logger.info('[strategySnapshotStore] loadCurrentStrategy 开始')

      try {
        const [stockResult, v6Result, rotationResult] = await Promise.all([
          listStocks(),
          getAllV6Scores(),
          listRotationScores(),
        ])

        if (!stockResult.success || !v6Result.success || !rotationResult.success) {
          throw new Error(
            stockResult.error ?? v6Result.error ?? rotationResult.error ?? '加载当前数据失败',
          )
        }

        const stocks = stockResult.data ?? []
        const v6Scores = v6Result.data ?? []
        const rotationScores = rotationResult.data ?? []

        // 用户在 await 期间切换了 tab，丢弃本次结果并释放 loading，
        // 否则 loading 永久为 true，StrategySnapshotPage 永远显示「加载中...」
        if (get().activeTab !== 'current') {
          logger.warn('[strategySnapshotStore] loadCurrentStrategy 期间 activeTab 已切换，丢弃结果')
          set({ loading: false })
          return
        }

        const classified = classifyStocks({ stocks, v6Scores, rotationScores })
        const items = buildClassifiedItems(classified)

        set({ stocks, v6Scores, rotationScores, items, loading: false })
        logger.info('[strategySnapshotStore] loadCurrentStrategy 完成')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error('[strategySnapshotStore] loadCurrentStrategy 失败', { error: message })
        set({ error: message, loading: false })
      }
    },

    loadHistorySnapshots: async () => {
      set({ loading: true, error: null })
      logger.info('[strategySnapshotStore] loadHistorySnapshots 开始')

      try {
        const result = await listSnapshots(20)

        // 用户在 await 期间切换了 tab，丢弃本次结果并释放 loading
        if (get().activeTab !== 'history') {
          logger.warn('[strategySnapshotStore] loadHistorySnapshots 期间 activeTab 已切换，丢弃结果')
          set({ loading: false })
          return
        }

        if (!result.success) {
          set({ error: result.error ?? '加载历史快照失败', loading: false })
          return
        }

        const snapshots = result.data ?? []
        const selectedSnapshot = snapshots.length > 0 ? snapshots[0] : null

        set({ snapshots, selectedSnapshot, loading: false })
        logger.info(`[strategySnapshotStore] loadHistorySnapshots 完成: ${snapshots.length} 条`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error('[strategySnapshotStore] loadHistorySnapshots 失败', { error: message })
        set({ error: message, loading: false })
      }
    },

    saveSnapshot: async (trigger) => {
      const { stocks, v6Scores, rotationScores, activeTab } = get()
      if (stocks.length === 0) {
        logger.warn('[strategySnapshotStore] saveSnapshot 跳过：股票池为空')
        return
      }

      set({ saving: true, error: null })
      logger.info('[strategySnapshotStore] saveSnapshot 开始', { trigger })

      try {
        const result = await saveStrategySnapshot({ stocks, v6Scores, rotationScores }, trigger)

        if (!result.success) {
          set({ error: result.error ?? '保存失败', saving: false })
          return
        }

        if (activeTab === 'history') {
          await get().loadHistorySnapshots()
        }

        set({ saving: false })
        logger.info('[strategySnapshotStore] saveSnapshot 完成')
        withBroadcast(EVENT_NAMES.STRATEGY_SNAPSHOTS_CHANGED, { action: 'save', trigger })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error('[strategySnapshotStore] saveSnapshot 失败', { error: message })
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

export function destroyStrategySnapshotStoreSubscriptions(): void {
  if (_unsubscribeStrategySnapshots) {
    _unsubscribeStrategySnapshots()
    _unsubscribeStrategySnapshots = undefined
  }
}
