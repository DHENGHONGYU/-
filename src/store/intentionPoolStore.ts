/**
 * @module intentionPoolStore
 * @description 意向候选池 Zustand Store（薄包装，逻辑收敛于 createPoolStore）。
 *
 * 物理数据仍存储于 IndexedDB `stocks` store，通过 `pool === 'intention'` 过滤。
 * 共享逻辑见 `@/store/helpers/createPoolStore`；本文件保留 intention 特定的
 * toPoolItem 映射（screenReason / screenSource）、refresh 时按 ingestedAt DESC 排序，
 * 以及池特有的 deleteItems（批量删除，通过工厂 extraMethods 注入为 store 方法，
 * 仍经 useIntentionPoolStore.getState().deleteItems 访问，保证测试基线形态一致）。
 *
 * @doc [V9-DOC-PROJ-108, V9-DOC-BACK-011, V9-DOC-DATA-024, V9-DOC-DATA-032, V9-DOC-DATA-031]
*/

import { getLogger } from '@/lib/logger'
import { createPoolStore } from '@/store/helpers/createPoolStore'
import { DEFAULT_POOL_STATUS, POOL_TYPE, type IntentionStatus } from '@/constants/pool.constants'
import type { IntentionPoolItem, PoolItem } from '@/types/modules/pool.types'
import type { Stock } from '@/data/types'

const logger = getLogger()
const POOL = POOL_TYPE.intention

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
    screenSource: stock.screenSource,
  } as PoolItem
}

const poolStore = createPoolStore<
  PoolItem,
  IntentionStatus,
  Omit<IntentionPoolItem, 'pool' | 'status' | 'dataVersion' | 'ingestedAt' | 'updatedAt'>,
  Partial<IntentionPoolItem>,
  { deleteItems: (symbols: string[]) => Promise<number> }
>({
  pool: POOL,
  defaultStatus: DEFAULT_POOL_STATUS[POOL] as IntentionStatus,
  toPoolItem,
  // 按 ingestedAt 倒序排序：最新加入的标的排在最前，
  // 避免依赖 IndexedDB 索引返回顺序（默认按主键 symbol 排序）导致新增股票不在第一顺位。
  sortOnRefresh: (a, b) => (b.ingestedAt ?? 0) - (a.ingestedAt ?? 0),
  // intention 池特有：批量删除（通过工厂 extraMethods 注入为 store 方法）
  extraMethods: ({ get }) => ({
    deleteItems: async (symbols: string[]): Promise<number> => {
      if (!Array.isArray(symbols) || symbols.length === 0) {
        logger.warn('[intentionPoolStore] deleteItems 收到空列表，跳过')
        return 0
      }

      // 归一化 + 去重，避免重复删除同一标的
      const normalized = Array.from(
        new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
      )
      logger.info(`[intentionPoolStore] deleteItems: ${normalized.length} 条`)

      let deleted = 0
      for (const symbol of normalized) {
        // 复用单条删除逻辑（统一走 DataBridge 信封协议 + ACL 校验 + 广播）
        const ok = await get().deleteItem(symbol)
        if (ok) deleted++
      }
      await get().refresh()
      return deleted
    },
  }),
})

/**
 * useIntentionPoolStore
 */
export const useIntentionPoolStore = poolStore.useStore

/**
 * getIntentionPoolTotalCount
 * @returns number
 */
export function getIntentionPoolTotalCount(): number {
  return poolStore.getTotalCount()
}

/**
 * getIntentionPoolItemBySymbol
 * @param symbol
 * @returns PoolItem | undefined
 */
export function getIntentionPoolItemBySymbol(symbol: string): PoolItem | undefined {
  return poolStore.getItemBySymbol(symbol)
}

/**
 * getIntentionPoolGroups
 * @returns string[]
 */
export function getIntentionPoolGroups(): string[] {
  return poolStore.getGroups()
}

/**
 * initIntentionPoolStoreSubscriptions
 */
export function initIntentionPoolStoreSubscriptions(): () => void {
  return poolStore.initSubscriptions()
}

/**
 * 测试用：重置订阅状态
 */
export function _resetIntentionPoolStoreSubscriptionsForTest(): void {
  poolStore.resetSubscriptionsForTest()
}
