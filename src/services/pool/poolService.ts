/**
 * @module services/pool/poolService
 * @description 股票池三分拆 Service：intention / research / position 三池 CRUD 与流转。
 *
 * 物理存储仍使用 IndexedDB `stocks` store，通过 `pool` 字段区分三池。
 */

import {
  DEFAULT_POOL_GROUP,
  POOL_TYPE,
  type PoolType,
  type PoolStatus,
} from '@/constants/pool.constants'
import { dataBridge, ENVELOPE_ACTION, STORE_NAME, MODULE_ID } from '@/core/databridge'
import { EnvelopeFactory, ENVELOPE_TARGET } from '@/core/envelope'
import { getPoolTransitionOptions, isValidTransition, getPoolLabel } from '@/core/poolTransitionEngine'
import type { DataLayerResult, Stock } from '@/data/types'
import type { PoolItem, PoolLane, PoolTransitionTarget } from '@/types/modules/pool.types'
import { nanoid } from 'nanoid'

export type { PoolTransitionTarget } from '@/types/modules/pool.types'
export { getPoolTransitionOptions } from '@/core/poolTransitionEngine'

export { DEFAULT_POOL_GROUP }

/**
 * 将 Stock（物理存储）映射为 PoolItem（业务层）。
 */
export function mapStockToPoolItem(stock: Stock): PoolItem {
  const base = {
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
  }

  if (stock.pool === POOL_TYPE.position) {
    return {
      ...base,
      pool: POOL_TYPE.position,
      status: stock.researchStatus,
      quantity: stock.quantity ?? 0,
      avgCost: stock.avgCost ?? 0,
      currentPrice: stock.currentPrice ?? stock.price ?? 0,
    } as PoolItem
  }

  if (stock.pool === POOL_TYPE.intention) {
    return {
      ...base,
      pool: POOL_TYPE.intention,
      status: stock.researchStatus,
    } as PoolItem
  }

  return {
    ...base,
    pool: POOL_TYPE.research,
    status: stock.researchStatus,
  } as PoolItem
}

/**
 * 获取全部标的列表（只读）。
 * 传入 pool 则按池类型过滤。
 */
export async function listPoolItems(
  pool?: PoolType,
): Promise<DataLayerResult<PoolItem[]>> {
  try {
    const result = pool
      ? await dataBridge.query<Stock[]>({
          action: ENVELOPE_ACTION.queryByIndex,
          store: STORE_NAME.stocks,
          indexName: 'by-pool',
          indexValue: pool,
          source: MODULE_ID.pool,
        })
      : await dataBridge.query<Stock[]>({
          action: ENVELOPE_ACTION.queryList,
          store: STORE_NAME.stocks,
          source: MODULE_ID.pool,
        })
    if (!result.success) {
      return { success: false, error: result.error }
    }
    const items = (result.data ?? []).map(mapStockToPoolItem)
    return { success: true, data: items }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 将标的流转到目标池/状态。
 *
 * 校验由 poolTransitionEngine 执行，写操作经 DataBridge 信封协议。
 */
export async function transitionPoolItem(
  symbol: string,
  target: PoolTransitionTarget,
): Promise<DataLayerResult<Stock>> {
  const normalized = symbol.trim().toUpperCase()
  if (!normalized) {
    return { success: false, error: '股票代码不能为空' }
  }

  const stockResult = await dataBridge.query<Stock>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.stocks,
    key: normalized,
    source: MODULE_ID.pool,
  })
  if (!stockResult.success || !stockResult.data) {
    return { success: false, error: `标的不存在: ${normalized}` }
  }
  const stock = stockResult.data

  if (!isValidTransition(stock.pool, stock.researchStatus, target.pool, target.status)) {
    return {
      success: false,
      error: `非法流转: ${getPoolLabel(stock.pool, stock.researchStatus)} → ${getPoolLabel(target.pool, target.status)}`,
    }
  }

  const envelope = EnvelopeFactory.create(
    {
      source: MODULE_ID.pool,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.updateStock,
      traceId: `pool-transition-${nanoid(8)}-${normalized}`,
    },
    {
      symbol: normalized,
      pool: target.pool,
      researchStatus: target.status,
      updatedAt: Date.now(),
    },
  )
  try {
    await dataBridge.forward(envelope)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }

  const updatedResult = await dataBridge.query<Stock>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.stocks,
    key: normalized,
    source: MODULE_ID.pool,
  })
  if (!updatedResult.success || !updatedResult.data) {
    return { success: false, error: `流转后未找到标的: ${normalized}` }
  }
  return { success: true, data: updatedResult.data }
}

/**
 * 按池 + 状态获取标的列表。
 */
export async function getPoolItemsByStatus(
  pool: PoolType,
  status: PoolStatus,
): Promise<DataLayerResult<PoolItem[]>> {
  try {
    const result = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.stocks,
      indexName: 'by-pool',
      indexValue: pool,
      source: MODULE_ID.pool,
    })
    if (!result.success) {
      return { success: false, error: result.error }
    }
    const items = (result.data ?? [])
      .filter((s) => s.researchStatus === status)
      .map(mapStockToPoolItem)
    return { success: true, data: items }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 获取全部池分组（按 pool + status 维度，生成 lanes）。
 */
export async function getAllPoolLanes(): Promise<DataLayerResult<PoolLane[]>> {
  try {
    const allResult = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
      source: MODULE_ID.pool,
    })
    if (!allResult.success || !allResult.data) {
      return { success: false, error: allResult.error ?? '获取池失败' }
    }

    const lanes: PoolLane[] = []
    for (const stock of allResult.data) {
      const lane = lanes.find(
        (l) => l.status === stock.researchStatus,
      )
      const item = mapStockToPoolItem(stock)
      if (lane) {
        lane.items.push(item)
      } else {
        lanes.push({
          status: stock.researchStatus,
          label: getPoolLabel(stock.pool, stock.researchStatus),
          items: [item],
          options: getPoolTransitionOptions(stock.pool, stock.researchStatus),
        })
      }
    }

    return { success: true, data: lanes }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 获取所有股票池分组名称列表（用户自定义分组维度）。
 */
export async function getPoolGroups(): Promise<DataLayerResult<string[]>> {
  try {
    const result = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
      source: MODULE_ID.pool,
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? '获取分组失败' }
    }
    const groups = new Set(result.data.map((s) => s.group ?? DEFAULT_POOL_GROUP))
    groups.add(DEFAULT_POOL_GROUP)
    return { success: true, data: Array.from(groups) }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 按分组名称获取标的列表。
 */
export async function getPoolItemsByGroup(
  group: string,
): Promise<DataLayerResult<PoolItem[]>> {
  try {
    const result = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
      source: MODULE_ID.pool,
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? '获取标的失败' }
    }
    const items = result.data
      .filter((s) => (s.group ?? DEFAULT_POOL_GROUP) === group)
      .map(mapStockToPoolItem)
    return { success: true, data: items }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 更新标的分组。
 */
export async function updatePoolItemGroup(
  symbol: string,
  group: string,
): Promise<DataLayerResult<Stock>> {
  const normalized = symbol.trim().toUpperCase()
  if (!normalized) {
    return { success: false, error: '股票代码不能为空' }
  }
  if (!group.trim()) {
    return { success: false, error: '分组名称不能为空' }
  }

  const envelope = EnvelopeFactory.create(
    {
      source: MODULE_ID.pool,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.updateStock,
      traceId: `pool-group-${nanoid(8)}-${normalized}`,
    },
    { symbol: normalized, group, updatedAt: Date.now() },
  )
  try {
    await dataBridge.forward(envelope)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }

  const updatedResult = await dataBridge.query<Stock>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.stocks,
    key: normalized,
    source: MODULE_ID.pool,
  })
  if (!updatedResult.success || !updatedResult.data) {
    return { success: false, error: `更新后未找到标的: ${normalized}` }
  }
  return { success: true, data: updatedResult.data }
}

/**
 * 判断给定名称是否为默认分组。
 */
export function isDefaultGroup(group?: string): boolean {
  return group === undefined || group === DEFAULT_POOL_GROUP
}
