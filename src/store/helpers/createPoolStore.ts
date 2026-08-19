/**
 * @module store/helpers/createPoolStore
 * @description 股票池 Store 工厂（三分拆收敛，T1-1）。
 *
 * 将 intention / research / position 三个池 Store 的共享 Zustand 逻辑
 * （refresh / addItem / updateItem / deleteItem / updateStatus / updateGroup /
 * getByStatus / getByGroup / DataBridge 订阅 / 去抖刷新 / 派生 getter）收敛为单一工厂，
 * 三个 wrapper 仅保留 pool 特定的 toPoolItem 映射与极少量差异
 * （如 intention 的 deleteItems）。
 *
 * 约束（T1-1）：
 * - 统一 DEBOUNCE_MS=100（来自 @/constants/timing.constants，单一真相源）
 * - withBroadcast 统一走 @/lib/withBroadcast（解除 services 层对 store 层依赖）
 * - 泛型 Status extends PoolStatus
 * - 保留全部外部消费点导出名与签名（useXxxPoolStore / getXxxPoolTotalCount|ItemBySymbol|Groups /
 *   initXxxPoolStoreSubscriptions / _resetXxxPoolStoreSubscriptionsForTest / toPoolItem）
 * - Extra 泛型 + extraMethods 钩子：允许 pool 注入池特定方法（如 intention 的 deleteItems），
 *   使其仍可通过 useXxxPoolStore.getState().<method>() 访问（测试基线依赖此形态）。
 *
 * @doc [V9-DOC-PROJ-108, V9-DOC-BACK-011, V9-DOC-DATA-024, V9-DOC-DATA-032, V9-DOC-DATA-031]
*/

import { create, type StoreApi, type UseBoundStore } from 'zustand'
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
  type PoolType,
  type PoolStatus,
} from '@/constants/pool.constants'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { isValidTransition } from '@/core/poolTransitionEngine'
import { EVENT_NAMES } from '@/constants/store-channels.constants'
import { withBroadcast } from '@/lib/withBroadcast'
import { DEBOUNCE_MS } from '@/constants/timing.constants'
import { nanoid } from 'nanoid'
import type { PoolItem } from '@/types/modules/pool.types'
import type { Stock } from '@/data/types'

/**
 * 池 Store 基础状态形状（不含 Extra）。
 * 工厂内部所有 set({...}) 调用只触碰此基础字段/方法，故额外抽离以便局部类型收窄，
 * 规避 `Base & Extra`（Extra 为泛型）导致 Partial<...> 对字面量 set 的不安全推断。
 */
export interface PoolStoreBaseState<
  Item extends PoolItem,
  Status extends PoolStatus,
  AddItemInput,
  UpdateInput,
> {
  items: Item[]
  loading: boolean
  error: string | null
  isRefreshing: boolean
  lastUpdated: number

  refresh: () => Promise<void>
  addItem: (item: AddItemInput) => Promise<boolean>
  updateItem: (symbol: string, updates: UpdateInput) => Promise<boolean>
  deleteItem: (symbol: string) => Promise<boolean>
  updateStatus: (symbol: string, newStatus: Status) => Promise<boolean>
  updateGroup: (symbol: string, group: string) => Promise<boolean>
  getByStatus: (status: Status) => Item[]
  getByGroup: (group: string) => Item[]
}

/** 池 Store 完整状态形状（基础 + 池特定 Extra 方法，如 intention 的 deleteItems） */
export type PoolStoreState<
  Item extends PoolItem,
  Status extends PoolStatus,
  AddItemInput,
  UpdateInput,
  Extra extends Record<string, unknown> = Record<string, unknown>,
> = PoolStoreBaseState<Item, Status, AddItemInput, UpdateInput> & Extra

/** 工厂配置（pool 特定差异由此注入） */
export interface PoolStoreConfig<
  Item extends PoolItem,
  Status extends PoolStatus,
  AddItemInput,
  UpdateInput,
  Extra extends Record<string, unknown> = Record<string, unknown>,
> {
  /** 池类型（intention / research / position） */
  pool: PoolType
  /** 新录入标的默认状态 */
  defaultStatus: Status
  /** Stock → 池条目的映射（pool 特定，含 position 的 NaN 日志 / intention 的 screenReason 等） */
  toPoolItem: (stock: Stock) => Item
  /** 可选：refresh 时按指定比较器排序（如 intention 按 ingestedAt DESC） */
  sortOnRefresh?: (a: Stock, b: Stock) => number
  /**
   * 可选：注入池特定的额外 store 方法（如 intention 的 deleteItems 批量删除）。
   * 注入的方法仍通过 useXxxPoolStore.getState().<method>() 访问，保证测试基线形态一致。
   * ctx 提供 get/set 以便方法复用工厂内置逻辑（deleteItem / refresh 等）。
   */
  extraMethods?: (ctx: {
    get: () => PoolStoreState<Item, Status, AddItemInput, UpdateInput, Extra>
    set: StoreApi<PoolStoreState<Item, Status, AddItemInput, UpdateInput, Extra>>['setState']
  }) => Extra
}

/** 工厂返回值：绑定到本池实例的 Store 与派生 getter / 订阅控制 */
export interface PoolStoreApi<
  Item extends PoolItem,
  Status extends PoolStatus,
  AddItemInput,
  UpdateInput,
  Extra extends Record<string, unknown> = Record<string, unknown>,
> {
  useStore: UseBoundStore<StoreApi<PoolStoreState<Item, Status, AddItemInput, UpdateInput, Extra>>>
  getTotalCount: () => number
  getItemBySymbol: (symbol: string) => Item | undefined
  getGroups: () => string[]
  initSubscriptions: () => () => void
  resetSubscriptionsForTest: () => void
}

/**
 * createPoolStore
 * @description 收敛三池共享逻辑的工厂。
 */
export function createPoolStore<
  Item extends PoolItem = PoolItem,
  Status extends PoolStatus = PoolStatus,
  AddItemInput extends {
    symbol: string
    name: string
    source: Stock['source']
    group?: string
  } = Omit<Item, 'pool' | 'status' | 'dataVersion' | 'ingestedAt' | 'updatedAt'>,
  UpdateInput = Partial<Item>,
  Extra extends Record<string, unknown> = Record<string, unknown>,
>(
  config: PoolStoreConfig<Item, Status, AddItemInput, UpdateInput, Extra>,
): PoolStoreApi<Item, Status, AddItemInput, UpdateInput, Extra> {
  const { pool: POOL, defaultStatus, toPoolItem, sortOnRefresh, extraMethods } = config
  const logger = getLogger()

  const initialState = {
    items: [] as Item[],
    loading: false,
    error: null as string | null,
    isRefreshing: false,
    lastUpdated: 0,
  }

  let _unsubscribe: (() => void) | null = null
  let _debounceTimer: ReturnType<typeof setTimeout> | null = null

  function debouncedRefresh(): void {
    if (_debounceTimer) clearTimeout(_debounceTimer)
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null
      logger.debug(`[poolStore:${POOL}] 去抖触发 refresh`)
      void useStore.getState().refresh()
    }, DEBOUNCE_MS)
  }

  function destroySubscriptions(): void {
    _unsubscribe?.()
    _unsubscribe = null
    if (_debounceTimer) {
      clearTimeout(_debounceTimer)
      _debounceTimer = null
    }
    logger.info(`[poolStore:${POOL}] 订阅已销毁`)
  }

  const useStore = create<PoolStoreState<Item, Status, AddItemInput, UpdateInput, Extra>>(
    (set, get) => {
      // set 的签名依赖泛型 Extra，Partial<Base & Extra> 对字面量 set 不安全；
      // 工厂内所有 set({...}) 仅触碰基础字段，故收窄为 base-only partial setter。
      const setBase = set as unknown as (
        partial: Partial<PoolStoreBaseState<Item, Status, AddItemInput, UpdateInput>>,
      ) => void
      const extra = (extraMethods ? extraMethods({ get, set }) : {}) as Extra

      return {
        ...initialState,

        refresh: async () => {
          if (get().isRefreshing) return
          const isFirstLoad = get().items.length === 0 && get().lastUpdated === 0
          logger.info(`[poolStore:${POOL}] refresh 开始`)
          setBase({ isRefreshing: true, loading: isFirstLoad, error: null })

          try {
            const result = await dataBridge.query<Stock[]>({
              action: ENVELOPE_ACTION.queryByIndex,
              store: STORE_NAME.stocks,
              indexName: 'by-pool',
              indexValue: POOL,
              source: MODULE_ID.pool,
            })
            if (!result.success) {
              throw new Error(result.error ?? `查询${POOL}池失败`)
            }
            const raw = result.data ?? []
            const comparator = sortOnRefresh ?? ((_a: Stock, _b: Stock): number => 0)
            const list = raw
              .filter((s) => s.pool === POOL)
              .sort(comparator)
              .map(toPoolItem)
            setBase({
              items: list,
              loading: false,
              isRefreshing: false,
              lastUpdated: Date.now(),
              error: null,
            })
            logger.info(`[poolStore:${POOL}] refresh 完成: ${list.length} 条`)
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            logger.error(`[poolStore:${POOL}] refresh 失败: ${message}`)
            setBase({ error: message, loading: false, isRefreshing: false })
          }
        },

        addItem: async (item) => {
          const normalizedSymbol = item.symbol.trim().toUpperCase()
          logger.info(`[poolStore:${POOL}] addItem: ${item.name}(${normalizedSymbol})`)
          setBase({ error: null })

          try {
            const existingResult = await dataBridge.query<Stock>({
              action: ENVELOPE_ACTION.queryGet,
              store: STORE_NAME.stocks,
              key: normalizedSymbol,
              source: MODULE_ID.pool,
            })
            if (existingResult.success && existingResult.data) {
              const message = `${item.name}(${normalizedSymbol}) 已存在`
              logger.warn(`[poolStore:${POOL}] addItem 失败: ${message}`)
              setBase({ error: message })
              return false
            }

            const fullStock = {
              ...item,
              symbol: normalizedSymbol,
              pool: POOL,
              researchStatus: defaultStatus,
              source: item.source ?? DATA_SOURCE.manual,
              group: item.group ?? DEFAULT_POOL_GROUP,
              dataVersion: 1,
              ingestedAt: Date.now(),
              updatedAt: Date.now(),
            } as Stock

            const envelope = EnvelopeFactory.create(
              {
                source: MODULE_ID.pool,
                target: ENVELOPE_TARGET.db,
                action: ENVELOPE_ACTION.insertStock,
                traceId: `pool-${POOL}-add-${nanoid(8)}-${normalizedSymbol}`,
              },
              fullStock,
            )
            await dataBridge.forward(envelope)
            withBroadcast(EVENT_NAMES.POOL_CHANGED, {
              action: 'add',
              pool: POOL,
              symbol: normalizedSymbol,
            })
            return true
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            logger.error(`[poolStore:${POOL}] addItem 失败: ${message}`)
            setBase({ error: message })
            return false
          }
        },

        updateItem: async (symbol, updates) => {
          const normalized = symbol.trim().toUpperCase()
          logger.info(`[poolStore:${POOL}] updateItem: ${normalized}`)
          setBase({ error: null })

          const existing = get().items.find((s) => s.symbol === normalized)
          if (!existing) {
            const message = `标的不存在: ${normalized}`
            logger.warn(`[poolStore:${POOL}] updateItem 失败: ${message}`)
            setBase({ error: message })
            return false
          }

          try {
            const envelope = EnvelopeFactory.create(
              {
                source: MODULE_ID.pool,
                target: ENVELOPE_TARGET.db,
                action: ENVELOPE_ACTION.updateStock,
                traceId: `pool-${POOL}-update-${nanoid(8)}-${normalized}`,
              },
              { symbol: normalized, ...(updates as object), updatedAt: Date.now() },
            )
            await dataBridge.forward(envelope)
            withBroadcast(EVENT_NAMES.POOL_CHANGED, {
              action: 'update',
              pool: POOL,
              symbol: normalized,
              updates,
            })
            return true
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            logger.error(`[poolStore:${POOL}] updateItem 失败: ${message}`)
            setBase({ error: message })
            return false
          }
        },

        deleteItem: async (symbol) => {
          const normalized = symbol.trim().toUpperCase()
          logger.info(`[poolStore:${POOL}] deleteItem: ${normalized}`)
          setBase({ error: null })

          try {
            const envelope = EnvelopeFactory.create(
              {
                source: MODULE_ID.pool,
                target: ENVELOPE_TARGET.db,
                action: ENVELOPE_ACTION.deleteStock,
                traceId: `pool-${POOL}-delete-${nanoid(8)}-${normalized}`,
              },
              { symbol: normalized },
            )
            await dataBridge.forward(envelope)
            withBroadcast(EVENT_NAMES.POOL_CHANGED, {
              action: 'delete',
              pool: POOL,
              symbol: normalized,
            })
            return true
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            logger.error(`[poolStore:${POOL}] deleteItem 失败: ${message}`)
            setBase({ error: message })
            return false
          }
        },

        updateStatus: async (symbol, newStatus) => {
          const normalized = symbol.trim().toUpperCase()
          logger.info(`[poolStore:${POOL}] updateStatus: ${normalized} → ${newStatus}`)
          setBase({ error: null })

          const item = get().items.find((s) => s.symbol === normalized)
          if (!item) {
            const message = `标的不存在: ${normalized}`
            logger.warn(`[poolStore:${POOL}] updateStatus 失败: ${message}`)
            setBase({ error: message })
            return false
          }

          if (!isValidTransition(item.pool, item.status, POOL, newStatus)) {
            const message = `非法状态流转: ${item.status} → ${newStatus}`
            logger.warn(`[poolStore:${POOL}] updateStatus 失败: ${message}`)
            setBase({ error: message })
            return false
          }

          try {
            const envelope = EnvelopeFactory.create(
              {
                source: MODULE_ID.pool,
                target: ENVELOPE_TARGET.db,
                action: ENVELOPE_ACTION.updateStock,
                traceId: `pool-${POOL}-status-${nanoid(8)}-${normalized}`,
              },
              { symbol: normalized, researchStatus: newStatus, updatedAt: Date.now() },
            )
            await dataBridge.forward(envelope)
            withBroadcast(EVENT_NAMES.POOL_CHANGED, {
              action: 'updateStatus',
              pool: POOL,
              symbol: normalized,
              newStatus,
            })
            return true
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            logger.error(`[poolStore:${POOL}] updateStatus 失败: ${message}`)
            setBase({ error: message })
            return false
          }
        },

        updateGroup: async (symbol, group) => {
          const normalized = symbol.trim().toUpperCase()
          const normalizedGroup = group.trim()
          logger.info(`[poolStore:${POOL}] updateGroup: ${normalized} → ${normalizedGroup}`)
          setBase({ error: null })

          if (!normalizedGroup) {
            const message = '分组名称不能为空'
            logger.warn(`[poolStore:${POOL}] updateGroup 失败: ${message}`)
            setBase({ error: message })
            return false
          }

          try {
            const envelope = EnvelopeFactory.create(
              {
                source: MODULE_ID.pool,
                target: ENVELOPE_TARGET.db,
                action: ENVELOPE_ACTION.updateStock,
                traceId: `pool-${POOL}-group-${nanoid(8)}-${normalized}`,
              },
              { symbol: normalized, group: normalizedGroup, updatedAt: Date.now() },
            )
            await dataBridge.forward(envelope)
            withBroadcast(EVENT_NAMES.POOL_CHANGED, {
              action: 'updateGroup',
              pool: POOL,
              symbol: normalized,
              group: normalizedGroup,
            })
            return true
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            logger.error(`[poolStore:${POOL}] updateGroup 失败: ${message}`)
            setBase({ error: message })
            return false
          }
        },

        getByStatus: (status) => {
          return get().items.filter((s) => s.status === status)
        },

        getByGroup: (group) => {
          return get().items.filter((s) => (s.group ?? DEFAULT_POOL_GROUP) === group)
        },

        ...extra,
      }
    },
  )

  function initSubscriptions(): () => void {
    if (_unsubscribe) {
      logger.warn(`[poolStore:${POOL}] Subscriptions already initialized, skipping`)
      return () => destroySubscriptions()
    }

    logger.info(`[poolStore:${POOL}] 初始化 DataBridge stocks 频道订阅`)

    _unsubscribe = dataBridge.subscribe(STORE_NAME.stocks, (envelope) => {
      if (envelope.meta.source === MODULE_ID.pool) return
      debouncedRefresh()
    })

    return () => destroySubscriptions()
  }

  function resetSubscriptionsForTest(): void {
    destroySubscriptions()
    logger.info(`[poolStore:${POOL}] 订阅已重置（测试）`)
  }

  return {
    useStore,
    getTotalCount: () => useStore.getState().items.length,
    getItemBySymbol: (symbol: string) => useStore.getState().items.find((s) => s.symbol === symbol),
    getGroups: () => {
      const { items } = useStore.getState()
      const groups = new Set<string>()
      for (const item of items) {
        groups.add(item.group ?? DEFAULT_POOL_GROUP)
      }
      return Array.from(groups).sort()
    },
    initSubscriptions,
    resetSubscriptionsForTest,
  }
}
