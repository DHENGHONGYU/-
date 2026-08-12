/**
 * AnalysisResult 数据生命周期管理器
 *
 * P2-3 / P2-6：analysisResults 的自动归档、压缩与清理。
 *
 * 策略：
 * - 90 天（TTL_SOFT）→ 压缩：移除 rawLlmText、external.topArticles 详细内容，保留结论和报告章节
 * - 180 天（TTL_HARD）→ 删除：彻底移除已压缩的归档记录
 * - 存储统计：实时监测 analysisResults store 的条目数和估算大小
 *
 * 触发方式：
 * 1. analysisOrchestrator.persistResult() 每次保存后触发轻量检查
 * 2. 系统启动时由 bootstrap 执行一次完整扫描
 * 3. 手动触发：用户可在设置页执行"清理旧数据"
  * @doc [V9-DOC-PROJ-124, V9-DOC-BACK-004, V9-DOC-BACK-012, V9-DOC-PROJ-113, V9-DOC-PROD-001]
*/

import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { ENVELOPE_ACTION, STORE_NAME, MODULE_ID } from '@/config/dbConfig'
import { getLogger } from '@/lib/logger'
import type { AnalysisResult } from '@/types/modules/analysisOrchestrator.types'

const logger = getLogger()

/** 默认生命周期阈值（天） */
export const TTL_SOFT_DAYS = 90
/**
 * TTL_HARD_DAYS
 */
export const TTL_HARD_DAYS = 180

/** 生命周期操作统计 */
export interface LifecycleStats {
  scanned: number
  compressed: number
  deleted: number
  skipped: number
  bytesReclaimed: number
  durationMs: number
}

/** 存储使用统计 */
export interface StorageStats {
  totalCount: number
  archivedCount: number
  compressedCount: number
  avgSizeBytes: number
  estimatedTotalBytes: number
  oldestRecordAt: number | null
  newestRecordAt: number | null
}

/**
 * 估算 AnalysisResult 的序列化大小（JSON 字符串近似字节数）。
 * 用于评估存储占用和回收量。
 */
function estimateSize(result: AnalysisResult): number {
  try {
    return new Blob([JSON.stringify(result)]).size
  } catch (err) { console.warn('[analysisResultLifecycle.ts]', err);
    return 0
  }
}

/**
 * 压缩 AnalysisResult：移除大字段，保留核心结论。
 *
 * 移除字段：
 * - rawLlmText（原始 LLM 输出，通常最大）
 * - external.topArticles 详细内容（保留 3 条摘要）
 *
 * 保留字段：
 * - conclusion、reportSections、factorExecution、tokenUsage、lineage
 */
function compressResult(result: AnalysisResult): AnalysisResult {
  const compressed: AnalysisResult = {
    ...result,
    rawLlmText: '[已压缩]',
    external: {
      ...result.external,
      topArticles: result.external.topArticles.slice(0, 3).map((a) => ({
        title: a.title,
        summary: a.summary.slice(0, 200),
        sentiment: a.sentiment,
      })),
      articleCount: result.external.articleCount,
    },
    compressed: true,
    archived: true,
    archivedAt: Date.now(),
  }
  return compressed
}

/**
 * 深度压缩（墓碑化）AnalysisResult：保留最小元数据，移除所有大字段。
 */
function tombstoneResult(result: AnalysisResult): AnalysisResult {
  return {
    docId: result.docId,
    symbol: result.symbol,
    version: result.version,
    createdAt: result.createdAt,
    external: {
      symbol: result.symbol,
      articleCount: 0,
      topArticles: [],
      fetchedAt: 0,
    },
    internal: {
      symbol: result.symbol,
      stockName: undefined,
      v6Score: undefined,
      v6Rating: undefined,
      fetchedAt: 0,
    },
    conclusion: undefined,
    rawLlmText: '[已删除]',
    factorExecution: [],
    reasonableness: {
      passed: false,
      threshold: 0,
      completeness: 0,
      missingLayers: [],
      notes: '[已删除]',
    },
    feedbackLoop: { triggered: false, issueCount: 0, message: '[已删除]' },
    model: '',
    archived: true,
    compressed: true,
    archivedAt: Date.now(),
  }
}

/**
 * 扫描并归档过期分析结果。
 *
 * @param thresholdDays 软归档阈值（默认 90 天）
 * @param dryRun 仅统计不执行（默认 false）
 * @returns 操作统计
 */
export async function archiveOldResults(
  thresholdDays = TTL_SOFT_DAYS,
  dryRun = false,
): Promise<LifecycleStats> {
  const stats: LifecycleStats = {
    scanned: 0,
    compressed: 0,
    deleted: 0,
    skipped: 0,
    bytesReclaimed: 0,
    durationMs: 0,
  }
  const start = performance.now()
  const cutoff = Date.now() - thresholdDays * 24 * 60 * 60 * 1000

  logger.info(`[Lifecycle] 开始归档扫描，阈值=${thresholdDays}天，dryRun=${dryRun}`)

  try {
    const result = await dataBridge.query<AnalysisResult[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.analysisResults,
      source: MODULE_ID.analyzer,
    })

    if (!result.success || !result.data) {
      logger.warn('[Lifecycle] 无法读取 analysisResults')
      return stats
    }

    const allResults = result.data
    stats.scanned = allResults.length

    for (const item of allResults) {
      // 已归档或已压缩的跳过
      if ((item.archived ?? false) === true || (item.compressed ?? false) === true) {
        stats.skipped++
        continue
      }

      if (item.createdAt < cutoff) {
        const beforeSize = estimateSize(item)
        const compressed = compressResult(item)
        const afterSize = estimateSize(compressed)
        stats.bytesReclaimed += Math.max(0, beforeSize - afterSize)
        stats.compressed++

        if (!dryRun) {
          const envelope = EnvelopeFactory.create(
            {
              source: MODULE_ID.analyzer,
              target: 'db' as const,
              action: ENVELOPE_ACTION.saveAnalysisResult,
              traceId: `lifecycle-archive-${item.docId}`,
            },
            compressed,
          )
          await dataBridge.forward(envelope)
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[Lifecycle] 归档扫描失败', { error: msg })
  }

  stats.durationMs = Math.round(performance.now() - start)
  logger.info('[Lifecycle] 归档扫描完成', { ...stats })
  return stats
}

/**
 * 清理已归档的过期分析结果（深度压缩/墓碑化）。
 *
 * 180 天以上的已归档记录将被替换为最小墓碑对象，释放 IndexedDB 空间。
 * 真正物理删除需通过数据库维护工具手动执行。
 *
 * @param thresholdDays 硬删除阈值（默认 180 天）
 * @param dryRun 仅统计不执行（默认 false）
 * @returns 操作统计
 */
export async function cleanupOldArchives(
  thresholdDays = TTL_HARD_DAYS,
  dryRun = false,
): Promise<LifecycleStats> {
  const stats: LifecycleStats = {
    scanned: 0,
    compressed: 0,
    deleted: 0,
    skipped: 0,
    bytesReclaimed: 0,
    durationMs: 0,
  }
  const start = performance.now()
  const cutoff = Date.now() - thresholdDays * 24 * 60 * 60 * 1000

  logger.info(`[Lifecycle] 开始深度压缩扫描，阈值=${thresholdDays}天，dryRun=${dryRun}`)

  try {
    const result = await dataBridge.query<AnalysisResult[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.analysisResults,
      source: MODULE_ID.analyzer,
    })

    if (!result.success || !result.data) {
      logger.warn('[Lifecycle] 无法读取 analysisResults')
      return stats
    }

    const allResults = result.data
    stats.scanned = allResults.length

    for (const item of allResults) {
      // 只处理已归档/已压缩且超过硬阈值的数据
      if ((item.archived ?? false) === true && (item.archivedAt ?? 0) < cutoff) {
        const beforeSize = estimateSize(item)
        const tombstone = tombstoneResult(item)
        const afterSize = estimateSize(tombstone)
        stats.bytesReclaimed += Math.max(0, beforeSize - afterSize)
        stats.deleted++

        if (!dryRun) {
          const envelope = EnvelopeFactory.create(
            {
              source: MODULE_ID.analyzer,
              target: 'db' as const,
              action: ENVELOPE_ACTION.saveAnalysisResult,
              traceId: `lifecycle-tombstone-${item.docId}`,
            },
            tombstone,
          )
          await dataBridge.forward(envelope)
        }
      } else {
        stats.skipped++
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[Lifecycle] 深度压缩扫描失败', { error: msg })
  }

  stats.durationMs = Math.round(performance.now() - start)
  logger.info('[Lifecycle] 深度压缩扫描完成', { ...stats })
  return stats
}

/**
 * 获取 analysisResults 存储统计。
 */
export async function getStorageStats(): Promise<StorageStats> {
  const stats: StorageStats = {
    totalCount: 0,
    archivedCount: 0,
    compressedCount: 0,
    avgSizeBytes: 0,
    estimatedTotalBytes: 0,
    oldestRecordAt: null,
    newestRecordAt: null,
  }

  try {
    const result = await dataBridge.query<AnalysisResult[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.analysisResults,
      source: MODULE_ID.analyzer,
    })

    if (!result.success || !result.data || result.data.length === 0) {
      return stats
    }

    const items = result.data
    stats.totalCount = items.length
    let totalBytes = 0

    for (const item of items) {
      const size = estimateSize(item)
      totalBytes += size
      if ((item.archived ?? false) === true) stats.archivedCount++
      if ((item.compressed ?? false) === true) stats.compressedCount++

      if (stats.oldestRecordAt === null || item.createdAt < stats.oldestRecordAt) {
        stats.oldestRecordAt = item.createdAt
      }
      if (stats.newestRecordAt === null || item.createdAt > stats.newestRecordAt) {
        stats.newestRecordAt = item.createdAt
      }
    }

    stats.avgSizeBytes = Math.round(totalBytes / items.length)
    stats.estimatedTotalBytes = totalBytes
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[Lifecycle] 存储统计失败', { error: msg })
  }

  return stats
}

/**
 * 轻量级归档检查：仅扫描最近 N 条记录。
 * 适合在 persistResult 后触发，避免每次全量扫描。
 *
 * @param lookBackCount 最近检查条数（默认 20）
 */
export async function lightArchiveCheck(lookBackCount = 20): Promise<LifecycleStats> {
  const stats: LifecycleStats = {
    scanned: 0,
    compressed: 0,
    deleted: 0,
    skipped: 0,
    bytesReclaimed: 0,
    durationMs: 0,
  }
  const start = performance.now()
  const cutoff = Date.now() - TTL_SOFT_DAYS * 24 * 60 * 60 * 1000

  try {
    const result = await dataBridge.query<AnalysisResult[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.analysisResults,
      source: MODULE_ID.analyzer,
    })

    if (!result.success || !result.data) return stats

    // 按 createdAt 降序，取最近 lookBackCount 条中的最旧的
    const sorted = result.data.sort((a, b) => b.createdAt - a.createdAt)
    const candidates = sorted.slice(0, lookBackCount).filter(
      (item) => (item.archived ?? false) !== true && (item.compressed ?? false) !== true && item.createdAt < cutoff,
    )

    stats.scanned = candidates.length

    for (const item of candidates) {
      const beforeSize = estimateSize(item)
      const compressed = compressResult(item)
      const afterSize = estimateSize(compressed)
      stats.bytesReclaimed += Math.max(0, beforeSize - afterSize)
      stats.compressed++

      const envelope = EnvelopeFactory.create(
        {
          source: MODULE_ID.analyzer,
          target: 'db' as const,
          action: ENVELOPE_ACTION.saveAnalysisResult,
          traceId: `lifecycle-light-${item.docId}`,
        },
        compressed,
      )
      await dataBridge.forward(envelope)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[Lifecycle] 轻量归档检查失败', { error: msg })
  }

  stats.durationMs = Math.round(performance.now() - start)
  return stats
}
