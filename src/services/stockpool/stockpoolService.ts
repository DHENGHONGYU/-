import { DEFAULT_POOL_GROUP, RESEARCH_STATUS, type ResearchStatus } from '@/constants/stockpool.constants'
import { dataBridge, ENVELOPE_ACTION, STORE_NAME, MODULE_ID } from '@/core/databridge'
import { EnvelopeFactory, ENVELOPE_TARGET } from '@/core/envelope'
import {
  getPoolLabel,
  getPoolTransitionOptions,
  isValidTransition,
  type PoolTransitionOption,
} from '@/core/poolTransitionEngine'
import type { DataLayerResult, Stock } from '@/data/types'
import { nanoid } from 'nanoid'

export type { PoolTransitionOption } from '@/core/poolTransitionEngine'
export { getPoolTransitionOptions } from '@/core/poolTransitionEngine'

export interface PoolGroup {
  status: ResearchStatus
  label: string
  stocks: Stock[]
  options: PoolTransitionOption[]
}

export { DEFAULT_POOL_GROUP }

/**
 * 获取全部标的列表（只读）
 */
export async function listStocks(): Promise<DataLayerResult<Stock[]>> {
  try {
    const result = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
      source: MODULE_ID.stockpool,
    })
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: result.data ?? [] }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 将股票流转到目标状态
 *
 * 校验由 poolTransitionEngine 执行，写操作经 DataBridge 信封协议。
 */
export async function transitionStock(
  symbol: string,
  toStatus: ResearchStatus,
): Promise<DataLayerResult<Stock>> {
  const normalized = symbol.trim().toUpperCase()
  if (!normalized) {
    return { success: false, error: '股票代码不能为空' }
  }

  const stockResult = await dataBridge.query<Stock>({
    action: ENVELOPE_ACTION.queryGet,
    store: STORE_NAME.stocks,
    key: normalized,
    source: MODULE_ID.stockpool,
  })
  if (!stockResult.success || !stockResult.data) {
    return { success: false, error: `股票不存在: ${normalized}` }
  }
  const stock = stockResult.data

  if (!isValidTransition(stock.researchStatus, toStatus)) {
    return {
      success: false,
      error: `非法流转: ${getPoolLabel(stock.researchStatus)} → ${getPoolLabel(toStatus)}`,
    }
  }

  const envelope = EnvelopeFactory.create(
    {
      source: MODULE_ID.stockpool,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.updateStockStatus,
      traceId: `pool-transition-${nanoid(8)}-${normalized}`,
    },
    { symbol: normalized, status: toStatus },
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
    source: MODULE_ID.stockpool,
  })
  if (!updatedResult.success || !updatedResult.data) {
    return { success: false, error: `流转后未找到股票: ${normalized}` }
  }
  return { success: true, data: updatedResult.data }
}

/**
 * 按研究状态获取股票列表
 */
export async function getStocksByStatus(
  status: ResearchStatus,
): Promise<DataLayerResult<Stock[]>> {
  try {
    const result = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.stocks,
      indexName: 'by-status',
      indexValue: status,
      source: MODULE_ID.stockpool,
    })
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true, data: result.data ?? [] }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 获取全部股票池分组（按 researchStatus 维度）
 */
export async function getAllPoolGroups(): Promise<DataLayerResult<PoolGroup[]>> {
  try {
    const allStatuses = Object.values(RESEARCH_STATUS) as ResearchStatus[]
    const groups: PoolGroup[] = []

    for (const status of allStatuses) {
      const result = await getStocksByStatus(status)
      if (!result.success) return { success: false, error: result.error }
      groups.push({
        status,
        label: getPoolLabel(status),
        stocks: result.data ?? [],
        options: getPoolTransitionOptions(status),
      })
    }

    return { success: true, data: groups }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 获取所有股票池分组名称列表（用户自定义分组维度）
 */
export async function getPoolGroups(): Promise<DataLayerResult<string[]>> {
  try {
    const result = await dataBridge.query<string[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
      source: MODULE_ID.stockpool,
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? '获取分组失败' }
    }
    // 从全部股票中提取唯一分组名
    const stocks = result.data as unknown as Stock[]
    const groups = [...new Set(stocks.map((s) => s.group ?? DEFAULT_POOL_GROUP))]
    return { success: true, data: groups }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 按分组名称获取股票列表
 */
export async function getStocksByGroup(
  group: string,
): Promise<DataLayerResult<Stock[]>> {
  try {
    const result = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
      source: MODULE_ID.stockpool,
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? '获取股票失败' }
    }
    const list = result.data.filter((s) => (s.group ?? DEFAULT_POOL_GROUP) === group)
    return { success: true, data: list }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 更新股票所属分组
 */
export async function updateStockGroup(
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
      source: MODULE_ID.stockpool,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.updateStockGroup,
      traceId: `pool-group-${nanoid(8)}-${normalized}`,
    },
    { symbol: normalized, group },
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
    source: MODULE_ID.stockpool,
  })
  if (!updatedResult.success || !updatedResult.data) {
    return { success: false, error: `更新后未找到股票: ${normalized}` }
  }
  return { success: true, data: updatedResult.data }
}

/**
 * 判断给定名称是否为默认分组
 */
export function isDefaultGroup(group?: string): boolean {
  return group === undefined || group === DEFAULT_POOL_GROUP
}
