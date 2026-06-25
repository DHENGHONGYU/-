import { dataLayer } from '@/data/dataLayer'
import { getLogger } from '@/lib/logger'
import type {
  DailyQuotes,
  LocalDoc,
  NewsArticle,
  NewsStockMap,
  Order,
  RotationSectorScore,
  ScoreDocVersion,
  SectorScoreRecord,
  SentimentCache,
  Stock,
  StrategySnapshot,
  V6Score,
} from '@/data/types'
import { writeMigrationAuditLog } from './migrationValidators'
import type { MigrationReport, MigrationOptions, StoreImportContext, V9ImportShape } from './migrationTypes'

const logger = getLogger()

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
    const key = ctx.keyPath(item)
    try {
      const existing = await ctx.get(key)
      if (existing && !ctx.overwrite) {
        skipped++
        continue
      }
      await ctx.save(item)
      success++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`导入 ${ctx.storeName} 失败`, { key, error: message })
      failed++
      errors.push({ index: i, id: key, error: message })
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
    (key) => dataLayer.stocks.get(key),
    (s) => dataLayer.stocks.add(s as Stock),
    options.overwriteExisting,
  )
}

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
    (key) => dataLayer.dailyQuotes.get(key),
    (q) => dataLayer.dailyQuotes.save(q as DailyQuotes),
    options.overwriteExisting,
  )
}

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
    (key) => dataLayer.v6Scores.get(key),
    (s) => dataLayer.v6Scores.save(s as V6Score),
    options.overwriteExisting,
  )
}

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
    (key) => dataLayer.scoreDocs.get(key),
    (d) => dataLayer.scoreDocs.save(d as ScoreDocVersion),
    options.overwriteExisting,
  )
}

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
    (key) => dataLayer.orders.list().then((list) => list.find((x) => x.id === key)),
    (o) => dataLayer.orders.add(o as Order),
    options.overwriteExisting,
  )
}

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
    (key) => dataLayer.sectorScores.get(key),
    (s) => dataLayer.sectorScores.save(s as SectorScoreRecord),
    options.overwriteExisting,
  )
}

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
    (key) => dataLayer.rotationScores.get(key),
    (r) => dataLayer.rotationScores.save(r as RotationSectorScore),
    options.overwriteExisting,
  )
}

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
    (key) => dataLayer.strategySnapshots.get(key),
    (s) => dataLayer.strategySnapshots.save(s as StrategySnapshot),
    options.overwriteExisting,
  )
}

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
    (key) => dataLayer.localDocs.get(key),
    (d) => dataLayer.localDocs.save(d as LocalDoc),
    options.overwriteExisting,
  )
}

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
    (key) => dataLayer.sentimentCache.get(key),
    (c) => dataLayer.sentimentCache.save(c as SentimentCache),
    options.overwriteExisting,
  )
}

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
    (key) => dataLayer.news.get(key),
    (n) => dataLayer.news.save(n as NewsArticle),
    options.overwriteExisting,
  )
}

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
      dataLayer.newsStockMap
        .listBySymbol(key.split('_')[0] ?? '')
        .then((list) => list.find((x) => x.id === key)),
    (m) => dataLayer.newsStockMap.save(m as NewsStockMap),
    options.overwriteExisting,
  )
}
