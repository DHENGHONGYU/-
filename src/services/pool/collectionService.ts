/**
 * @fileoverview 候选池批量采集服务
 *
 * 对研究候选池（research pool）内的指定标的，按当前七维配置启用的维度
 * 执行并发批量采集。配置复用 SevenDimConfigStore，标的由调用方传入，
 * 避免与原「意向池采集」入口耦合。
 *
 * 采集完成后自动触发资料同步：
 *   - Electron 环境：写入 outputs/collected-data/{batch}/ 本地文件夹
 *   - 浏览器环境：打包为 .bundle.json 触发下载
 *
 * @module services/pool/collectionService
 */

import { runBatchTrace, type TraceResult } from '@/services/data-collector/collectionPipeline'
import {
  syncCollectedDataToLocal,
  extractEnabledDimensionCodes,
} from '@/services/data-collector/collectedDataSyncService'
import { getLogger } from '@/lib/logger'
import type { CollectionConfig } from '@/types/modules/collection.types'

const logger = getLogger()

export interface PoolCollectionResult {
  /** 实际执行采集的维度数 */
  totalDimensions: number
  /** 失败的维度数 */
  failedDimensions: number
  /** 资料同步结果（采集完成后异步触发，此处记录启动状态） */
  sync?: {
    triggered: boolean
    parentTaskId: string
    error?: string
  }
}

/**
 * 对指定股票列表执行当前已启用的七维度批量采集。
 *
 * @param symbols 待采集标的代码列表
 * @param config 采集配置（通常复用七维配置页中的配置）
 * @param options.autoSync 采集完成后是否自动同步到本地（默认 true）
 * @returns 采集结果摘要
 * @throws 当没有启用任何维度，或所有维度均失败时抛出
 */
export async function collectPoolSymbols(
  symbols: string[],
  config: CollectionConfig,
  options: { autoSync?: boolean } = {},
): Promise<PoolCollectionResult> {
  const { autoSync = true } = options

  if (symbols.length === 0) {
    return { totalDimensions: 0, failedDimensions: 0 }
  }

  const enabledDims = config.dimensions.filter((d) => d.enabled && d.code.length > 0)

  if (enabledDims.length === 0) {
    throw new Error('没有可用的采集维度，请先到「七维配置」页面启用至少一个维度并配置数据源')
  }

  const parentTaskId = `pool-collect-${Date.now()}`
  logger.info('[collectionService] 开始批量采集研究池', {
    symbolCount: symbols.length,
    dimensionCount: enabledDims.length,
    parentTaskId,
    autoSync,
  })

  const results = await Promise.allSettled(
    enabledDims.map((dim) =>
      runBatchTrace({ symbols, dimensionCode: dim.code, config, parentTaskId }),
    ),
  )

  // 汇总所有 TraceResult（供同步服务使用）
  const allTraces: TraceResult[] = []
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      allTraces.push(...r.value)
    }
  }

  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')

  if (failures.length > 0) {
    const messages = failures
      .map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason)))
      .join('; ')
    logger.error('[collectionService] 部分维度采集失败', { failures: failures.length, errors: messages })

    // 即使部分失败，仍尝试同步已成功的数据（最佳努力）
    if (autoSync && allTraces.length > 0) {
      void kickoffSync(symbols, config, allTraces, parentTaskId)
    }

    throw new Error(`部分维度采集失败：${messages}`)
  }

  logger.info('[collectionService] 批量采集完成', {
    parentTaskId,
    traceCount: allTraces.length,
  })

  // 采集成功 → 异步触发资料同步（不阻塞主流程，同步失败仅记录日志）
  let syncResult: PoolCollectionResult['sync'] | undefined
  if (autoSync) {
    syncResult = { triggered: true, parentTaskId }
    try {
      kickoffSync(symbols, config, allTraces, parentTaskId).catch((err) => {
        logger.warn('[collectionService] 资料同步启动失败（非阻塞）', {
          parentTaskId,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    } catch (err) {
      syncResult.error = err instanceof Error ? err.message : String(err)
      logger.warn('[collectionService] 资料同步立即失败（非阻塞）', {
        parentTaskId,
        error: syncResult.error,
      })
    }
  }

  return {
    totalDimensions: enabledDims.length,
    failedDimensions: 0,
    sync: syncResult,
  }
}

/**
 * 异步触发资料同步。
 * 独立函数便于被捕获异常、统一日志，避免污染 collectPoolSymbols 的返回路径。
 */
async function kickoffSync(
  symbols: string[],
  config: CollectionConfig,
  traces: TraceResult[],
  parentTaskId: string,
): Promise<void> {
  const dimCodes = extractEnabledDimensionCodes(config)
  logger.info('[collectionService] 触发采集资料本地同步', {
    parentTaskId,
    symbolCount: symbols.length,
    dimensionCount: dimCodes.length,
    traceCount: traces.length,
  })
  const result = await syncCollectedDataToLocal(symbols, dimCodes, traces, {
    parentTaskId,
    configSnapshot: config,
  })
  if (result.success) {
    logger.info('[collectionService] 资料同步完成', {
      parentTaskId,
      fileCount: result.fileCount,
      symbolCount: result.symbolCount,
      batchDir: result.batchDir,
    })
  } else {
    logger.warn('[collectionService] 资料同步失败', {
      parentTaskId,
      error: result.error,
    })
  }
}
