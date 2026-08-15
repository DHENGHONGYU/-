/**
 * @module dualStrategyStore
 * @lifecycle @Global
 * @description 双策略信号池（Dual Strategy Signal Pool）。
 * 合并 hotSectorStore、valuePitStore、rotationSignalStore 的职责，成为统一的
 * 热门板块评分、价值洼地评分、轮动信号状态管理中心。
 *
 * 数据来源与持久化：
 * - 计算层统一调用 dualStrategyEngine.runDualStrategy() 一次性产出三类结果。
 * - 持久化到 DataBridge：hot_sector_scores / value_pit_scores / signals（轮动信号）。
 * - 刷新时从 DataBridge 读取已持久化的评分与信号。
 *
 * @see docs/reference/v9核心数据字典与类型定义(整合版).md — DualStrategyState 实体定义（#68）
 * 原文档（功能模块数据契约、v9-system-blueprint）已归档至 archive/historical-2026-08-16/batch7/
 * @see src/services/trading/dualStrategyEngine.ts — 双策略计算引擎
 * @see src/services/scoring/hotSectorAnalyzer.ts — 热门板块评分分析器
 * @see src/services/scoring/valuePitAnalyzer.ts — 价值洼地评分分析器
 * @see src/services/scoring/rotationSignalDetector.ts — 轮动信号检测器
 *
 * @compliance
 * - 所有展示数据来自 scoring / trading 服务，禁止硬编码
 * - 股票池为空时返回空数组，不 fallback 到任何 Mock 数据
 * - 使用 isRefreshing 锁与失败快照回滚
 * - 订阅采用去抖合并，source 过滤防止自激
 * - 遵循现有 Zustand Store 风格
  * @doc [V9-DOC-BACK-003, V9-DOC-BACK-010, V9-DOC-ARCH-008, V9-DOC-BACK-006, V9-DOC-DATA-021]
*/

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import type { HotSectorScore, ValuePitScore, Signal, Stock } from '@/data/types'
import type { RotationSignal } from '@/services/scoring/rotationSignalDetector'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { runDualStrategy } from '@/services/trading/dualStrategyEngine'
import { ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/lib/withBroadcast'

const logger = getLogger()

/** 生成 traceId */
function createTraceId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ============================================================
// Store 接口
// ============================================================

export interface DualStrategyState {
  /** 热门板块评分列表 */
  hotSectorScores: HotSectorScore[]
  /** 价值洼地评分列表 */
  valuePitScores: ValuePitScore[]
  /** 轮动信号列表 */
  rotationSignals: RotationSignal[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 是否正在刷新（防重入锁） */
  isRefreshing: boolean
  /** 最后更新时间戳 */
  lastUpdated: number

  // Actions
  /**
   * 执行双策略评分并持久化。
   * - 传入 stocks 时直接作为输入
   * - 否则通过 DataBridge.query(stocks) 获取股票池
   * - 股票池为空时使用默认样本数据
   */
  fetchScores: (stocks?: Stock[]) => Promise<void>
  /** 从 DataBridge 读取已持久化的评分与信号 */
  refresh: () => Promise<void>
  /** 清空所有双策略状态 */
  clearScores: () => void
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  hotSectorScores: [] as HotSectorScore[],
  valuePitScores: [] as ValuePitScore[],
  rotationSignals: [] as RotationSignal[],
  loading: false,
  error: null as string | null,
  isRefreshing: false,
  lastUpdated: 0,
}

// ============================================================
// 快照工具（失败回滚）
// ============================================================

interface StateSnapshot {
  hotSectorScores: HotSectorScore[]
  valuePitScores: ValuePitScore[]
  rotationSignals: RotationSignal[]
  lastUpdated: number
}

/**
 * getSnapshot
 * @param state
 * @returns StateSnapshot
 */
export function getSnapshot(state: DualStrategyState): StateSnapshot {
  return {
    hotSectorScores: state.hotSectorScores,
    valuePitScores: state.valuePitScores,
    rotationSignals: state.rotationSignals,
    lastUpdated: state.lastUpdated,
  }
}

// ============================================================
// Signal → RotationSignal 转换
// ============================================================

/**
 * signalToRotationSignal
 * @param signal
 * @returns RotationSignal
 */
export function signalToRotationSignal(signal: Signal): RotationSignal {
  return {
    sectorId: signal.symbol,
    triggered: true,
    conditions: {
      volumeBreakthrough: true,
      capitalInflow: true,
      goldenCross: true,
    },
    strength: signal.confidence >= 0.7 ? 'strong' : signal.confidence >= 0.4 ? 'medium' : 'weak',
    detectedAt: signal.createdAt,
  }
}

/**
 * rotationSignalToSignal
 * @param rotation
 * @returns Signal
 */
export function rotationSignalToSignal(rotation: RotationSignal): Signal {
  return {
    id: `rot-${rotation.sectorId}-${Date.now()}`,
    symbol: rotation.sectorId,
    direction: 'buy',
    type: 'buy_rotation',
    confidence: rotation.strength === 'strong' ? 0.8 : rotation.strength === 'medium' ? 0.6 : 0.4,
    rationale: `轮动信号触发：${rotation.sectorId}`,
    snapshot: {},
    createdAt: rotation.detectedAt,
    strategy: 'value-pit',
  }
}

// ============================================================
// Store
// ============================================================

/**
 * useDualStrategyStore
 */
export const useDualStrategyStore = create<DualStrategyState>((set, get) => ({
  ...initialState,

  fetchScores: async (stocks) => {
    const { isRefreshing } = get()
    if (isRefreshing) {
      logger.debug('[dualStrategyStore] fetchScores 已在进行中，跳过并发调用')
      return
    }

    const isFirstLoad = get().hotSectorScores.length === 0 && get().valuePitScores.length === 0 && get().lastUpdated === 0
    const snapshot = getSnapshot(get())

    logger.info(`[dualStrategyStore] fetchScores 开始 (${isFirstLoad ? '首次加载' : '增量刷新'})`)
    set({ isRefreshing: true, loading: isFirstLoad, error: null })

    try {
      let inputStocks = stocks

      if (!inputStocks) {
        // [DF-003 整改] 通过 DataBridge 获取股票池，不再直接引用 poolStore 或 dataLayer
        const stocksResult = await dataBridge.query<Stock[]>({
          action: ENVELOPE_ACTION.queryList,
          store: STORE_NAME.stocks,
          source: MODULE_ID.strategy,
        })
        if (!stocksResult.success) {
          throw new Error(stocksResult.error ?? '获取股票池失败')
        }
        inputStocks = stocksResult.data ?? []
        logger.info(`[dualStrategyStore] 从 DataBridge 获取股票池: ${inputStocks.length} 只`)
      } else {
        logger.info(`[dualStrategyStore] 使用传入股票池: ${inputStocks.length} 只`)
      }

      let hotSectorScores: HotSectorScore[] = []
      let valuePitScores: ValuePitScore[] = []
      let rotationSignals: RotationSignal[] = []
      let signals: Signal[] = []

      if (inputStocks.length > 0) {
        const result = await runDualStrategy(inputStocks, { persistScores: false })
        if (!result.success || !result.data) {
          throw new Error(result.error ?? '双策略分析失败')
        }

        hotSectorScores = result.data.hotSectorScores
        valuePitScores = result.data.valuePitScores
        signals = result.data.signals
        rotationSignals = signals
          .filter((s) => s.type === 'buy_rotation')
          .map((s) => signalToRotationSignal(s))
      } else {
        logger.info('[dualStrategyStore] 股票池为空，返回空结果')
        // 不使用任何 Mock 数据作为回退；调用方需自行处理空结果状态
        hotSectorScores = []
        valuePitScores = []
        rotationSignals = []
        signals = []
      }

      // 排序
      hotSectorScores.sort((a, b) => b.score - a.score)
      valuePitScores.sort((a, b) => b.score - a.score)

      // 持久化到 DataBridge
      logger.info(
        `[dualStrategyStore] 准备持久化: hot=${hotSectorScores.length}, value=${valuePitScores.length}, signals=${signals.length}`
      )
      const baseTraceId = createTraceId('ds-save')
      await Promise.all([
        ...hotSectorScores.map((score) =>
          dataBridge.forward(
            EnvelopeFactory.create(
              {
                source: MODULE_ID.strategy,
                target: ENVELOPE_TARGET.db,
                action: ENVELOPE_ACTION.saveScores,
                traceId: `${baseTraceId}-hot`,
              },
              score,
            ),
          ),
        ),
        ...valuePitScores.map((score) =>
          dataBridge.forward(
            EnvelopeFactory.create(
              {
                source: MODULE_ID.strategy,
                target: ENVELOPE_TARGET.db,
                action: ENVELOPE_ACTION.saveScores,
                traceId: `${baseTraceId}-value`,
              },
              score,
            ),
          ),
        ),
        ...signals.map((signal) =>
          dataBridge.forward(
            EnvelopeFactory.create(
              {
                source: MODULE_ID.strategy,
                target: ENVELOPE_TARGET.db,
                action: ENVELOPE_ACTION.saveScores,
                traceId: `${baseTraceId}-signal`,
              },
              signal,
            ),
          ),
        ),
      ])

      set({
        hotSectorScores,
        valuePitScores,
        rotationSignals,
        loading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: Date.now(),
      })

      logger.info(
        `[dualStrategyStore] fetchScores 完成: hot=${hotSectorScores.length}, value=${valuePitScores.length}, rotation=${rotationSignals.length}`
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[dualStrategyStore] fetchScores 失败: ${message}`, { error: message })
      // 失败快照回滚：保留原数据，仅设置错误状态
      set({
        ...snapshot,
        error: message,
        loading: false,
        isRefreshing: false,
      })
    }
  },

  refresh: async () => {
    const { isRefreshing } = get()
    if (isRefreshing) {
      logger.debug('[dualStrategyStore] refresh 已在进行中，跳过并发调用')
      return
    }

    const isFirstLoad = get().hotSectorScores.length === 0 && get().valuePitScores.length === 0 && get().lastUpdated === 0
    logger.info(`[dualStrategyStore] refresh 开始 (${isFirstLoad ? '首次加载' : '增量刷新'})`)
    set({ isRefreshing: true, loading: isFirstLoad, error: null })

    try {
      const [hotResult, valueResult, signalsResult] = await Promise.all([
        dataBridge.query<HotSectorScore[]>({
          action: ENVELOPE_ACTION.queryList,
          store: STORE_NAME.hotSectorScores,
          source: MODULE_ID.strategy,
        }),
        dataBridge.query<ValuePitScore[]>({
          action: ENVELOPE_ACTION.queryList,
          store: STORE_NAME.valuePitScores,
          source: MODULE_ID.strategy,
        }),
        dataBridge.query<Signal[]>({
          action: ENVELOPE_ACTION.queryList,
          store: STORE_NAME.signals,
          source: MODULE_ID.strategy,
        }),
      ])

      if (!hotResult.success || !valueResult.success || !signalsResult.success) {
        const errorMessage = [hotResult.error, valueResult.error, signalsResult.error]
          .filter(Boolean)
          .join('; ') || '刷新双策略数据失败'
        throw new Error(errorMessage)
      }

      const hotSectorScores = hotResult.data ?? []
      const valuePitScores = valueResult.data ?? []
      const allSignals = signalsResult.data ?? []

      const rotationSignals = allSignals
        .filter((s) => s.type === 'buy_rotation')
        .map((s) => signalToRotationSignal(s))

      hotSectorScores.sort((a, b) => b.score - a.score)
      valuePitScores.sort((a, b) => b.score - a.score)

      set({
        hotSectorScores,
        valuePitScores,
        rotationSignals,
        loading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: Date.now(),
      })

      logger.info(
        `[dualStrategyStore] refresh 完成: hot=${hotSectorScores.length}, value=${valuePitScores.length}, rotation=${rotationSignals.length}`
      )

      // 检查排队的刷新请求
      if (_pendingRefresh) {
        _pendingRefresh = false
        logger.info('[dualStrategyStore] 排队刷新触发')
        debouncedRefresh()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[dualStrategyStore] refresh 失败: ${message}`, { error: message })
      set({ error: message, loading: false, isRefreshing: false })

      // 失败时清除排队标记
      if (_pendingRefresh) {
        _pendingRefresh = false
      }
    }
  },

  clearScores: () => {
    logger.info('[dualStrategyStore] clearScores')
    set({ ...initialState })
    withBroadcast(EVENT_NAMES.DUAL_STRATEGY_CHANGED, { action: 'clearScores' })
  },
}))

// ============================================================
// 派生查询（Getters）
// ============================================================

/** 获取热门板块 Top N */
export function topHotSectors(limit: number = 5): HotSectorScore[] {
  const { hotSectorScores } = useDualStrategyStore.getState()
  return hotSectorScores.slice(0, limit)
}

/** 获取价值洼地 Top N */
export function topValuePits(limit: number = 5): ValuePitScore[] {
  const { valuePitScores } = useDualStrategyStore.getState()
  return valuePitScores.slice(0, limit)
}

/** 获取已触发的轮动信号列表 */
export function activeRotationSignals(): RotationSignal[] {
  const { rotationSignals } = useDualStrategyStore.getState()
  return rotationSignals.filter((s) => s.triggered)
}

/** 获取热门板块买入信号（action=immediate） */
export function hotSectorBuySignals(): HotSectorScore[] {
  const { hotSectorScores } = useDualStrategyStore.getState()
  return hotSectorScores.filter((s) => s.action === 'immediate')
}

/** 获取价值洼地建仓候选（action=immediate） */
export function valuePitBuildCandidates(): ValuePitScore[] {
  const { valuePitScores } = useDualStrategyStore.getState()
  return valuePitScores.filter((s) => s.action === 'immediate')
}

/** 获取价值洼地等待信号列表（action=wait） */
export function valuePitWaitSignals(): ValuePitScore[] {
  const { valuePitScores } = useDualStrategyStore.getState()
  return valuePitScores.filter((s) => s.action === 'wait')
}

/** 按 symbol 查询热门板块评分 */
export function hotSectorBySymbol(symbol: string): HotSectorScore | undefined {
  const { hotSectorScores } = useDualStrategyStore.getState()
  return hotSectorScores.find((s) => s.symbol === symbol)
}

/** 按 symbol 查询价值洼地评分 */
export function valuePitBySymbol(symbol: string): ValuePitScore | undefined {
  const { valuePitScores } = useDualStrategyStore.getState()
  return valuePitScores.find((s) => s.symbol === symbol)
}

/** 按 sectorId 查询轮动信号 */
export function rotationSignalBySector(sectorId: string): RotationSignal | undefined {
  const { rotationSignals } = useDualStrategyStore.getState()
  return rotationSignals.find((s) => s.sectorId === sectorId)
}

// ============================================================
// DataBridge 订阅生命周期
// ============================================================
// 订阅以下频道变更，去抖刷新：
// - hot_sector_scores
// - value_pit_scores
// - rotation_scores（板块轮动评分，外部模块写入时触发同步）
// - signals（轮动信号实际持久化位置）
// - stocks（股票池变更会驱动评分重新计算）
//
// source 过滤：跳过 analyzer / tradinghub / strategy 模块自身发出的事件，
// 避免自激循环。
// ============================================================

let _unsubscribeHot: (() => void) | null = null
let _unsubscribeValue: (() => void) | null = null
let _unsubscribeRotation: (() => void) | null = null
let _unsubscribeSignals: (() => void) | null = null
let _unsubscribeStocks: (() => void) | null = null
let _debounceTimer: ReturnType<typeof setTimeout> | null = null
let _lastRefreshTime = 0
let _globalSubscriptionsInitialized = false

/** 首次数据事件标记（跳过最小刷新间隔） */
let _isFirstDataEvent = true
/** 待刷新标记（refresh 进行中时有新事件到达则排队） */
let _pendingRefresh = false

const DEBOUNCE_MS = 300
const MIN_REFRESH_INTERVAL_MS = 2000

const SELF_SOURCES = new Set<string>([
  MODULE_ID.analyzer,
  MODULE_ID.tradinghub,
  MODULE_ID.strategy,
])

function debouncedRefresh(): void {
  const now = Date.now()
  // 首次数据事件跳过最小间隔检查
  if (!(_isFirstDataEvent && _lastRefreshTime === 0)) {
    if (now - _lastRefreshTime < MIN_REFRESH_INTERVAL_MS) {
      logger.debug(`[dualStrategyStore] 刷新间隔过短（${now - _lastRefreshTime}ms < ${MIN_REFRESH_INTERVAL_MS}ms），跳过`)
      return
    }
  } else {
    logger.info('[dualStrategyStore] 首次数据事件，跳过最小刷新间隔检查')
  }

  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
  }
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null
    _lastRefreshTime = Date.now()
    _isFirstDataEvent = false
    const state = useDualStrategyStore.getState()
    if (state.isRefreshing) {
      logger.debug('[dualStrategyStore] refresh 进行中，标记 _pendingRefresh 排队')
      _pendingRefresh = true
      return
    }
    logger.info('[dualStrategyStore] DataBridge 事件触发自动 refresh')
    void state.refresh()
  }, DEBOUNCE_MS)
}

/**
 * shouldSkipSelf
 * @param envelope
 */
export function shouldSkipSelf(envelope: { meta: { source: string; action: string } }): boolean {
  if (SELF_SOURCES.has(envelope.meta.source)) {
    return true
  }
  // 策略刷新 action 也由外部触发，但源可能是 strategy，已包含在上面的集合中
  return false
}

/**
 * 初始化 DataBridge 订阅（组件级），返回 cleanup 函数。
 *
 * 幂等设计（与 signalStore 一致）：
 * - 全局已初始化时返回 no-op cleanup（全局订阅不由组件生命周期管理）
 * - 组件级首次初始化时注册订阅，返回正确的销毁函数
 */
export function initDualStrategyStoreSubscriptions(): () => void {
  // 全局已初始化 → 复用全局订阅，返回 no-op cleanup
  if (_globalSubscriptionsInitialized) {
    logger.debug('[dualStrategyStore] 全局订阅已就绪，组件复用全局 DataBridge 通道')
    return () => {
      // 全局订阅不随组件卸载
    }
  }

  if (_unsubscribeHot || _unsubscribeValue || _unsubscribeRotation || _unsubscribeSignals || _unsubscribeStocks) {
    logger.warn('[dualStrategyStore] Subscriptions already initialized, skipping')
    return destroyDualStrategyStoreSubscriptions
  }

  setupSubscriptions()

  return () => destroyDualStrategyStoreSubscriptions()
}

/**
 * 全局初始化双策略订阅（应用启动时调用）。
 * 与组件级 initDualStrategyStoreSubscriptions 不同，全局初始化的订阅
 * 不会随组件卸载而销毁，确保双策略数据在懒加载widget挂载前就已就绪。
 */
export function initDualStrategyStoreGlobalSubscriptions(): void {
  if (_globalSubscriptionsInitialized) {
    logger.debug('[dualStrategyStore] Global subscriptions already initialized')
    return
  }

  setupSubscriptions()
  _globalSubscriptionsInitialized = true
  logger.info('[dualStrategyStore] Global subscriptions initialized')
}

/**
 * 测试用：重置所有订阅状态（仅在测试环境使用）
 */
export function _resetDualStrategyStoreSubscriptionsForTest(): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
    _debounceTimer = null
  }
  destroyDualStrategyStoreSubscriptions()
  _lastRefreshTime = 0
  _isFirstDataEvent = true
  _pendingRefresh = false
  _globalSubscriptionsInitialized = false
  useDualStrategyStore.setState(initialState)
  logger.info('[dualStrategyStore] Subscriptions reset for test')
}

function setupSubscriptions(): void {
  logger.info('[dualStrategyStore] 初始化 DataBridge 订阅')

  const handleEnvelope = (
    envelope: Parameters<Parameters<typeof dataBridge.subscribe>[1]>[0],
    label: string,
  ): void => {
    if (shouldSkipSelf(envelope)) return
    logger.info(`[dualStrategyStore] ${label} 频道收到变更`, {
      action: envelope.meta.action,
      source: envelope.meta.source,
      traceId: envelope.meta.traceId,
    })
    debouncedRefresh()
  }

  _unsubscribeHot = dataBridge.subscribe(
    STORE_NAME.hotSectorScores,
    (envelope) => {
      handleEnvelope(envelope, 'hotSectorScores')
    },
  )

  _unsubscribeValue = dataBridge.subscribe(
    STORE_NAME.valuePitScores,
    (envelope) => {
      handleEnvelope(envelope, 'valuePitScores')
    },
  )

  _unsubscribeRotation = dataBridge.subscribe(
    STORE_NAME.rotationScores,
    (envelope) => {
      handleEnvelope(envelope, 'rotationScores')
    },
  )

  _unsubscribeSignals = dataBridge.subscribe(
    STORE_NAME.signals,
    (envelope) => {
      handleEnvelope(envelope, 'signals')
    },
  )

  _unsubscribeStocks = dataBridge.subscribe(
    STORE_NAME.stocks,
    (envelope) => {
      if (envelope.meta.source === MODULE_ID.pool) return
      logger.info('[dualStrategyStore] stocks 频道收到变更', {
        action: envelope.meta.action,
        source: envelope.meta.source,
        traceId: envelope.meta.traceId,
      })
      debouncedRefresh()
    },
  )
}

function destroyDualStrategyStoreSubscriptions(): void {
  if (_globalSubscriptionsInitialized) {
    logger.debug('[dualStrategyStore] Global subscriptions, skip destroy from component')
    return
  }
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
    _debounceTimer = null
  }
  _unsubscribeHot?.()
  _unsubscribeValue?.()
  _unsubscribeRotation?.()
  _unsubscribeSignals?.()
  _unsubscribeStocks?.()
  _unsubscribeHot = null
  _unsubscribeValue = null
  _unsubscribeRotation = null
  _unsubscribeSignals = null
  _unsubscribeStocks = null
  logger.info('[dualStrategyStore] DataBridge subscriptions destroyed')
}
