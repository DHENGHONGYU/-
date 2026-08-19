/**
 * @module researchPoolStore
 * @description 研究精选池 Zustand Store（薄包装，逻辑收敛于 createPoolStore）。
 *
 * 物理数据仍存储于 IndexedDB `stocks` store，通过 `pool === 'research'` 过滤。
 * 共享逻辑见 `@/store/helpers/createPoolStore`；本文件仅保留 pool 特定的
 * toPoolItem 映射与全部外部消费点导出名/签名。
 *
 * toPoolItem 中 `researchNote` 的复制粘贴错误（原 `stock.sector` 误作研究备注，TD-013）
 * 已于 T1-2 修复：Stock 无 researchNote 来源字段，统一映射为 undefined。
 *
 * @doc [V9-DOC-PROJ-108, V9-DOC-BACK-011, V9-DOC-DATA-024, V9-DOC-DATA-032, V9-DOC-DATA-031]
*/

import { createPoolStore } from '@/store/helpers/createPoolStore'
import { DEFAULT_POOL_STATUS, POOL_TYPE, type ResearchStatus } from '@/constants/pool.constants'
import type { PoolItem, ResearchPoolItem } from '@/types/modules/pool.types'
import type { Stock } from '@/data/types'

const POOL = POOL_TYPE.research

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
    // TD-013 修复：原 `researchNote: stock.sector` 为复制粘贴错误（板块字段误作研究备注）。
    // Stock 类型无 researchNote 来源字段（研究备注为研究池特有，应由 addItem/update 输入提供，
    // 而非从原始 Stock 映射），故此处不再从 Stock 取值，统一为 undefined，杜绝板块值泄漏进备注。
    // 若后续 Stock 模型新增 researchNote 字段，应改为 `researchNote: stock.researchNote`。
    researchNote: undefined,
  } as PoolItem
}

const poolStore = createPoolStore<
  PoolItem,
  ResearchStatus,
  Omit<ResearchPoolItem, 'pool' | 'status' | 'dataVersion' | 'ingestedAt' | 'updatedAt'>,
  Partial<ResearchPoolItem>
>({
  pool: POOL,
  defaultStatus: DEFAULT_POOL_STATUS[POOL] as ResearchStatus,
  toPoolItem,
})

/**
 * useResearchPoolStore
 */
export const useResearchPoolStore = poolStore.useStore

/**
 * getResearchPoolTotalCount
 * @returns number
 */
export function getResearchPoolTotalCount(): number {
  return poolStore.getTotalCount()
}

/**
 * getResearchPoolItemBySymbol
 * @param symbol
 * @returns PoolItem | undefined
 */
export function getResearchPoolItemBySymbol(symbol: string): PoolItem | undefined {
  return poolStore.getItemBySymbol(symbol)
}

/**
 * getResearchPoolGroups
 * @returns string[]
 */
export function getResearchPoolGroups(): string[] {
  return poolStore.getGroups()
}

/**
 * initResearchPoolStoreSubscriptions
 */
export function initResearchPoolStoreSubscriptions(): () => void {
  return poolStore.initSubscriptions()
}

/**
 * 测试用：重置订阅状态
 */
export function _resetResearchPoolStoreSubscriptionsForTest(): void {
  poolStore.resetSubscriptionsForTest()
}
