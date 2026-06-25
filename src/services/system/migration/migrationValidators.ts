import { db, generateId } from '@/data/db'
import { getLogger } from '@/lib/logger'
import type { V6ExportShape } from './migrationTypes'

const logger = getLogger()

export const REQUIRED_V6_TABLES = [
  'stocks',
  'daily_quotes',
  'v6_scores',
  'orders',
  'sector_scores',
  'rotation_scores',
  'score_docs',
  'strategy_snapshots',
  'local_docs',
  'news',
  'news_stock_map',
  'sentiment_cache',
]

export function createMigrationTraceId(): string {
  return `migration-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function validateV6ExportTables(v6: V6ExportShape): void {
  const missing = REQUIRED_V6_TABLES.filter((table) => !(table in v6))
  if (missing.length > 0) {
    throw new Error(`V6 导出 JSON 缺少必需表：${missing.join(', ')}`)
  }
}

export async function writeMigrationAuditLog(params: {
  traceId: string
  store: string
  total: number
  success: number
  skipped: number
  failed: number
}): Promise<void> {
  const { traceId, store, total, success, skipped, failed } = params
  try {
    await db.put('research_logs', {
      id: generateId(),
      traceId,
      timestamp: Date.now(),
      actor: 'system',
      action: 'V6_MIGRATION_STORE_IMPORT',
      targetType: store,
      targetCode: store,
      payload: JSON.stringify({ total, success, skipped, failed }),
    })
  } catch (err) {
    logger.warn('迁移审计日志写入失败', { store, error: err instanceof Error ? err.message : String(err) })
  }
}
