/**
 * embeddingMigration — 向量维度迁移工具
 *
 * 用途：将 LocalDoc.embedding 从旧维度（如 384d）迁移到新维度（如 768d）。
 *
 * 调用方式：
 *   1. Electron DevTools Console:
 *      const { rebuildAllEmbeddings } = await import('/src/services/system/embeddingMigration.ts')
 *      await rebuildAllEmbeddings()
 *
 *   2. 代码中导入:
 *      import { rebuildAllEmbeddings } from '@/services/system/embeddingMigration'
 *      await rebuildAllEmbeddings({ onProgress: (done, total) => console.log(`${done}/${total}`) })
 *
 * 特性：
 *   - 幂等：自动跳过已是目标维度的文档
 *   - 批量：调用后端 /api/embed/batch（batch_size=32），比逐条快 10x+
 *   - 降级：后端不可用时自动降级到前端 ONNX 逐条推理
 *   - 重试：单批失败自动重试 3 次
 *   - 进度回调：支持 onProgress 回调实时报告进度
 *
 * @doc [V9-DOC-BACK-012, P0-embedding-upgrade]
 */

import { STORE_NAME, ENVELOPE_ACTION, ENVELOPE_TARGET, MODULE_ID } from '@/config/dbConfig'
import type { LocalDoc } from '@/data/types'
import { queryList } from '@/data/dataLayerHelpers'
import { dataBridge } from '@/core/databridge'
import { EnvelopeFactory } from '@/core/envelope'
import { getLogger } from '@/lib/logger'
import { embedText } from '@/services/system/localEmbeddingService'
import { nanoid } from 'nanoid'

const logger = getLogger()

// ============================================================
// 配置
// ============================================================

/** 目标向量维度（bge-base-zh-v1.5 = 768） */
const TARGET_DIMENSION = 768

/** 批量推理大小（与后端 embedding_daemon.py batch_size=32 对齐） */
const BATCH_SIZE = 32

/** 单批最大重试次数（网络中断场景需足够大） */
const MAX_RETRIES = 5

/** 后端 Embedding Service 地址（从 apiPaths 集中管理） */
import { EMBEDDING_SERVICE_URL } from '@/config/apiPaths'

// ============================================================
// 类型
// ============================================================

export interface MigrationOptions {
  /** 进度回调（done, total, currentDocName） */
  onProgress?: (done: number, total: number, currentName?: string) => void
  /** 自定义目标维度（默认 768） */
  targetDimension?: number
  /** 自定义批量大小（默认 32） */
  batchSize?: number
  /** 是否强制重新生成所有文档（忽略维度检查） */
  force?: boolean
}

export interface MigrationResult {
  /** 总文档数 */
  total: number
  /** 已跳过（维度已正确） */
  skipped: number
  /** 成功迁移 */
  migrated: number
  /** 失败 */
  failed: number
  /** 失败文档详情 */
  failures: { id: string; name: string; error: string }[]
  /** 总耗时（ms） */
  elapsedMs: number
}

// ============================================================
// 核心：保存文档到 IndexedDB（复用 DataBridge 通道）
// ============================================================

async function saveDocViaBridge(doc: LocalDoc): Promise<void> {
  const envelope = EnvelopeFactory.create(
    {
      source: MODULE_ID.system,
      target: ENVELOPE_TARGET.db,
      action: ENVELOPE_ACTION.saveLocalDocs,
      traceId: `migrate-${nanoid(8)}-${doc.id}`,
    },
    doc,
  )
  await dataBridge.forward(envelope)
}

// ============================================================
// 核心：后端批量嵌入
// ============================================================

async function embedBatchViaBackend(texts: string[]): Promise<number[][] | null> {
  try {
    const resp = await fetch(`${EMBEDDING_SERVICE_URL}/api/embed/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(texts),
      signal: AbortSignal.timeout(60_000),
    })
    if (!resp.ok) {
      logger.warn('[Migration] Backend batch API returned non-200', { status: resp.status })
      return null
    }
    const json: unknown = await resp.json()
    const data: Record<string, unknown> =
      typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {}
    const vectors: unknown = data.vectors
    if (!Array.isArray(vectors) || vectors.length !== texts.length) {
      logger.warn('[Migration] Backend batch returned mismatched count', {
        expected: texts.length,
        got: Array.isArray(vectors) ? vectors.length : undefined,
      })
      return null
    }
    return vectors as number[][]
  } catch (err) {
    logger.warn('[Migration] Backend batch API failed', { error: err })
    return null
  }
}

// ============================================================
// 降级：前端 ONNX 逐条嵌入
// ============================================================

async function embedViaFrontend(texts: string[]): Promise<number[][] | null> {
  const results: number[][] = []
  for (const text of texts) {
    const r = await embedText(text)
    if (r.success) {
      results.push(r.vector)
    } else {
      logger.warn('[Migration] Frontend embedding failed for text', { error: r.error })
      return null
    }
  }
  return results
}

// ============================================================
// 辅助：后端健康检查
// ============================================================

/**
 * 检查后端 Embedding Service 是否就绪（model_loaded=true）
 *
 * 用于重试前判断是否值得发请求，避免浪费重试次数。
 * 网络中断期间 health 会返回 unreachable，跳过盲重试。
 */
async function checkBackendHealth(): Promise<boolean> {
  try {
    const resp = await fetch(`${EMBEDDING_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(3_000),
    })
    if (!resp.ok) return false
    const json: unknown = await resp.json()
    return typeof json === 'object' && json !== null
      ? (json as Record<string, unknown>).model_loaded === true
      : false
  } catch {
    return false
  }
}

// ============================================================
// 核心：带重试的批量嵌入（指数退避 + 健康检查 + 逐条兜底）
// ============================================================

/**
 * 指数退避延迟计算
 *
 * attempt 1 → 2s, attempt 2 → 4s, attempt 3 → 8s, attempt 4 → 16s
 * 总重试窗口: 2+4+8+16 = 30s（覆盖典型网络恢复时间）
 */
function getRetryDelay(attempt: number): number {
  return Math.pow(2, attempt) * 1000 // 2s, 4s, 8s, 16s
}

async function embedBatchWithRetry(texts: string[]): Promise<number[][] | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // 1. 重试前先检查后端健康状态（首次跳过，直接尝试）
    if (attempt > 1) {
      const healthy = await checkBackendHealth()
      if (!healthy) {
        logger.info(`[Migration] Backend not ready before attempt ${attempt}, waiting...`)
        const delay = getRetryDelay(attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue // 跳过本次尝试，直接进入下一轮循环
      }
    }

    // 2. 尝试后端批量推理
    const vectors = await embedBatchViaBackend(texts)
    if (vectors) return vectors

    // 3. 后端失败 → 判断是否需要重试
    if (attempt < MAX_RETRIES) {
      const delay = getRetryDelay(attempt)
      logger.info(`[Migration] Batch failed, retry ${attempt + 1}/${MAX_RETRIES} in ${delay / 1000}s`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // 4. 后端彻底不可用 → 降级到前端 ONNX 逐条推理
  logger.info('[Migration] Backend exhausted, falling back to frontend ONNX embedding')
  const frontendVectors = await embedViaFrontend(texts)
  if (frontendVectors) return frontendVectors

  return null
}

// ============================================================
// 主函数：rebuildAllEmbeddings
// ============================================================

/**
 * 重建所有 LocalDoc 的嵌入向量
 *
 * 将所有 embedding 维度不等于 targetDimension 的文档重新生成向量。
 *
 * @param options 迁移选项
 * @returns 迁移结果统计
 *
 * @example
 * ```typescript
 * const result = await rebuildAllEmbeddings({
 *   onProgress: (done, total, name) => console.log(`[${done}/${total}] ${name}`)
 * })
 * console.log(`迁移完成: ${result.migrated} 篇成功, ${result.failed} 篇失败, 耗时 ${result.elapsedMs}ms`)
 * ```
 */
export async function rebuildAllEmbeddings(
  options: MigrationOptions = {},
): Promise<MigrationResult> {
  const targetDim = options.targetDimension ?? TARGET_DIMENSION
  const batchSize = options.batchSize ?? BATCH_SIZE
  const force = options.force ?? false
  const onProgress = options.onProgress

  const startTime = performance.now()
  logger.info('[Migration] Starting embedding migration', { targetDim, batchSize, force })

  // 1. 读取所有文档
  const allDocs = await queryList<LocalDoc>(STORE_NAME.localDocs)
  logger.info('[Migration] Total docs found', { count: allDocs.length })

  // 2. 过滤需要迁移的文档
  const toMigrate = force
    ? allDocs
    : allDocs.filter(d => d.embedding?.length !== targetDim)

  const skipped = allDocs.length - toMigrate.length
  logger.info('[Migration] Docs to migrate', {
    total: allDocs.length,
    toMigrate: toMigrate.length,
    skipped,
  })

  if (toMigrate.length === 0) {
    logger.info('[Migration] All docs already at target dimension, nothing to do')
    return {
      total: allDocs.length,
      skipped: allDocs.length,
      migrated: 0,
      failed: 0,
      failures: [],
      elapsedMs: Math.round(performance.now() - startTime),
    }
  }

  // 3. 分批处理
  let migrated = 0
  const failures: { id: string; name: string; error: string }[] = []
  let done = 0

  for (let i = 0; i < toMigrate.length; i += batchSize) {
    const batch = toMigrate.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(toMigrate.length / batchSize)
    logger.info(`[Migration] Batch ${batchNum}/${totalBatches} (${batch.length} docs)`)

    // 3a. 批量嵌入
    const texts = batch.map(d => d.content || '')
    const vectors = await embedBatchWithRetry(texts)

    if (!vectors) {
      // 整批失败 → 逐条兜底：尝试用前端 ONNX 逐条挽救
      logger.warn(`[Migration] Batch ${batchNum} fully failed, trying per-doc fallback`)
      for (const doc of batch) {
        try {
          const r = await embedText(doc.content || '')
          if (r.success && r.vector.length === targetDim) {
            doc.embedding = r.vector
            await saveDocViaBridge(doc)
            migrated++
            logger.info(`[Migration] Per-doc fallback saved: ${doc.name}`)
          } else {
            failures.push({
              id: doc.id,
              name: doc.name,
              error: `All retries exhausted, frontend fallback also failed`,
            })
          }
        } catch (err) {
          failures.push({
            id: doc.id,
            name: doc.name,
            error: err instanceof Error ? err.message : String(err),
          })
        }
        done++
        onProgress?.(done, toMigrate.length, doc.name)
      }
      continue
    }

    // 3b. 逐条写回 IndexedDB
    for (let j = 0; j < batch.length; j++) {
      const doc = batch[j]
      const vector = vectors[j]

      if (!doc || vector?.length !== targetDim) {
        if (doc) {
          failures.push({
            id: doc.id,
            name: doc.name,
            error: `Dimension mismatch: expected ${targetDim}, got ${vector?.length}`,
          })
        }
        done++
        onProgress?.(done, toMigrate.length, doc?.name)
        continue
      }

      try {
        doc.embedding = vector
        await saveDocViaBridge(doc)
        migrated++
      } catch (err) {
        failures.push({
          id: doc.id,
          name: doc.name,
          error: err instanceof Error ? err.message : String(err),
        })
      }

      done++
      onProgress?.(done, toMigrate.length, doc.name)
    }

    // 批间短暂休息，避免阻塞 UI 线程
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  const elapsedMs = Math.round(performance.now() - startTime)
  const failed = failures.length

  logger.info('[Migration] Completed', {
    total: allDocs.length,
    migrated,
    skipped,
    failed,
    elapsedMs,
  })

  return {
    total: allDocs.length,
    skipped,
    migrated,
    failed,
    failures,
    elapsedMs,
  }
}

// ============================================================
// 辅助：检查迁移状态（不执行迁移，仅统计）
// ============================================================

/**
 * 检查当前向量维度分布（不执行迁移）
 *
 * @returns 各维度的文档数量统计
 */
export async function checkEmbeddingDimensions(): Promise<{
  total: number
  byDimension: Record<number, number>
  noEmbedding: number
  needsMigration: number
  targetDimension: number
}> {
  const allDocs = await queryList<LocalDoc>(STORE_NAME.localDocs)
  const byDimension: Record<number, number> = {}
  let noEmbedding = 0

  for (const doc of allDocs) {
    if (!doc.embedding || doc.embedding.length === 0) {
      noEmbedding++
    } else {
      const dim = doc.embedding.length
      byDimension[dim] = (byDimension[dim] ?? 0) + 1
    }
  }

  const needsMigration = allDocs.filter(
    d => d.embedding?.length !== TARGET_DIMENSION,
  ).length

  return {
    total: allDocs.length,
    byDimension,
    noEmbedding,
    needsMigration,
    targetDimension: TARGET_DIMENSION,
  }
}
