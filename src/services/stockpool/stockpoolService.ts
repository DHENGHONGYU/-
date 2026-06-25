import {
  DEFAULT_POOL_GROUP,
  RESEARCH_STATUS,
  type ResearchStatus,
} from '@/config/dbConfig'
import { dataLayer } from '@/data/dataLayer'
import {
  getNextStatuses,
  getPoolLabel,
  getTransitionLabel,
  isValidTransition,
} from '@/core/poolTransitionEngine'
import type { DataLayerResult, Stock } from '@/data/types'

export interface PoolTransitionOption {
  value: ResearchStatus
  label: string
}

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
    const list = await dataLayer.stocks.list()
    return { success: true, data: list }
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
 * 校验由 poolTransitionEngine 执行，写操作经 dataLayer → DataBridge。
 */
export async function transitionStock(
  symbol: string,
  toStatus: ResearchStatus,
): Promise<DataLayerResult<Stock>> {
  const normalized = symbol.trim().toUpperCase()
  if (!normalized) {
    return { success: false, error: '股票代码不能为空' }
  }

  const stock = await dataLayer.stocks.get(normalized)
  if (!stock) {
    return { success: false, error: `股票不存在: ${normalized}` }
  }

  if (!isValidTransition(stock.researchStatus, toStatus)) {
    return {
      success: false,
      error: `非法流转: ${getPoolLabel(stock.researchStatus)} → ${getPoolLabel(toStatus)}`,
    }
  }

  const updateResult = await dataLayer.stocks.updateStatus(normalized, toStatus)
  if (!updateResult.success) {
    return { success: false, error: updateResult.error }
  }

  const updated = await dataLayer.stocks.get(normalized)
  if (!updated) {
    return { success: false, error: `流转后未找到股票: ${normalized}` }
  }
  return { success: true, data: updated }
}

/**
 * 按研究状态获取股票列表
 */
export async function getStocksByStatus(
  status: ResearchStatus,
): Promise<DataLayerResult<Stock[]>> {
  try {
    const list = await dataLayer.stocks.listByStatus(status)
    return { success: true, data: list }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 获取某状态的流转选项
 */
export function getPoolTransitionOptions(status: ResearchStatus): PoolTransitionOption[] {
  return getNextStatuses(status).map((value) => ({
    value,
    label: getTransitionLabel(status, value),
  }))
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
      if (!result.success) {
        return { success: false, error: result.error }
      }
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
    const groups = await dataLayer.stocks.listGroups()
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
    const list = await dataLayer.stocks.listByGroup(group)
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

  return dataLayer.stocks.updateGroup(normalized, group)
}

/**
 * 判断给定名称是否为默认分组
 */
export function isDefaultGroup(group?: string): boolean {
  return group === undefined || group === DEFAULT_POOL_GROUP
}
