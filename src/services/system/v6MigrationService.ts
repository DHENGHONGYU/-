import { getLogger } from '@/lib/logger'
import type { DataLayerResult } from '@/data/types'
import { parseV6Export, transformV6ToV9 } from './migration/migrationTransformers'
import { validateV6ExportTables, createMigrationTraceId } from './migration/migrationValidators'
import type { MigrationOptions, MigrationReport, V9ImportShape } from './migration/migrationTypes'
import {
  migrateStocks,
  migrateDailyQuotes,
  migrateV6Scores,
  migrateScoreDocs,
  migrateOrders,
  migrateSectorScores,
  migrateRotationScores,
  migrateStrategySnapshots,
  migrateLocalDocs,
  migrateSentimentCache,
  migrateNews,
  migrateNewsStockMaps,
} from './migration/storeMigrators'

const logger = getLogger()

/**
 * importToV9
 */
export async function importToV9(
  transformed: V9ImportShape,
  options: MigrationOptions = {},
): Promise<MigrationReport> {
  const start = Date.now()
  const details: MigrationReport['details'] = []
  const traceId = createMigrationTraceId()

  if (options.dryRun) {
    details.push({ store: 'stocks', total: transformed.stocks.length, success: 0, skipped: transformed.stocks.length, failed: 0 })
    details.push({ store: 'daily_quotes', total: transformed.dailyQuotes.length, success: 0, skipped: transformed.dailyQuotes.length, failed: 0 })
    details.push({ store: 'v6_scores', total: transformed.v6Scores.length, success: 0, skipped: transformed.v6Scores.length, failed: 0 })
    details.push({ store: 'score_docs', total: transformed.scoreDocs.length + transformed.scoreDocsFromScores.length, success: 0, skipped: transformed.scoreDocs.length + transformed.scoreDocsFromScores.length, failed: 0 })
    details.push({ store: 'orders', total: transformed.orders.length, success: 0, skipped: transformed.orders.length, failed: 0 })
    details.push({ store: 'sector_scores', total: transformed.sectorScores.length, success: 0, skipped: transformed.sectorScores.length, failed: 0 })
    details.push({ store: 'rotation_scores', total: transformed.rotationScores.length, success: 0, skipped: transformed.rotationScores.length, failed: 0 })
    details.push({ store: 'strategy_snapshots', total: transformed.strategySnapshots.length, success: 0, skipped: transformed.strategySnapshots.length, failed: 0 })
    details.push({ store: 'local_docs', total: transformed.localDocs.length, success: 0, skipped: transformed.localDocs.length, failed: 0 })
    details.push({ store: 'sentiment_cache', total: transformed.sentimentCache.length, success: 0, skipped: transformed.sentimentCache.length, failed: 0 })
    details.push({ store: 'news', total: transformed.news.length, success: 0, skipped: transformed.news.length, failed: 0 })
    details.push({ store: 'news_stock_map', total: transformed.newsStockMaps.length, success: 0, skipped: transformed.newsStockMaps.length, failed: 0 })
  } else {
    details.push(await migrateStocks(traceId, transformed, options))
    details.push(await migrateDailyQuotes(traceId, transformed, options))
    details.push(await migrateV6Scores(traceId, transformed, options))
    details.push(await migrateScoreDocs(traceId, transformed, options))
    details.push(await migrateOrders(traceId, transformed, options))
    details.push(await migrateSectorScores(traceId, transformed, options))
    details.push(await migrateRotationScores(traceId, transformed, options))
    details.push(await migrateStrategySnapshots(traceId, transformed, options))
    details.push(await migrateLocalDocs(traceId, transformed, options))
    details.push(await migrateSentimentCache(traceId, transformed, options))
    details.push(await migrateNews(traceId, transformed, options))
    details.push(await migrateNewsStockMaps(traceId, transformed, options))
  }

  const summary = details.reduce(
    (acc, cur) => ({
      totalStores: acc.totalStores + 1,
      importedRecords: acc.importedRecords + cur.success,
      skippedRecords: acc.skippedRecords + cur.skipped,
      failedRecords: acc.failedRecords + cur.failed,
    }),
    { totalStores: 0, importedRecords: 0, skippedRecords: 0, failedRecords: 0 },
  )

  return {
    success: summary.failedRecords === 0,
    durationMs: Date.now() - start,
    summary,
    details,
  }
}

/**
 * runV6Migration
 */
export async function runV6Migration(
  json: unknown,
  options: MigrationOptions = {},
): Promise<DataLayerResult<MigrationReport>> {
  try {
    const v6 = parseV6Export(json)
    validateV6ExportTables(v6)
    const transformed = transformV6ToV9(v6)
    const report = await importToV9(transformed, options)
    return { success: true, data: report }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('V6 迁移失败', { error: message })
    return { success: false, error: message }
  }
}

/**
 * generateMigrationReport
 * @param result
 * @returns string
 */
export function generateMigrationReport(result: MigrationReport): string {
  const lines: string[] = []
  lines.push(`迁移结果：${result.success ? '成功' : '部分失败'}`)
  lines.push(`耗时：${result.durationMs}ms`)
  lines.push(`总 store 数：${result.summary.totalStores}`)
  lines.push(`成功导入：${result.summary.importedRecords} 条`)
  lines.push(`跳过：${result.summary.skippedRecords} 条`)
  lines.push(`失败：${result.summary.failedRecords} 条`)
  lines.push('')
  for (const detail of result.details) {
    lines.push(`[${detail.store}] 总计 ${detail.total}，成功 ${detail.success}，跳过 ${detail.skipped}，失败 ${detail.failed}`)
    if (detail.errors && detail.errors.length > 0) for (const error of detail.errors.slice(0, 3)) lines.push(`  - ${error.id ?? `#${error.index}`}: ${error.error}`)
  }
  return lines.join('\n')
}

export * from './migration/migrationTypes'
export * from './migration/migrationTransformers'
export * from './migration/migrationValidators'
