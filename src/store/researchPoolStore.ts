/**
 * @module researchPoolStore
 * @description 研究精选池 Zustand Store。
 *
 * 物理数据仍存储于 IndexedDB `stocks` store，通过 `pool === 'research'` 过滤。
  * @doc [V9-DOC-PROJ-108, V9-DOC-BACK-011, V9-DOC-DATA-024, V9-DOC-DATA-032, V9-DOC-DATA-031]
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
  POOL_TYPE,
  RESEARCH_STATUS,
  type PoolType,
  type ResearchStatus,
} from '@/constants/pool.constants'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { isValidTransition } from '@/core/poolTransitionEngine'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/store/helpers/withBroadcast'
import type { PoolItem, ResearchPoolItem } from '@/types/modules/pool.types'
import type { Stock } from '@/data/types'

import { nanoid } from 'nanoid'

const logger = getLogger()
const POOL: PoolType = POOL_TYPE.research

interface ResearchPoolState {
  items: PoolItem[]
  loading: boolean
  error: string | null
  isRefreshing: boolean
  lastUpdated: number

  refresh: () => Promise<void>
  addItem: (
    item: Omit<ResearchPoolItem, 'pool' | 'status' | 'dataVersion' | 'ingestedAt' | 'updatedAt'>,
  ) => Promise<boolean>
  updateItem: (symbol: string, updates: Partial<ResearchPoolItem>) => Promise<boolean>
  deleteItem: (symbol: string) => Promise<boolean>
  updateStatus: (symbol: string, newStatus: ResearchStatus) => Promise<boolean>
  updateGroup: (symbol: string, group: string) => Promise<boolean>
  getByStatus: (status: ResearchStatus) => PoolItem[]
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
    researchNote: stock.sector,
  } as PoolItem
}

/**
 * useResearchPoolStore
 */
export const useResearchPoolStore = create<ResearchPoolState>((set, get) => ({
  ...initialState,

  refresh: async () => {
    if (get().isRefreshing) return
    const isFirstLoad = get().items.length === 0 && get().lastUpdated === 0
    logger.info(`[researchPoolStore] refresh 开始`)
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
        throw new Error(result.error ?? '查询研究池失败')
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
      logger.info(`[researchPoolStore] refresh 完成: ${list.length} 条`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[researchPoolStore] refresh 失败: ${message}`)
      set({ error: message, loading: false, isRefreshing: false })
    }
  },

  addItem: async (item) => {
    const normalizedSymbol = item.symbol.trim().toUpperCase()
    logger.info(`[researchPoolStore] addItem: ${item.name}(${normalizedSymbol})`)
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
        logger.warn(`[researchPoolStore] addItem 失败: ${message}`)
        set({ error: message })
        return false
      }

      const fullStock: Stock = {
        ...item,
        symbol: normalizedSymbol,
        pool: POOL,
        researchStatus: RESEARCH_STATUS.candidate,
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
          traceId: `pool-research-add-${nanoid(8)}-${normalizedSymbol}`,
        },
        fullStock,
      )
      await dataBridge.forward(envelope)
      withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'add', pool: POOL, symbol: normalizedSymbol })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[researchPoolStore] addItem 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  updateItem: async (symbol, updates) => {
    const normalized = symbol.trim().toUpperCase()
    logger.info(`[researchPoolStore] updateItem: ${normalized}`)
    set({ error: null })

    const existing = get().items.find((s) => s.symbol === normalized)
    if (!existing) {
      const message = `标的不存在: ${normalized}`
      logger.warn(`[researchPoolStore] updateItem 失败: ${message}`)
      set({ error: message })
      return false
    }

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.pool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateStock,
          traceId: `pool-research-update-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized, ...updates, updatedAt: Date.now() },
      )
      await dataBridge.forward(envelope)
      withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'update', pool: POOL, symbol: normalized, updates })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[researchPoolStore] updateItem 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  deleteItem: async (symbol) => {
    const normalized = symbol.trim().toUpperCase()
    logger.info(`[researchPoolStore] deleteItem: ${normalized}`)
    set({ error: null })

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.pool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.deleteStock,
          traceId: `pool-research-delete-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized },
      )
      await dataBridge.forward(envelope)
      withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'delete', pool: POOL, symbol: normalized })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[researchPoolStore] deleteItem 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  updateStatus: async (symbol, newStatus) => {
    const normalized = symbol.trim().toUpperCase()
    logger.info(`[researchPoolStore] updateStatus: ${normalized} → ${newStatus}`)
    set({ error: null })

    const item = get().items.find((s) => s.symbol === normalized)
    if (!item) {
      const message = `标的不存在: ${normalized}`
      logger.warn(`[researchPoolStore] updateStatus 失败: ${message}`)
      set({ error: message })
      return false
    }

    if (!isValidTransition(item.pool, item.status, POOL, newStatus)) {
      const message = `非法状态流转: ${item.status} → ${newStatus}`
      logger.warn(`[researchPoolStore] updateStatus 失败: ${message}`)
      set({ error: message })
      return false
    }

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.pool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateStock,
          traceId: `pool-research-status-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized, researchStatus: newStatus, updatedAt: Date.now() },
      )
      await dataBridge.forward(envelope)
      withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'updateStatus', pool: POOL, symbol: normalized, newStatus })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[researchPoolStore] updateStatus 失败: ${message}`)
      set({ error: message })
      return false
    }
  },

  updateGroup: async (symbol, group) => {
    const normalized = symbol.trim().toUpperCase()
    const normalizedGroup = group.trim()
    logger.info(`[researchPoolStore] updateGroup: ${normalized} → ${normalizedGroup}`)
    set({ error: null })

    if (!normalizedGroup) {
      const message = '分组名称不能为空'
      logger.warn(`[researchPoolStore] updateGroup 失败: ${message}`)
      set({ error: message })
      return false
    }

    try {
      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.pool,
          target: ENVELOPE_TARGET.db,
          action: ENVELOPE_ACTION.updateStock,
          traceId: `pool-research-group-${nanoid(8)}-${normalized}`,
        },
        { symbol: normalized, group: normalizedGroup, updatedAt: Date.now() },
      )
      await dataBridge.forward(envelope)
      withBroadcast(EVENT_NAMES.POOL_CHANGED, { action: 'updateGroup', pool: POOL, symbol: normalized, group: normalizedGroup })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`[researchPoolStore] updateGroup 失败: ${message}`)
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
 * getResearchPoolTotalCount
 * @returns number
 */
export function getResearchPoolTotalCount(): number {
  return useResearchPoolStore.getState().items.length
}

/**
 * getResearchPoolItemBySymbol
 * @param symbol
 * @returns PoolItem | undefined
 */
export function getResearchPoolItemBySymbol(symbol: string): PoolItem | undefined {
  return useResearchPoolStore.getState().items.find((s) => s.symbol === symbol)
}

/**
 * getResearchPoolGroups
 * @returns string[]
 */
export function getResearchPoolGroups(): string[] {
  const { items } = useResearchPoolStore.getState()
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
    logger.debug('[researchPoolStore] 去抖触发 refresh')
    void useResearchPoolStore.getState().refresh()
  }, DEBOUNCE_MS)
}

/**
 * initResearchPoolStoreSubscriptions
 */
export function initResearchPoolStoreSubscriptions(): () => void {
  if (_unsubscribe) {
    logger.warn('[researchPoolStore] Subscriptions already initialized, skipping')
    return () => destroyResearchPoolStoreSubscriptions()
  }

  logger.info('[researchPoolStore] 初始化 DataBridge stocks 频道订阅')

  _unsubscribe = dataBridge.subscribe(STORE_NAME.stocks, (envelope) => {
    if (envelope.meta.source === MODULE_ID.pool) return
    debouncedRefresh()
  })

  return () => destroyResearchPoolStoreSubscriptions()
}

function destroyResearchPoolStoreSubscriptions(): void {
  _unsubscribe?.()
  _unsubscribe = null
  if (_debounceTimer) {
    clearTimeout(_debounceTimer)
    _debounceTimer = null
  }
  logger.info('[researchPoolStore] 订阅已销毁')
}
