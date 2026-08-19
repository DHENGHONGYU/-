/**
 * @module positionPoolStore
 * @description 持仓池 Zustand Store（薄包装，逻辑收敛于 createPoolStore）。
 *
 * 物理数据仍存储于 IndexedDB `stocks` store，通过 `pool === 'position'` 过滤。
 * 共享逻辑见 `@/store/helpers/createPoolStore`；本文件保留 position 特定的
 * toPoolItem（含 P&L / NaN 处理日志）与全部外部消费点导出名/签名。
 *
 * @doc [V9-DOC-PROJ-108, V9-DOC-BACK-011, V9-DOC-DATA-024, V9-DOC-DATA-032, V9-DOC-DATA-031]
*/

import { getLogger } from '@/lib/logger'
import { createPoolStore } from '@/store/helpers/createPoolStore'
import { DEFAULT_POOL_STATUS, POOL_TYPE, type PositionStatus } from '@/constants/pool.constants'
import type { PoolItem, PositionPoolItem } from '@/types/modules/pool.types'
import type { Stock } from '@/data/types'

const logger = getLogger()
const POOL = POOL_TYPE.position

/**
 * toPoolItem（position 特定：含 P&L / NaN 显式空值标记日志）
 */
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

const poolStore = createPoolStore<
  PoolItem,
  PositionStatus,
  Omit<PositionPoolItem, 'pool' | 'status' | 'dataVersion' | 'ingestedAt' | 'updatedAt'>,
  Partial<PositionPoolItem>
>({
  pool: POOL,
  defaultStatus: DEFAULT_POOL_STATUS[POOL] as PositionStatus,
  toPoolItem,
})

/**
 * usePositionPoolStore
 */
export const usePositionPoolStore = poolStore.useStore

/**
 * getPositionPoolTotalCount
 * @returns number
 */
export function getPositionPoolTotalCount(): number {
  return poolStore.getTotalCount()
}

/**
 * getPositionPoolItemBySymbol
 * @param symbol
 * @returns PoolItem | undefined
 */
export function getPositionPoolItemBySymbol(symbol: string): PoolItem | undefined {
  return poolStore.getItemBySymbol(symbol)
}

/**
 * getPositionPoolGroups
 * @returns string[]
 */
export function getPositionPoolGroups(): string[] {
  return poolStore.getGroups()
}

/**
 * initPositionPoolStoreSubscriptions
 */
export function initPositionPoolStoreSubscriptions(): () => void {
  return poolStore.initSubscriptions()
}
