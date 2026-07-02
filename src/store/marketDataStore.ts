/**
 * @module marketDataStore
 * @lifecycle @Global
 * @description 市场数据 Zustand Store。将 MarketDataProvider 管道中的数据采集/适配逻辑下沉为
 * 独立 Store，使 13 个 Widget 可以逐步从 Context 迁移到 Zustand 直接消费。
 *
 * @remarks
 * - 不删除 MarketDataProvider，保持向后兼容
 * - 新 Store 与 MarketDataProvider 并存
 * - Widget 可以按个体逐步迁移
 *
 * 快照回滚说明：
 * marketDataStore 采用 per-key 刷新机制（refreshDataSource(key)），
 * 每个 DataSourceEntry 独立管理 loading/error/data 状态。
 * 刷新失败时只更新对应 key 的 loading/error，不清除 data（即局部回滚保护）。
 * 无需全局快照回滚，因为不存在会清空所有数据源的全局 refresh 操作。
 *
 * @see docs/《V9核心数据字典与类型定义（整合版）》.md — MarketDataState / MarketDataSourceKey / DataSourceEntry / MarketDataStatus 实体定义
 * @see docs/《功能模块数据契约》.md — MarketDataStore 模块契约（总览/输入/输出/接口/订阅/迁移路线）
 * @see docs/implementation/v9-system-blueprint.md — Widget 数据流从 MarketDataProvider → Store 的迁移路径
 * @see docs/《DataBridge端点与数据映射清单》.md — MarketDataStore 订阅频道（orders → portfolioOverview 刷新）
 * @see docs/《V9现有数据资产清单》.md — marketDataStore 资产登记
 * @see docs/CHANGELOG.md — Phase 2 变更记录（version 0.9.9）
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import { taskScheduler } from '@/services/data-collector/TaskScheduler'
import { marketDataAdapter } from '@/services/data-collector/MarketDataAdapter'
import type { DataSourceConfig, RawMarketData, MarketData, ChatMessage } from '@/types/modules/widget.types'
import { MockStockAnalysisProvider } from '@/services/stock-analysis/mockStockAnalysisProvider'
import { streamingChat } from '@/services/llm/llmClient'
import type { LlmStreamCallback } from '@/services/llm/llmTypes'
import { ACTIVE_DATA_SOURCE, DATA_SOURCE_TYPE } from '@/constants/cockpit.constants'
import { dataBridge } from '@/core/databridge'
import { STORE_NAME } from '@/config/dbConfig'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/**
 * 数据源 key 类型
 * @remarks 与 WIDGET_DEFAULT_DATA_SOURCE 的键保持一致
 */
export type MarketDataSourceKey =
  | 'sectorHeatmap'
  | 'fundFlow'
  | 'marketSentiment'
  | 'marketIndices'
  | 'portfolioOverview'
  | 'watchlist'
  | 'modelCompare'
  | 'investmentProfile'
  | 'kaiScore'
  | 'stockPool'
  | 'stockChat'
  | 'hotSector'
  | 'valuePit'
  | 'aiTradeReview'
  | 'pnlAnalysis'
  | 'positionControl'
  | 'riskMonitor'
  | 'signalMonitor'

/**
 * 单个数据源的运行时状态
 */
export interface DataSourceEntry {
  /** 适配后的数据（MarketData 的部分字段，由 marketDataAdapter.adapt() 产出） */
  data: Partial<MarketData> | undefined
  /** 是否正在加载 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 最后更新时间戳（ms） */
  lastUpdated: number
}

/**
 * 全局状态枚举
 */
export type MarketDataStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * MarketDataStore 完整状态接口
 */
export interface MarketDataState {
  /** 全局运行状态 */
  status: MarketDataStatus
  /** 按数据源 key 存储的各数据源状态 */
  dataSources: Partial<Record<MarketDataSourceKey, DataSourceEntry>>
  /** 合并后的完整 MarketData（兼容 MarketDataProvider.data） */
  mergedData: MarketData
  /** 按实例 ID 的加载状态映射（兼容 MarketDataProvider.loadingMap） */
  loadingMap: Record<string, boolean>
  /** 按实例 ID 的错误映射（兼容 MarketDataProvider.errorMap） */
  errorMap: Record<string, string | null>
  /** 实例 ID → taskId 的映射 */
  taskMap: Record<string, string>
  /** 全局错误信息 */
  globalError: string | null

  // ============================================================
  // Actions
  // ============================================================

  /**
   * 采集单个数据源数据并存入 Store
   * @param key 数据源 key（如 'sectorHeatmap'）
   * @param config 数据源配置
   * @param instanceId 可选的实例 ID，用于跟踪 loadingMap/errorMap
   */
  fetchDataSource: (key: MarketDataSourceKey, config: DataSourceConfig, instanceId?: string) => Promise<void>

  /**
   * 批量采集多个数据源
   */
  fetchDataSources: (configs: Array<{ key: MarketDataSourceKey; config: DataSourceConfig; instanceId?: string }>) => Promise<void>

  /**
   * 启动定时轮询
   * @param keys 要轮询的数据源 key 列表
   * @param intervalMs 轮询间隔（ms），默认 5000
   */
  startPeriodicRefresh: (keys: MarketDataSourceKey[], intervalMs?: number) => void

  /**
   * 停止所有定时轮询
   */
  stopPeriodicRefresh: () => void

  /**
   * 手动刷新某个数据源
   */
  refreshDataSource: (key: MarketDataSourceKey) => void

  /**
   * 重置所有数据源状态
   */
  reset: () => void

  /**
   * 发送个股/市场分析聊天消息（兼容 MarketDataProvider.sendChatMessage）
   */
  sendChatMessage: (target: string, question: string) => Promise<ChatMessage>

  /**
   * 刷新某个 Widget 实例（兼容 MarketDataProvider.refreshWidget）
   */
  refreshWidget: (instanceId: string) => void

  /**
   * 获取任务统计（兼容 MarketDataProvider.getTaskStats）
   */
  getTaskStats: () => { total: number; running: number; error: number }
}

// ============================================================
// 内部映射：widgetId → MarketDataSourceKey
// ============================================================

/**
 * Widget 注册 ID 到数据源 key 的映射
 * @remarks 用于从 taskScheduler 结果中识别对应的数据源 key
 */
const WIDGET_ID_TO_DATA_SOURCE_KEY: Record<string, MarketDataSourceKey> = {
  marketIndices: 'marketIndices',
  sectorHeatmap: 'sectorHeatmap',
  fundFlow: 'fundFlow',
  marketSentiment: 'marketSentiment',
  watchlist: 'watchlist',
  portfolioOverview: 'portfolioOverview',
  aiTradeReview: 'aiTradeReview',
  investmentProfile: 'investmentProfile',
  stockPool: 'stockPool',
  kaiScore: 'kaiScore',
  modelCompare: 'modelCompare',
  stockChat: 'stockChat',
  hotSector: 'hotSector',
  valuePit: 'valuePit',
  pnlAnalysis: 'pnlAnalysis',
  positionControl: 'positionControl',
  riskMonitor: 'riskMonitor',
  signalMonitor: 'signalMonitor',
}

// ============================================================
// 定时器管理（模块级，非 Store 内部）
// ============================================================

const periodicTimers = new Map<string, ReturnType<typeof setInterval>>()

// ============================================================
// 初始状态
// ============================================================

const initialMergedData: MarketData = marketDataAdapter.merge()

const initialState: Omit<MarketDataState, keyof typeof actions> = {
  status: 'idle',
  dataSources: {},
  mergedData: initialMergedData,
  loadingMap: {},
  errorMap: {},
  taskMap: {},
  globalError: null,
}

// ============================================================
// Actions 定义
// ============================================================

const actions = {
  fetchDataSource: async (
    key: MarketDataSourceKey,
    config: DataSourceConfig,
    instanceId?: string,
  ) => {
    const state = useMarketDataStore.getState()

    // 更新 loading 状态
    useMarketDataStore.setState({
      status: 'loading',
      dataSources: {
        ...state.dataSources,
        [key]: {
          ...state.dataSources[key],
          loading: true,
          error: null,
        },
      },
      loadingMap: instanceId
        ? { ...state.loadingMap, [instanceId]: true }
        : state.loadingMap,
      errorMap: instanceId
        ? { ...state.errorMap, [instanceId]: null }
        : state.errorMap,
    })

    try {
      // 复用 taskScheduler 进行数据采集
      const taskId = taskScheduler.registerTask(key, instanceId ?? key, config)
      taskScheduler.startTask(taskId)

      // 等待首次采集结果（通过 subscribe 回调处理）
      // subscribe 是一次性的，结果会通过 handleCollectionResult 更新到 Store
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[marketDataStore] fetchDataSource failed: ${key}`, { error: message })

      useMarketDataStore.setState({
        status: 'error',
        globalError: message,
        dataSources: {
          ...state.dataSources,
          [key]: {
            ...state.dataSources[key],
            loading: false,
            error: message,
          },
        },
        loadingMap: instanceId
          ? { ...state.loadingMap, [instanceId]: false }
          : state.loadingMap,
        errorMap: instanceId
          ? { ...state.errorMap, [instanceId]: message }
          : state.errorMap,
      })
    }
  },

  fetchDataSources: async (
    configs: Array<{ key: MarketDataSourceKey; config: DataSourceConfig; instanceId?: string }>,
  ) => {
    await Promise.allSettled(
      configs.map(({ key, config, instanceId }) =>
        useMarketDataStore.getState().fetchDataSource(key, config, instanceId),
      ),
    )
  },

  startPeriodicRefresh: (keys: MarketDataSourceKey[], intervalMs: number = 5000) => {
    // 先停止已有的轮询
    useMarketDataStore.getState().stopPeriodicRefresh()

    keys.forEach((key) => {
      const timer = setInterval(() => {
        logger.debug(`[marketDataStore] periodic refresh: ${key}`)
        useMarketDataStore.getState().refreshDataSource(key)
      }, intervalMs)

      periodicTimers.set(key, timer)
      logger.info(`[marketDataStore] periodic refresh started: ${key}, interval=${intervalMs}ms`)
    })
  },

  stopPeriodicRefresh: () => {
    periodicTimers.forEach((timer, key) => {
      clearInterval(timer)
      logger.debug(`[marketDataStore] periodic refresh stopped: ${key}`)
    })
    periodicTimers.clear()
  },

  refreshDataSource: (key: MarketDataSourceKey) => {
    const entry = useMarketDataStore.getState().dataSources[key]
    if (!entry) {
      logger.warn(`[marketDataStore] refreshDataSource: 数据源 ${key} 未注册`)
      return
    }

    useMarketDataStore.setState((state) => ({
      dataSources: {
        ...state.dataSources,
        [key]: { ...state.dataSources[key]!, loading: true, error: null },
      },
    }))

    // 通过 taskScheduler 重新执行
    const taskId = useMarketDataStore.getState().taskMap[key]
    if (taskId) {
      taskScheduler.stopTask(taskId)
      taskScheduler.startTask(taskId)
    }
  },

  reset: () => {
    useMarketDataStore.getState().stopPeriodicRefresh()
    Object.values(useMarketDataStore.getState().taskMap).forEach((taskId) => {
      taskScheduler.unregisterTask(taskId)
    })
    useMarketDataStore.setState({
      ...initialState,
      status: 'idle',
    })
    logger.info('[marketDataStore] store reset')
    withBroadcast(EVENT_NAMES.MARKET_DATA_CHANGED, { action: 'reset' })
  },

  sendChatMessage: async (target: string, question: string): Promise<ChatMessage> => {
    logger.info(`[marketDataStore] sendChatMessage: target=${target}`)

    if (ACTIVE_DATA_SOURCE === DATA_SOURCE_TYPE.MOCK) {
      return MockStockAnalysisProvider.sendChatMessage(target, question)
    }

    const messages = [
      {
        role: 'system' as const,
        content: `你是一位专业的股票分析助手，正在分析标的：${target}。请提供详细、专业的分析。`,
      },
      { role: 'user' as const, content: question },
    ]

    let fullContent = ''
    const startTime = Date.now()

    const chunkCallback: LlmStreamCallback = (chunk) => {
      if (!chunk.isDone) {
        fullContent += chunk.content
        logger.debug('[marketDataStore] LLM stream chunk received', {
          length: chunk.content.length,
          total: fullContent.length,
        })
      }
    }

    try {
      await streamingChat(messages, chunkCallback)
      logger.info('[marketDataStore] LLM streaming chat completed', {
        contentLength: fullContent.length,
        duration: Date.now() - startTime,
      })
    } catch (err) {
      logger.error('[marketDataStore] LLM streaming chat failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }

    return {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      content: fullContent,
      timestamp: Date.now(),
    }
  },

  refreshWidget: (instanceId: string) => {
    const state = useMarketDataStore.getState()
    const taskId = state.taskMap[instanceId]
    if (!taskId) {
      logger.warn(`[marketDataStore] refreshWidget: 未找到实例 ${instanceId} 对应的任务`)
      return
    }

    useMarketDataStore.setState((s) => ({
      loadingMap: { ...s.loadingMap, [instanceId]: true },
      errorMap: { ...s.errorMap, [instanceId]: null },
    }))

    taskScheduler.stopTask(taskId)
    taskScheduler.startTask(taskId)

    logger.info(`[marketDataStore] 手动刷新: ${instanceId}`)
  },

  getTaskStats: () => {
    const tasks = taskScheduler.getAllTasks()
    return {
      total: tasks.length,
      running: tasks.filter((t) => t.status === 'running').length,
      error: tasks.filter((t) => t.status === 'error').length,
    }
  },
}

// ============================================================
// Store 创建
// ============================================================

export const useMarketDataStore = create<MarketDataState>()(() => ({
  ...initialState,
  ...actions,
}))

// ============================================================
// TaskScheduler 结果回调（模块级，通过 getState/setState 访问 Store）
// ============================================================

/**
 * 处理 TaskScheduler 的采集结果回调
 * @remarks 将采集到的原始数据经过 marketDataAdapter 适配后写入 Store
 */
function handleCollectionResult(
  taskId: string,
  rawData: RawMarketData | null,
  error?: Error,
): void {
  const state = useMarketDataStore.getState()

  if (error) {
    // 查找对应的 instanceId
    const instanceId = Object.entries(state.taskMap).find(([, tid]) => tid === taskId)?.[0]
    const key = Object.entries(WIDGET_ID_TO_DATA_SOURCE_KEY).find(
      ([, dsKey]) => dsKey === instanceId,
    )?.[1]

    if (key) {
      useMarketDataStore.setState((s) => ({
        dataSources: {
          ...s.dataSources,
          [key]: { ...s.dataSources[key]!, loading: false, error: error.message },
        },
      }))
    }

    if (instanceId) {
      useMarketDataStore.setState((s) => ({
        loadingMap: { ...s.loadingMap, [instanceId]: false },
        errorMap: { ...s.errorMap, [instanceId]: error.message },
      }))
    }

    logger.error(`[marketDataStore] 采集结果错误: taskId=${taskId}`, { error: error.message })
    return
  }

  if (rawData) {
    const instanceId = Object.entries(state.taskMap).find(([, tid]) => tid === taskId)?.[0]
    const key = Object.entries(WIDGET_ID_TO_DATA_SOURCE_KEY).find(
      ([, dsKey]) => dsKey === instanceId,
    )?.[1]

    // 适配原始数据
    const adapted = marketDataAdapter.adapt(rawData)

    // 合并到全局 mergedData
    const newMergedData = marketDataAdapter.merge(state.mergedData, adapted)

    if (key) {
      useMarketDataStore.setState((s) => ({
        dataSources: {
          ...s.dataSources,
          [key]: {
            data: adapted,
            loading: false,
            error: null,
            lastUpdated: Date.now(),
          },
        },
      }))
    }

    if (instanceId) {
      useMarketDataStore.setState((s) => ({
        loadingMap: { ...s.loadingMap, [instanceId]: false },
        errorMap: { ...s.errorMap, [instanceId]: null },
      }))
    }

    // 更新全局 mergedData 和状态
    const hasAnyData = Object.values(newMergedData).some(
      (v) => v !== undefined && v !== null && v !== 0 && v !== '' && !(
        Array.isArray(v) && v.length === 0
      ),
    )

    useMarketDataStore.setState((s) => ({
      mergedData: newMergedData,
      status: hasAnyData ? 'ready' : s.status,
    }))

    logger.debug(`[marketDataStore] 数据已更新: taskId=${taskId}, key=${key ?? 'unknown'}`)
  }
}

// ============================================================
// TaskScheduler 订阅管理
// ============================================================

let _unsubscribeTaskScheduler: (() => void) | null = null

/**
 * 初始化 TaskScheduler 订阅
 * @remarks 应在应用启动时调用一次，返回 cleanup 函数
 */
export function initMarketDataStoreTaskSubscription(): () => void {
  if (_unsubscribeTaskScheduler) {
    logger.warn('[marketDataStore] TaskScheduler subscription already initialized')
    return () => destroyMarketDataStoreTaskSubscription()
  }

  _unsubscribeTaskScheduler = taskScheduler.subscribe(handleCollectionResult)
  logger.info('[marketDataStore] TaskScheduler subscription initialized')

  return () => destroyMarketDataStoreTaskSubscription()
}

function destroyMarketDataStoreTaskSubscription(): void {
  _unsubscribeTaskScheduler?.()
  _unsubscribeTaskScheduler = null
  logger.info('[marketDataStore] TaskScheduler subscription destroyed')
}

// ============================================================
// DataBridge 订阅生命周期
// ============================================================

let _unsubscribeDataBridge: (() => void) | null = null

/**
 * 初始化 DataBridge 频道订阅
 * @remarks 当其他模块更新了会影响市场数据的内容（如交易订单、持仓变更）时，
 * 自动触发对应数据源刷新
 */
export function initMarketDataStoreSubscriptions(): () => void {
  if (_unsubscribeDataBridge) {
    logger.warn('[marketDataStore] DataBridge subscriptions already initialized, skipping')
    return () => destroyMarketDataStoreSubscriptions()
  }

  // 订单频道：交易操作可能影响持仓概览、盈亏分析等
  _unsubscribeDataBridge = dataBridge.subscribe(
    STORE_NAME.orders,
    (envelope) => {
      logger.info('[marketDataStore] DataBridge event on orders channel', {
        action: envelope.meta.action,
        traceId: envelope.meta.traceId,
      })

      // 订单变更触发持仓概览刷新
      const state = useMarketDataStore.getState()
      if (state.dataSources.portfolioOverview && !state.dataSources.portfolioOverview.loading) {
        logger.info('[marketDataStore] DataBridge event triggering portfolioOverview refresh')
        state.refreshDataSource('portfolioOverview')
      }
    },
  )

  logger.info('[marketDataStore] DataBridge subscriptions initialized')

  return () => destroyMarketDataStoreSubscriptions()
}

function destroyMarketDataStoreSubscriptions(): void {
  _unsubscribeDataBridge?.()
  _unsubscribeDataBridge = null
  logger.info('[marketDataStore] DataBridge subscriptions destroyed')
}

// ============================================================
// 便捷 Selector Hooks
// ============================================================

/**
 * 获取单个数据源的完整状态
 * @param key 数据源 key
 */
export function useDataSource(key: MarketDataSourceKey): DataSourceEntry {
  return useMarketDataStore((state) => state.dataSources[key]) ?? {
    data: undefined,
    loading: false,
    error: null,
    lastUpdated: 0,
  }
}

/**
 * 获取单个数据源的数据（跳过 loading/error）
 * @param key 数据源 key
 * @template T 预期的数据类型，默认为 Partial&lt;MarketData&gt;
 */
export function useDataSourceData<T = Partial<MarketData>>(key: MarketDataSourceKey): T | undefined {
  return useMarketDataStore((state) => state.dataSources[key]?.data as T | undefined)
}
