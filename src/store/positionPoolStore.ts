/** @unused — 已实现但当前无 UI 层消费者，待后续产品规划接入。  * @doc [V9-DOC-PROJ-108, V9-DOC-BACK-011, V9-DOC-DATA-024, V9-DOC-DATA-032, V9-DOC-DATA-031]
*/
/**
 * @module positionPoolStore
 * @description 持仓池 Zustand Store。
 *
 * 物理数据仍存储于 IndexedDB `stocks` store，通过 `pool === 'position'` 过滤。
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
  type PoolType,
  type PositionStatus,
} from '@/constants/pool.constants'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { isValidTransition } from '@/core/poolTransitionEngine'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/lib/withBroadcast'
import type { PoolItem, PositionPoolItem } from '@/types/modules/pool.types'
import type { Stock } from '@/data/types'
import { DEBOUNCE_MS } from '@/constants/timing.constants'

import { nanoid } from 'nanoid'

const logger = getLogger()
const POOL: PoolType = POOL_TYPE.position

interface PositionPoolState {
  items: PoolItem[]
  loading: boolean
  error: string | null
  isRefreshing: boolean
  lastUpdated: number

  refresh: () => Promise<void>
  addItem: (
    item: Omit<PositionPoolItem, 'pool' | 'status' | 'dataVersion' | 'ingestedAt' | 'updatedAt'>,
  ) => Promise<boolean>
  updateItem: (symbol: string, updates: Partial<PositionPoolItem>) => Promise<boolean>
  deleteItem: (symbol: string) => Promise<boolean>
  updateStatus: (symbol: string, newStatus: PositionStatus) => Promise<boolean>
  updateGroup: (symbol: string, group: string) => Promise<boolean>
  getByStatus: (status: PositionStatus) => PoolItem[]
  getByGroup: (group: string) => PoolItem[]
}

const initialState = {
  items: [] as PoolItem[],
  loading: false,
  error: null as string | null,
  isRefreshing: false,
  lastUpdated: 0,
}

export function toPoolItem(stock: Stock): PoolItem {
  const missingFields: string[] = []
  const zeroFields: string[] = []

  if (stock.quantity == null) {
    missingFields.push('quantity')
  } else if (stock.quantity === 0) {
    zeroFields.push('quantity')
  }
  if (stock.avgCost == null) {
    missingFields.push('avgCost')
  } else if (stock.avgCost === 0) {
    zeroFields.push('avgCost')
  }

  const hasPrice = stock.currentPrice != null || stock.price != null
  if (!hasPrice) {
    missingFields.push('currentPrice(含price)')
  } else if (stock.currentPrice === 0 || stock.price === 0) {
    zeroFields.push('currentPrice(含price)')
  }

  if (missingFields.length > 0) {
    logger.debug(`[positionPoolStore] toPoolItem: ${stock.symbol}(${stock.name}) 缺失字段 → [${missingFields.join(', ')}] 用 NaN 替代 0 作为显式空值标记`)
  }
  if (zeroFields.length > 0) {
    logger.debug(`[positionPoolStore] toPoolItem: ${stock.symbol}(${stock.name}) 显式零值字段 → [${zeroFields.join(', ')}] 原始数据源返回 0，请确认是否为业务有效值`)
  }

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
    quantity: stock.quantity ?? Number.NaN,
    avgCost: stock.avgCost ?? Number.NaN,
    currentPrice: stock.currentPrice ?? stock.price ?? Number.NaN,
  } as PoolItem
}

/**
 * usePositionPoolStore
 */
export const usePositionPoolStore = create<PositionPoolState>((set, get) => ({
  ...initialState,

  refresh: async () => {
    if (get().isRefreshing) return
    const isFirstLoad = get().items.length === 0 && get().lastUpdated === 0
    logger.info(`[positionPoolStore] refresh 开始`)
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
        throw new Error(result.error ?? '查询持仓池失败')
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
      logger.info(`[positionPoolStore] refresh 完成: ${list.length} 条`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[positionPoolStore] refresh 失败: ${message}`)
      set({ error: message, loading: false, isRefreshing: false })
    }
  },

  addItem: async (item) => {
    const normalizedSymbol = item.symbol.trim().toUpperCase()
    logger.info(`[positionPoolStore] addItem: ${item.name}(${normalizedSymbol})`)
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
        logger.warn(`[positionPoolStore] addItem 失败: ${message}`)
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
          traceId: `pool-position-add-${nanoid(8)}-${normalizedSymbol}`,
        },
        fullStock,
      )
      await dataBridge.forward(envelope)
      withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'add', pool: POOL, symbol: normalizedSymbol })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[positionPoolStore] addItem 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  updateItem: async (symbol, updates) => {
    const normalized = symbol.trim().toUpperCase()
    logger.info(`[positionPoolStore] updateItem: ${normalized}`)
    set({ error: null })

    const existing = get().items.find((s) => s.symbol === normalized)
    if (!existing) {
      const message = `标的不存在: ${normalized}`
      logger.warn(`[positionPoolStore] updateItem 失败: ${message}`)
      set({ error: message })
      return false
    }

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.pool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateStock,
          traceId: `pool-position-update-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized, ...updates, updatedAt: Date.now() },
      )
      await dataBridge.forward(envelope)
      withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'update', pool: POOL, symbol: normalized, updates })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[positionPoolStore] updateItem 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  deleteItem: async (symbol) => {
    const normalized = symbol.trim().toUpperCase()
    logger.info(`[positionPoolStore] deleteItem: ${normalized}`)
    set({ error: null })

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.pool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.deleteStock,
          traceId: `pool-position-delete-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized },
      )
      await dataBridge.forward(envelope)
      withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'delete', pool: POOL, symbol: normalized })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[positionPoolStore] deleteItem 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  updateStatus: async (symbol, newStatus) => {
    const normalized = symbol.trim().toUpperCase()
    logger.info(`[positionPoolStore] updateStatus: ${normalized} → ${newStatus}`)
    set({ error: null })

    const item = get().items.find((s) => s.symbol === normalized)
    if (!item) {
      const message = `标的不存在: ${normalized}`
      logger.warn(`[positionPoolStore] updateStatus 失败: ${message}`)
      set({ error: message })
      return false
    }

    if (!isValidTransition(item.pool, item.status, POOL, newStatus)) {
      const message = `非法状态流转: ${item.status} → ${newStatus}`
      logger.warn(`[positionPoolStore] updateStatus 失败: ${message}`)
      set({ error: message })
      return false
    }

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.pool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateStock,
          traceId: `pool-position-status-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized, researchStatus: newStatus, updatedAt: Date.now() },
      )
      await dataBridge.forward(envelope)
      withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'updateStatus', pool: POOL, symbol: normalized, newStatus })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[positionPoolStore] updateStatus 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  updateGroup: async (symbol, group) => {
    const normalized = symbol.trim().toUpperCase()
    const normalizedGroup = group.trim()
    logger.info(`[positionPoolStore] updateGroup: ${normalized} → ${normalizedGroup}`)
    set({ error: null })

    if (!normalizedGroup) {
      const message = '分组名称不能为空'
      logger.warn(`[positionPoolStore] updateGroup 失败: ${message}`)
      set({ error: message })
      return false
    }

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.pool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateStock,
          traceId: `pool-position-group-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized, group: normalizedGroup, updatedAt: Date.now() },
      )
      await dataBridge.forward(envelope)
      withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'updateGroup', pool: POOL, symbol: normalized, group: normalizedGroup })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[positionPoolStore] updateGroup 失败: ${message}`)
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
 * getPositionPoolTotalCount
 * @returns number
 */
export function getPositionPoolTotalCount(): number {
  return usePositionPoolStore.getState().items.length
}

/**
 * getPositionPoolItemBySymbol
 * @param symbol
 * @returns PoolItem | undefined
 */
export function getPositionPoolItemBySymbol(symbol: string): PoolItem | undefined {
  return usePositionPoolStore.getState().items.find((s) => s.symbol === symbol)
}

/**
 * getPositionPoolGroups
 * @returns string[]
 */
export function getPositionPoolGroups(): string[] {
  const { items } = usePositionPoolStore.getState()
  const groups = new Set<string>()
  for (const item of items) {
    groups.add(item.group ?? DEFAULT_POOL_GROUP)
  }
  return Array.from(groups).sort()
}

let _unsubscribe: (() => void) | null = null
let _debounceTimer: ReturnType<typeof setTimeout> | null = null

function debouncedRefresh(): void {
  if (_debounceTimer) clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null
    logger.debug('[positionPoolStore] 去抖触发 refresh')
    void usePositionPoolStore.getState().refresh()
  }, DEBOUNCE_MS)
}

/**
 * initPositionPoolStoreSubscriptions
 */
export function initPositionPoolStoreSubscriptions(): () => void {
  if (_unsubscribe) {
    logger.warn('[positionPoolStore] Subscriptions already initialized, skipping')
    return () => destroyPositionPoolStoreSubscriptions()
  }

  logger.info('[positionPoolStore] 初始化 DataBridge stocks 频道订阅')

  _unsubscribe = dataBridge.subscribe(STORE_NAME.stocks, (envelope) => {
    if (envelope.meta.source === MODULE_ID.pool) return
    debouncedRefresh()
  })

  return () => destroyPositionPoolStoreSubscriptions()
}

function destroyPositionPoolStoreSubscriptions(): void {
  _unsubscribe?.()
  _unsubscribe = null
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
    _debounceTimer = null
  }
  logger.info('[positionPoolStore] 订阅已销毁')
}
