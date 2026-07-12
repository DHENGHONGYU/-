/**
 * @fileoverview watchlists 表 Domain Store
 *
 * 从 dataLayer.ts 拆分而来，职责：
 * - 封装观察列表快照（Watchlist）的写入与读取
 * - 修复 C4：原 watchlists 物理表无任何写通道，属孤立表；
 *   现由 watchlistStore 在 loadStocks 成功后经 DataBridge 落表，作为离线缓存。
 *
 * @see src/store/watchlistStore.ts — 调用方（落表触发点）
 * @see src/data/types.ts — Watchlist 接口定义（keyPath: id）
 */
import { STORE_NAME } from '@/config/dbConfig'
import { getLogger } from '@/lib/logger'
import type { DataLayerResult, Watchlist } from './types'
import { sendWriteEnvelope, queryGet, queryList } from './dataLayerHelpers'

const logger = getLogger()

export const watchlistStore = {
  /**
   * 保存观察列表快照（upsert，按 id 覆盖）。
   * @param record 必须含 id（keyPath），通常为 { id: 'default', name, items, createdAt, updatedAt }
   */
  async save(record: Watchlist): Promise<DataLayerResult<void>> {
    logger.info('[dataLayer.watchlistStore] save 开始', { id: record.id, itemCount: record.items.length })
    const result = await sendWriteEnvelope<void>('saveWatchlist', record, 'system')
    if (result.success) {
      logger.info('[dataLayer.watchlistStore] save 成功', { id: record.id })
    } else {
      logger.error('[dataLayer.watchlistStore] save 失败', { error: result.error })
    }
    return result
  },

  /** 按 id 读取观察列表快照 */
  async get(id: string): Promise<Watchlist | undefined> {
    return queryGet<Watchlist>(STORE_NAME.watchlists, id)
  },

  /** 读取全部观察列表 */
  async list(): Promise<Watchlist[]> {
    return queryList<Watchlist>(STORE_NAME.watchlists)
  },
}
