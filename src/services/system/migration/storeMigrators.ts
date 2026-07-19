import { STORE_NAME } from '@/config/dbConfig'
import { sendWriteEnvelope, queryGet, queryByIndex } from '@/data/dataLayerHelpers'
import { generateId } from '@/lib/utils'
import { getLogger } from '@/lib/logger'
import { writeMigrationAuditLog } from './migrationValidators'
import type { MigrationReport, MigrationOptions, StoreImportContext, V9ImportShape } from './migrationTypes'
import type { NewsStockMap, Order } from '@/data/types'

const logger = getLogger()

async function importOneItem<T>(
  ctx: StoreImportContext<T>,
  item: T,
): Promise<{ outcome: 'skip' | 'ok' | 'fail'; key: string; error?: string }> {
  const key = ctx.keyPath(item)
  try {
    const existing = await ctx.get(key)
    if (existing && !ctx.overwrite) {
      return { outcome: 'skip', key }
    }
    await ctx.save(item)
    return { outcome: 'ok', key }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`导入 ${ctx.storeName} 失败`, { key, error: message })
    return { outcome: 'fail', key, error: message }
  }
}

async function importStoreItems<T>(ctx: StoreImportContext<T>): Promise<{
  success: number
  skipped: number
  failed: number
  errors: Array<{ index: number; id?: string; error: string }>
}> {
  let success = 0
  let skipped = 0
  let failed = 0
  const errors: Array<{ index: number; id?: string; error: string }> = []

  for (let i = 0; i < ctx.items.length; i++) {
    const item = ctx.items[i]
    if (!item) continue
    const r = await importOneItem(ctx, item)
    if (r.outcome === 'skip') skipped++
    else if (r.outcome === 'ok') success++
    else {
      failed++
      errors.push({ index: i, id: r.key, error: r.error ?? 'unknown' })
    }
  }

  return { success, skipped, failed, errors }
}

async function migrateOne<T>(
  traceId: string,
  storeName: string,
  items: T[],
  keyPath: (item: T) => string,
  get: (key: string) => Promise<T | undefined>,
  save: (item: T) => Promise<unknown>,
  overwrite?: boolean,
): Promise<MigrationReport['details'][number]> {
  const result = await importStoreItems({ storeName, items, keyPath, get, save, overwrite })
  const detail = { store: storeName, total: items.length, ...result }
  await writeMigrationAuditLog({ traceId, store: storeName, total: items.length, ...result })
  return detail
}

/**
 * migrateStocks
 */
export async function migrateStocks(
  traceId: string,
  transformed: V9ImportShape,
  options: MigrationOptions,
): Promise<MigrationReport['details'][number]> {
  return migrateOne(
    traceId,
    'stocks',
    transformed.stocks,
    (s) => s.symbol,
    (key) => queryGet(STORE_NAME.stocks, key),
    (s) => sendWriteEnvelope('insertStock', s, 'system'),
    options.overwriteExisting,
  )
}

/**
 * migrateDailyQuotes
 */
export async function migrateDailyQuotes(
  traceId: string,
  transformed: V9ImportShape,
  options: MigrationOptions,
): Promise<MigrationReport['details'][number]> {
  return migrateOne(
    traceId,
    'daily_quotes',
    transformed.dailyQuotes,
    (q) => q.symbol,
    (key) => queryGet(STORE_NAME.dailyQuotes, key),
    (q) => sendWriteEnvelope('saveDailyQuotes', q, 'system'),
    options.overwriteExisting,
  )
}

/**
 * migrateV6Scores
 */
export async function migrateV6Scores(
  traceId: string,
  transformed: V9ImportShape,
  options: MigrationOptions,
): Promise<MigrationReport['details'][number]> {
  return migrateOne(
    traceId,
    'v6_scores',
    transformed.v6Scores,
    (s) => s.symbol,
    (key) => queryGet(STORE_NAME.v6Scores, key),
    (s) => sendWriteEnvelope('saveScores', s, 'system'),
    options.overwriteExisting,
  )
}

/**
 * migrateScoreDocs
 */
export async function migrateScoreDocs(
  traceId: string,
  transformed: V9ImportShape,
  options: MigrationOptions,
): Promise<MigrationReport['details'][number]> {
  const docs = [...transformed.scoreDocsFromScores, ...transformed.scoreDocs]
  return migrateOne(
    traceId,
    'score_docs',
    docs,
    (d) => d.docId,
    (key) => queryGet(STORE_NAME.scoreDocs, key),
    (d) => sendWriteEnvelope('saveScoreDocs', d, 'system'),
    options.overwriteExisting,
  )
}

/**
 * migrateOrders
 */
export async function migrateOrders(
  traceId: string,
  transformed: V9ImportShape,
  options: MigrationOptions,
): Promise<MigrationReport['details'][number]> {
  return migrateOne(
    traceId,
    'orders',
    transformed.orders,
    (o) => o.id,
    (key) => queryGet(STORE_NAME.orders, key),
    (o) => {
      const fullOrder: Order = {
        ...o,
        id: o.id || generateId(),
        createdAt: o.createdAt || Date.now(),
      }
      return sendWriteEnvelope('insertOrder', fullOrder, 'system')
    },
    options.overwriteExisting,
  )
}

/**
 * migrateSectorScores
 */
export async function migrateSectorScores(
  traceId: string,
  transformed: V9ImportShape,
  options: MigrationOptions,
): Promise<MigrationReport['details'][number]> {
  return migrateOne(
    traceId,
    'sector_scores',
    transformed.sectorScores,
    (s) => s.id,
    (key) => queryGet(STORE_NAME.sectorScores, key),
    (s) => sendWriteEnvelope('saveSectorScores', s, 'system'),
    options.overwriteExisting,
  )
}

/**
 * migrateRotationScores
 */
export async function migrateRotationScores(
  traceId: string,
  transformed: V9ImportShape,
  options: MigrationOptions,
): Promise<MigrationReport['details'][number]> {
  return migrateOne(
    traceId,
    'rotation_scores',
    transformed.rotationScores,
    (r) => r.id,
    (key) => queryGet(STORE_NAME.rotationScores, key),
    (r) => sendWriteEnvelope('saveRotationScores', r, 'system'),
    options.overwriteExisting,
  )
}

/**
 * migrateStrategySnapshots
 */
export async function migrateStrategySnapshots(
  traceId: string,
  transformed: V9ImportShape,
  options: MigrationOptions,
): Promise<MigrationReport['details'][number]> {
  return migrateOne(
    traceId,
    'strategy_snapshots',
    transformed.strategySnapshots,
    (s) => s.id,
    (key) => queryGet(STORE_NAME.strategySnapshots, key),
    (s) => sendWriteEnvelope('saveStrategySnapshots', s, 'system'),
    options.overwriteExisting,
  )
}

/**
 * migrateLocalDocs
 */
export async function migrateLocalDocs(
  traceId: string,
  transformed: V9ImportShape,
  options: MigrationOptions,
): Promise<MigrationReport['details'][number]> {
  return migrateOne(
    traceId,
    'local_docs',
    transformed.localDocs,
    (d) => d.id,
    (key) => queryGet(STORE_NAME.localDocs, key),
    (d) => sendWriteEnvelope('saveLocalDocs', d, 'system'),
    options.overwriteExisting,
  )
}

/**
 * migrateSentimentCache
 */
export async function migrateSentimentCache(
  traceId: string,
  transformed: V9ImportShape,
  options: MigrationOptions,
): Promise<MigrationReport['details'][number]> {
  return migrateOne(
    traceId,
    'sentiment_cache',
    transformed.sentimentCache,
    (c) => c.id,
    (key) => queryGet(STORE_NAME.sentimentCache, key),
    (c) => sendWriteEnvelope('saveSentimentCache', c, 'system'),
    options.overwriteExisting,
  )
}

/**
 * migrateNews
 */
export async function migrateNews(
  traceId: string,
  transformed: V9ImportShape,
  options: MigrationOptions,
): Promise<MigrationReport['details'][number]> {
  return migrateOne(
    traceId,
    'news',
    transformed.news,
    (n) => n.id,
    (key) => queryGet(STORE_NAME.news, key),
    (n) => sendWriteEnvelope('saveNews', n, 'system'),
    options.overwriteExisting,
  )
}

/**
 * migrateNewsStockMaps
 */
export async function migrateNewsStockMaps(
  traceId: string,
  transformed: V9ImportShape,
  options: MigrationOptions,
): Promise<MigrationReport['details'][number]> {
  return migrateOne(
    traceId,
    'news_stock_map',
    transformed.newsStockMaps,
    (m) => m.id,
    (key) =>
      queryByIndex<NewsStockMap>(STORE_NAME.newsStockMap, 'by-symbol', key.split('_')[0] ?? '').then((list) =>
        list.find((x) => x.id === key),
      ),
    (m) => sendWriteEnvelope('saveNewsStockMap', m, 'system'),
    options.overwriteExisting,
  )
}
