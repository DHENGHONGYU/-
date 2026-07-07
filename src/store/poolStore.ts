/**
 * @module poolStore
 * @lifecycle @Global
 * @description 股票池数据的唯一可信源（Single Source of Truth）。
 * 统一管理全部股票池标的数据，提供增删改查、状态流转、分组管理等操作，
 * 并通过 DataBridge 订阅 stocks 频道实现跨模块数据同步。
 *
 * 背景：
 * - 此前 hotSectorStore、valuePitStore、signalStore、strategySnapshotStore、
 *   stockAnalysisStore 等都直接调用 dataLayer.stocks.list()，
 *   导致数据不一致、重复读取、状态分散。
 * - 本 Store 作为股票池数据的唯一可信源，所有模块应通过 usePoolStore 获取股票数据。
 *
 * @compliance
 * - 所有股票池数据读取统一走 usePoolStore，禁止直接调用 dataLayer.stocks.list()
 * - 状态流转校验由 poolTransitionEngine 执行
 * - 写操作经 dataLayer → DataBridge 链路，确保事件广播
 * - 订阅采用 100ms 去抖合并，避免短时间内多次变更导致的重复刷新
 * - 遵循现有 Zustand Store 风格与命名规范
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import type { ResearchStatus } from '@/config/dbConfig'
import {
  DATA_SOURCE,
  DEFAULT_POOL_GROUP,
  ENVELOPE_ACTION,
  ENVELOPE_TARGET,
  MODULE_ID,
  RESEARCH_STATUS,
  STORE_NAME,
} from '@/config/dbConfig'
import type { Stock } from '@/data/types'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { isValidTransition } from '@/core/poolTransitionEngine'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'

import { nanoid } from 'nanoid'
const logger = getLogger()

// ============================================================
// Store 接口
// ============================================================

interface PoolState {
  /** 股票池全部标的 */
  stocks: Stock[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 是否正在刷新（用于区分初始加载和后续刷新） */
  isRefreshing: boolean
  /** 最后更新时间戳 */
  lastUpdated: number

  // ===== Actions =====
  /**
   * 从 dataLayer 重新加载全部股票数据。
   * - 防并发：刷新中再次调用直接返回
   * - 失败保留旧数据：刷新失败时 stocks 不变，仅设置 error
   */
  refresh: () => Promise<void>
  /** 添加一只股票到股票池 */
  addStock: (stock: Omit<Stock, 'createdAt' | 'updatedAt' | 'dataVersion'>) => Promise<boolean>
  /** 更新指定股票的字段 */
  updateStock: (symbol: string, updates: Partial<Stock>) => Promise<boolean>
  /** 从股票池删除指定股票 */
  deleteStock: (symbol: string) => Promise<boolean>
  /**
   * 更新研究状态（调用 poolTransitionEngine 校验流转合法性）。
   * 流转非法时返回 false 并设置 error。
   */
  updateStatus: (symbol: string, newStatus: ResearchStatus) => Promise<boolean>
  /** 更新股票所属分组 */
  updateGroup: (symbol: string, group: string) => Promise<boolean>
  /** 按研究状态筛选股票 */
  getByStatus: (status: ResearchStatus) => Stock[]
  /** 按分组名称筛选股票 */
  getByGroup: (group: string) => Stock[]
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  stocks: [] as Stock[],
  loading: false,
  error: null as string | null,
  isRefreshing: false,
  lastUpdated: 0,
}

// ============================================================
// Store
// ============================================================

export const usePoolStore = create<PoolState>((set, get) => ({
  ...initialState,

  // ----------------------------------------------------------
  // refresh：从 dataLayer 加载全部股票
  // ----------------------------------------------------------
  refresh: async () => {
    const { isRefreshing } = get()
    if (isRefreshing) {
      logger.debug('[poolStore] refresh 已在进行中，跳过并发调用')
      return
    }

    const isFirstLoad = get().stocks.length === 0 && get().lastUpdated === 0
    logger.info(`[poolStore] refresh 开始 (${isFirstLoad ? '首次加载' : '增量刷新'})`)
    set({ isRefreshing: true, loading: isFirstLoad, error: null })

    try {
      logger.info('[poolStore] refresh 开始 DataBridge.query', { source: MODULE_ID.stockpool, store: STORE_NAME.stocks, action: ENVELOPE_ACTION.queryList })
      const result = await dataBridge.query<Stock[]>({
        action: ENVELOPE_ACTION.queryList,
        store: STORE_NAME.stocks,
        source: MODULE_ID.stockpool,
      })
      logger.info('[poolStore] refresh DataBridge.query 返回', { success: result.success, count: Array.isArray(result.data) ? result.data.length : 0, error: result.error })

      if (!result.success) {
        const errorMessage = result.error ?? '查询股票池失败'
        logger.error(`[poolStore] refresh 查询失败: ${errorMessage}`)
        throw new Error(errorMessage)
      }

      const list = result.data ?? []
      set({
        stocks: list,
        loading: false,
        isRefreshing: false,
        lastUpdated: Date.now(),
        error: null,
      })
      logger.info(`[poolStore] refresh 完成: ${list.length} 只股票`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[poolStore] refresh 失败: ${message}`)
      // 失败保留旧数据，仅设置错误状态
      set({
        error: message,
        loading: false,
        isRefreshing: false,
      })
    }
  },

  // ----------------------------------------------------------
  // addStock：添加股票
  // ----------------------------------------------------------
  addStock: async (stock) => {
    const normalizedSymbol = stock.symbol.trim().toUpperCase()
    logger.info(`[poolStore] addStock: ${stock.name}(${normalizedSymbol})`)
    set({ error: null })

    try {
      // 1. 检查是否已存在（保持与原 dataLayer.stocks.add 语义一致）
      logger.debug('[poolStore] addStock 查询是否已存在', { symbol: normalizedSymbol })
      const existingResult = await dataBridge.query<Stock>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        key: normalizedSymbol,
        source: MODULE_ID.stockpool,
      })
      logger.debug('[poolStore] addStock 存在性查询结果', { symbol: normalizedSymbol, exists: existingResult.success && !!existingResult.data })

      if (existingResult.success && existingResult.data) {
        const message = `${stock.name}(${normalizedSymbol}) 已存在`
        logger.warn(`[poolStore] addStock 失败: ${message}`)
        set({ error: message })
        return false
      }

      // 2. 构造完整 Stock 并发送 insertStock envelope
      const fullStock: Stock = {
        ...stock,
        symbol: normalizedSymbol,
        researchStatus: stock.researchStatus ?? RESEARCH_STATUS.candidate,
        source: stock.source ?? DATA_SOURCE.manual,
        group: stock.group ?? DEFAULT_POOL_GROUP,
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      }

      logger.info('[poolStore] addStock 发送 insertStock envelope', { symbol: normalizedSymbol, researchStatus: fullStock.researchStatus })
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.stockpool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.insertStock,
          traceId: `pool-add-${nanoid(8)}-${normalizedSymbol}`,
        },
        fullStock,
      )

      await dataBridge.forward(envelope)

      // 写操作已通过 DataBridge 广播，订阅会触发 refresh，此处无需手动更新
      logger.info(`[poolStore] addStock 成功: ${normalizedSymbol}`)
      // D-3: 广播股票池变更事件
      withBroadcast(EVENT_NAMES.STOCK_POOL_CHANGED, { action: 'add', symbol: normalizedSymbol })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[poolStore] addStock 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  // ----------------------------------------------------------
  // updateStock：更新股票字段（通用更新）
  // ----------------------------------------------------------
  updateStock: async (symbol, updates) => {
    const normalized = symbol.trim().toUpperCase()
    const fieldNames = Object.keys(updates)
    logger.info(`[poolStore] updateStock: ${normalized}`, { fields: fieldNames })
    set({ error: null })

    const existing = get().stocks.find((s) => s.symbol === normalized)
    if (!existing) {
      const message = `股票不存在: ${normalized}`
      logger.warn(`[poolStore] updateStock 失败: ${message}`)
      set({ error: message })
      return false
    }

    // 通过 DataBridge 发送 UPDATE_STOCK 信封，确保事件广播与 ACL 校验
    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.stockpool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateStock,
          traceId: `pool-update-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized, ...updates },
      )
      await dataBridge.forward(envelope)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[poolStore] updateStock 失败: ${message}`)
      set({ error: message })
      return false
    }

    // 写操作已通过 DataBridge 广播，订阅会触发 refresh
    logger.info(`[poolStore] updateStock 成功: ${normalized}`)
    // D-3: 广播股票池变更事件
    withBroadcast(EVENT_NAMES.STOCK_POOL_CHANGED, { action: 'update', symbol: normalized, updates })
    return true
  },

  // ----------------------------------------------------------
  // deleteStock：删除股票
  // ----------------------------------------------------------
  deleteStock: async (symbol) => {
    const normalized = symbol.trim().toUpperCase()
    logger.info(`[poolStore] deleteStock: ${normalized}`)
    set({ error: null })

    try {
      logger.info('[poolStore] deleteStock 发送 deleteStock envelope', { symbol: normalized })
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.stockpool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.deleteStock,
          traceId: `pool-delete-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized },
      )

      await dataBridge.forward(envelope)

      logger.info(`[poolStore] deleteStock 成功: ${normalized}`)
      // D-3: 广播股票池变更事件
      withBroadcast(EVENT_NAMES.STOCK_POOL_CHANGED, { action: 'delete', symbol: normalized })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[poolStore] deleteStock 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  // ----------------------------------------------------------
  // updateStatus：更新研究状态（含流转校验）
  // ----------------------------------------------------------
  updateStatus: async (symbol, newStatus) => {
    const normalized = symbol.trim().toUpperCase()
    logger.info(`[poolStore] updateStatus: ${normalized} → ${newStatus}`)
    set({ error: null })

    // 从当前 store 状态获取股票，避免额外 DB 读取
    const stock = get().stocks.find((s) => s.symbol === normalized)
    if (!stock) {
      const message = `股票不存在: ${normalized}`
      logger.warn(`[poolStore] updateStatus 失败: ${message}`)
      set({ error: message })
      return false
    }

    // 调用 poolTransitionEngine 校验流转合法性
    if (!isValidTransition(stock.researchStatus, newStatus)) {
      const message = `非法状态流转: ${stock.researchStatus} → ${newStatus}`
      logger.warn(`[poolStore] updateStatus 失败: ${message}`)
      set({ error: message })
      return false
    }

    try {
      logger.info('[poolStore] updateStatus 发送 updateStock envelope', { symbol: normalized, newStatus })
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.stockpool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateStock,
          traceId: `pool-status-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized, researchStatus: newStatus, updatedAt: Date.now() },
      )

      await dataBridge.forward(envelope)

      logger.info(`[poolStore] updateStatus 成功: ${normalized} → ${newStatus}`)
      // D-3: 广播股票池变更事件
      withBroadcast(EVENT_NAMES.STOCK_POOL_CHANGED, { action: 'updateStatus', symbol: normalized, newStatus })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[poolStore] updateStatus 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  // ----------------------------------------------------------
  // updateGroup：更新分组
  // ----------------------------------------------------------
  updateGroup: async (symbol, group) => {
    const normalized = symbol.trim().toUpperCase()
    const normalizedGroup = group.trim()
    logger.info(`[poolStore] updateGroup: ${normalized} → ${normalizedGroup}`)
    set({ error: null })

    if (!normalizedGroup) {
      const message = '分组名称不能为空'
      logger.warn(`[poolStore] updateGroup 失败: ${message}`)
      set({ error: message })
      return false
    }

    try {
      logger.info('[poolStore] updateGroup 发送 updateStock envelope', { symbol: normalized, group: normalizedGroup })
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.stockpool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateStock,
          traceId: `pool-group-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized, group: normalizedGroup, updatedAt: Date.now() },
      )

      await dataBridge.forward(envelope)

      logger.info(`[poolStore] updateGroup 成功: ${normalized} → ${normalizedGroup}`)
      // D-3: 广播股票池变更事件
      withBroadcast(EVENT_NAMES.STOCK_POOL_CHANGED, { action: 'updateGroup', symbol: normalized, group: normalizedGroup })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[poolStore] updateGroup 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  // ----------------------------------------------------------
  // getByStatus：按状态筛选
  // ----------------------------------------------------------
  getByStatus: (status) => {
    const { stocks } = get()
    return stocks.filter((s) => s.researchStatus === status)
  },

  // ----------------------------------------------------------
  // getByGroup：按分组筛选
  // ----------------------------------------------------------
  getByGroup: (group) => {
    const { stocks } = get()
    return stocks.filter((s) => (s.group ?? DEFAULT_POOL_GROUP) === group)
  },
}))

// ============================================================
// 派生查询（Getters）
// ============================================================

/** 获取全部股票数量 */
export function getTotalCount(): number {
  return usePoolStore.getState().stocks.length
}

/** 按 symbol 查找单只股票 */
export function getStockBySymbol(symbol: string): Stock | undefined {
  return usePoolStore.getState().stocks.find((s) => s.symbol === symbol)
}

/** 获取所有分组名称（去重排序） */
export function getAllGroups(): string[] {
  const { stocks } = usePoolStore.getState()
  const groups = new Set<string>()
  for (const stock of stocks) {
    groups.add(stock.group ?? DEFAULT_POOL_GROUP)
  }
  return Array.from(groups).sort()
}

// ============================================================
// DataBridge 订阅生命周期
// ============================================================
// 订阅 STORE_NAME.stocks 频道，监听其他模块对股票数据的变更。
// - source 过滤：跳过 stockpool 模块自身发出的事件（避免自触发循环）
// - 去抖合并：100ms 内的多次变更合并为一次 refresh
// - 由应用入口调用 initPoolStoreSubscriptions() 初始化
// ============================================================

let _unsubscribeStocks: (() => void) | null = null
let _debounceTimer: ReturnType<typeof setTimeout> | null = null
const DEBOUNCE_MS = 100

/**
 * 去抖触发 refresh。
 * 100ms 内多次调用仅执行最后一次，避免频繁刷新。
 */
function debouncedRefresh(): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
  }
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null
    logger.debug('[poolStore] 去抖触发 refresh')
    void usePoolStore.getState().refresh()
  }, DEBOUNCE_MS)
}

/** 初始化 DataBridge stocks 频道订阅，返回 cleanup 函数 */
export function initPoolStoreSubscriptions(): () => void {
  if (_unsubscribeStocks) {
    logger.warn('[poolStore] Subscriptions already initialized, skipping')
    return () => destroyPoolStoreSubscriptions()
  }

  logger.info('[poolStore] 初始化 DataBridge stocks 频道订阅')

  _unsubscribeStocks = dataBridge.subscribe(
    STORE_NAME.stocks,
    (envelope) => {
      // source 过滤：跳过 stockpool 模块自身发出的事件，避免自触发循环
      if (envelope.meta.source === MODULE_ID.stockpool) {
        logger.debug('[poolStore] 跳过 stockpool 模块自身发出的事件', {
          action: envelope.meta.action,
          traceId: envelope.meta.traceId,
        })
        return
      }

      logger.info('[poolStore] DataBridge stocks 频道收到变更事件', {
        action: envelope.meta.action,
        source: envelope.meta.source,
        traceId: envelope.meta.traceId,
      })

      // 去抖合并：100ms 内的多次变更合并为一次刷新
      debouncedRefresh()
    },
  )

  return () => destroyPoolStoreSubscriptions()
}

function destroyPoolStoreSubscriptions(): void {
  _unsubscribeStocks?.()
  _unsubscribeStocks = null

  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
    _debounceTimer = null
  }

  logger.info('[poolStore] DataBridge subscriptions destroyed')
}
