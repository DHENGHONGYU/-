/**
 * @module intentionPoolStore
 * @description 意向候选池 Zustand Store。
 *
 * 物理数据仍存储于 IndexedDB `stocks` store，通过 `pool === 'intention'` 过滤。
 */

import { create } from 'zustand'
import { getLogger } from '@/lib/logger'
import {
  DATA_SOURCE,
  ENVELOPE_ACTION,
  ENVELOPE_TARGET,
  MODULE_ID,
  STORE_NAME,
} from '@/config/dbConfig'
import {
  DEFAULT_POOL_GROUP,
  DEFAULT_POOL_STATUS,
  POOL_TYPE,
  type IntentionStatus,
  type PoolType,
} from '@/constants/pool.constants'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { isValidTransition } from '@/core/poolTransitionEngine'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import type { IntentionPoolItem, PoolItem } from '@/types/modules/pool.types'
import type { Stock } from '@/data/types'

import { nanoid } from 'nanoid'

const logger = getLogger()
const POOL: PoolType = POOL_TYPE.intention

interface IntentionPoolState {
  items: PoolItem[]
  loading: boolean
  error: string | null
  isRefreshing: boolean
  lastUpdated: number

  refresh: () => Promise<void>
  addItem: (
    item: Omit<IntentionPoolItem, 'pool' | 'status' | 'dataVersion' | 'ingestedAt' | 'updatedAt'>,
  ) => Promise<boolean>
  updateItem: (symbol: string, updates: Partial<IntentionPoolItem>) => Promise<boolean>
  deleteItem: (symbol: string) => Promise<boolean>
  deleteItems: (symbols: string[]) => Promise<number>
  updateStatus: (symbol: string, newStatus: IntentionStatus) => Promise<boolean>
  updateGroup: (symbol: string, group: string) => Promise<boolean>
  getByStatus: (status: IntentionStatus) => PoolItem[]
  getByGroup: (group: string) => PoolItem[]
}

const initialState = {
  items: [] as PoolItem[],
  loading: false,
  error: null as string | null,
  isRefreshing: false,
  lastUpdated: 0,
}

function toPoolItem(stock: Stock): PoolItem {
  return {
    symbol: stock.symbol,
    name: stock.name,
    pool: stock.pool,
    status: stock.researchStatus,
    price: stock.price,
    pe: stock.pe,
    pb: stock.pb,
    roe: stock.roe,
    marketCap: stock.marketCap,
    source: stock.source,
    dataVersion: stock.dataVersion,
    dataQuality: stock.dataQuality,
    ingestedAt: stock.ingestedAt,
    updatedAt: stock.updatedAt,
    industryCode: stock.industryCode,
    theme: stock.theme,
    sector: stock.sector,
    group: stock.group,
    screenReason: stock.sector,
  } as PoolItem
}

/**
 * useIntentionPoolStore
 */
export const useIntentionPoolStore = create<IntentionPoolState>((set, get) => ({
  ...initialState,

  refresh: async () => {
    if (get().isRefreshing) return
    const isFirstLoad = get().items.length === 0 && get().lastUpdated === 0
    logger.info(`[intentionPoolStore] refresh 开始`)
    set({ isRefreshing: true, loading: isFirstLoad, error: null })

    try {
      const result = await dataBridge.query<Stock[]>({
        action: ENVELOPE_ACTION.queryByIndex,
        store: STORE_NAME.stocks,
        indexName: 'by-pool',
        indexValue: POOL,
        source: MODULE_ID.pool,
      })
      if (!result.success) {
        throw new Error(result.error ?? '查询意向池失败')
      }
      const list = (result.data ?? [])
        .filter((s) => s.pool === POOL)
        .map(toPoolItem)
      set({
        items: list,
        loading: false,
        isRefreshing: false,
        lastUpdated: Date.now(),
        error: null,
      })
      logger.info(`[intentionPoolStore] refresh 完成: ${list.length} 条`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[intentionPoolStore] refresh 失败: ${message}`)
      set({ error: message, loading: false, isRefreshing: false })
    }
  },

  addItem: async (item) => {
    const normalizedSymbol = item.symbol.trim().toUpperCase()
    logger.info(`[intentionPoolStore] addItem: ${item.name}(${normalizedSymbol})`)
    set({ error: null })

    try {
      const existingResult = await dataBridge.query<Stock>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.stocks,
        key: normalizedSymbol,
        source: MODULE_ID.pool,
      })
      if (existingResult.success && existingResult.data) {
        const message = `${item.name}(${normalizedSymbol}) 已存在`
        logger.warn(`[intentionPoolStore] addItem 失败: ${message}`)
        set({ error: message })
        return false
      }

      const fullStock: Stock = {
        ...item,
        symbol: normalizedSymbol,
        pool: POOL,
        researchStatus: DEFAULT_POOL_STATUS[POOL],
        source: item.source ?? DATA_SOURCE.manual,
        group: item.group ?? DEFAULT_POOL_GROUP,
        dataVersion: 1,
        ingestedAt: Date.now(),
        updatedAt: Date.now(),
      }

      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.pool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.insertStock,
          traceId: `pool-intention-add-${nanoid(8)}-${normalizedSymbol}`,
        },
        fullStock,
      )
      await dataBridge.forward(envelope)
      withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'add', pool: POOL, symbol: normalizedSymbol })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[intentionPoolStore] addItem 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  updateItem: async (symbol, updates) => {
    const normalized = symbol.trim().toUpperCase()
    logger.info(`[intentionPoolStore] updateItem: ${normalized}`)
    set({ error: null })

    const existing = get().items.find((s) => s.symbol === normalized)
    if (!existing) {
      const message = `标的不存在: ${normalized}`
      logger.warn(`[intentionPoolStore] updateItem 失败: ${message}`)
      set({ error: message })
      return false
    }

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.pool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateStock,
          traceId: `pool-intention-update-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized, ...updates, updatedAt: Date.now() },
      )
      await dataBridge.forward(envelope)
      withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'update', pool: POOL, symbol: normalized, updates })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[intentionPoolStore] updateItem 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  deleteItem: async (symbol) => {
    const normalized = symbol.trim().toUpperCase()
    logger.info(`[intentionPoolStore] deleteItem: ${normalized}`)
    set({ error: null })

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.pool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.deleteStock,
          traceId: `pool-intention-delete-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized },
      )
      await dataBridge.forward(envelope)
      withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'delete', pool: POOL, symbol: normalized })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[intentionPoolStore] deleteItem 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  deleteItems: async (symbols) => {
    if (!Array.isArray(symbols) || symbols.length === 0) {
      logger.warn('[intentionPoolStore] deleteItems 收到空列表，跳过')
      return 0
    }

    // 归一化 + 去重，避免重复删除同一标的
    const normalized = Array.from(
      new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
    )
    logger.info(`[intentionPoolStore] deleteItems: ${normalized.length} 条`)
    set({ error: null })

    let deleted = 0
    for (const symbol of normalized) {
      // 复用单条删除逻辑（统一走 DataBridge 信封协议 + ACL 校验 + 广播）
      const ok = await get().deleteItem(symbol)
      if (ok) deleted++
    }
    await get().refresh()
    return deleted
  },

  updateStatus: async (symbol, newStatus) => {
    const normalized = symbol.trim().toUpperCase()
    logger.info(`[intentionPoolStore] updateStatus: ${normalized} → ${newStatus}`)
    set({ error: null })

    const item = get().items.find((s) => s.symbol === normalized)
    if (!item) {
      const message = `标的不存在: ${normalized}`
      logger.warn(`[intentionPoolStore] updateStatus 失败: ${message}`)
      set({ error: message })
      return false
    }

    if (!isValidTransition(item.pool, item.status, POOL, newStatus)) {
      const message = `非法状态流转: ${item.status} → ${newStatus}`
      logger.warn(`[intentionPoolStore] updateStatus 失败: ${message}`)
      set({ error: message })
      return false
    }

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.pool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateStock,
          traceId: `pool-intention-status-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized, researchStatus: newStatus, updatedAt: Date.now() },
      )
      await dataBridge.forward(envelope)
      withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'updateStatus', pool: POOL, symbol: normalized, newStatus })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[intentionPoolStore] updateStatus 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  updateGroup: async (symbol, group) => {
    const normalized = symbol.trim().toUpperCase()
    const normalizedGroup = group.trim()
    logger.info(`[intentionPoolStore] updateGroup: ${normalized} → ${normalizedGroup}`)
    set({ error: null })

    if (!normalizedGroup) {
      const message = '分组名称不能为空'
      logger.warn(`[intentionPoolStore] updateGroup 失败: ${message}`)
      set({ error: message })
      return false
    }

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.pool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateStock,
          traceId: `pool-intention-group-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized, group: normalizedGroup, updatedAt: Date.now() },
      )
      await dataBridge.forward(envelope)
      withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'updateGroup', pool: POOL, symbol: normalized, group: normalizedGroup })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[intentionPoolStore] updateGroup 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  getByStatus: (status) => {
    return get().items.filter((s) => s.status === status)
  },

  getByGroup: (group) => {
    return get().items.filter((s) => (s.group ?? DEFAULT_POOL_GROUP) === group)
  },
}))

/**
 * getIntentionPoolTotalCount
 * @returns number
 */
export function getIntentionPoolTotalCount(): number {
  return useIntentionPoolStore.getState().items.length
}

/**
 * getIntentionPoolItemBySymbol
 * @param symbol
 * @returns PoolItem | undefined
 */
export function getIntentionPoolItemBySymbol(symbol: string): PoolItem | undefined {
  return useIntentionPoolStore.getState().items.find((s) => s.symbol === symbol)
}

/**
 * getIntentionPoolGroups
 * @returns string[]
 */
export function getIntentionPoolGroups(): string[] {
  const { items } = useIntentionPoolStore.getState()
  const groups = new Set<string>()
  for (const item of items) {
    groups.add(item.group ?? DEFAULT_POOL_GROUP)
  }
  return Array.from(groups).sort()
}

let _unsubscribe: (() => void) | null = null
let _debounceTimer: ReturnType<typeof setTimeout> | null = null
const DEBOUNCE_MS = 100

function debouncedRefresh(): void {
  if (_debounceTimer) clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null
    logger.debug('[intentionPoolStore] 去抖触发 refresh')
    void useIntentionPoolStore.getState().refresh()
  }, DEBOUNCE_MS)
}

/**
 * initIntentionPoolStoreSubscriptions
 */
export function initIntentionPoolStoreSubscriptions(): () => void {
  if (_unsubscribe) {
    logger.warn('[intentionPoolStore] Subscriptions already initialized, skipping')
    return () => destroyIntentionPoolStoreSubscriptions()
  }

  logger.info('[intentionPoolStore] 初始化 DataBridge stocks 频道订阅')

  _unsubscribe = dataBridge.subscribe(STORE_NAME.stocks, (envelope) => {
    if (envelope.meta.source === MODULE_ID.pool) return
    debouncedRefresh()
  })

  return () => destroyIntentionPoolStoreSubscriptions()
}

function destroyIntentionPoolStoreSubscriptions(): void {
  _unsubscribe?.()
  _unsubscribe = null
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
    _debounceTimer = null
  }
  logger.info('[intentionPoolStore] 订阅已销毁')
}
