/**
 * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
 */
import { ENVELOPE_ACTION, ENVELOPE_TARGET } from '@/config/dbConfig'
import { EnvelopeFactory, type StandardEnvelope } from '@/core/envelope'
import { dataBridge } from '@/core/databridge'
import { generateId } from '@/lib/utils'
import { getLogger } from '@/lib/logger'
import type { V6ExportShape } from './migrationTypes'

const logger = getLogger()

/**
 * REQUIRED_V6_TABLES
 */
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

/**
 * createMigrationTraceId
 * @returns string
 */
export function createMigrationTraceId(): string {
  return `migration-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * validateV6ExportTables
 * @param v6
 * @returns void
 */
export function validateV6ExportTables(v6: V6ExportShape): void {
  const missing = REQUIRED_V6_TABLES.filter((table) => !(table in v6))
  if (missing.length > 0) {
    throw new Error(`V6 导出 JSON 缺少必需表：${missing.join(', ')}`)
  }
}

/**
 * writeMigrationAuditLog
 */
export async function writeMigrationAuditLog(params: {
  traceId: string
  store: string
  total: number
  success: number
  skipped: number
  failed: number
}): Promise<void> {
  const { traceId, store, total, success, skipped, failed } = params
  const envelope: StandardEnvelope = EnvelopeFactory.create(
    {
      source: 'system',
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.saveResearchLog,
      traceId,
    },
    {
      id: generateId(),
      traceId,
      timestamp: Date.now(),
      actor: 'system',
      action: 'V6_MIGRATION_STORE_IMPORT',
      targetType: store,
      targetCode: store,
      payload: JSON.stringify({ total, success, skipped, failed }),
    },
  )
  try {
    await dataBridge.forward(envelope)
  } catch (err) {
    logger.warn('迁移审计日志写入失败', { store, error: err instanceof Error ? err.message : String(err) })
  }
}
