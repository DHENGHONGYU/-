/**
 * @fileoverview 候选池批量采集服务
 *
 * 对研究候选池（research pool）内的指定标的，按当前七维配置启用的维度
 * 执行并发批量采集。配置复用 SevenDimConfigStore，标的由调用方传入，
 * 避免与原「意向池采集」入口耦合。
 *
 * @module services/pool/collectionService
 */

import { runBatchTrace } from '@/services/data-collector/collectionPipeline'
import { getLogger } from '@/lib/logger'
import type { CollectionConfig } from '@/types/modules/collection.types'

const logger = getLogger()

export interface PoolCollectionResult {
  /** 实际执行采集的维度数 */
  totalDimensions: number
  /** 失败的维度数 */
  failedDimensions: number
}

/**
 * 对指定股票列表执行当前已启用的七维度批量采集。
 *
 * @param symbols 待采集标的代码列表
 * @param config 采集配置（通常复用七维配置页中的配置）
 * @returns 采集结果摘要
 * @throws 当没有启用任何维度，或所有维度均失败时抛出
 */
export async function collectPoolSymbols(
  symbols: string[],
  config: CollectionConfig,
): Promise<PoolCollectionResult> {
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
  })

  const results = await Promise.allSettled(
    enabledDims.map((dim) =>
      runBatchTrace({ symbols, dimensionCode: dim.code, config, parentTaskId }),
    ),
  )

  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')

  if (failures.length > 0) {
    const messages = failures
      .map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason)))
      .join('; ')
    logger.error('[collectionService] 部分维度采集失败', { failures: failures.length, errors: messages })
    throw new Error(`部分维度采集失败：${messages}`)
  }

  logger.info('[collectionService] 批量采集完成', { parentTaskId })

  return {
    totalDimensions: enabledDims.length,
    failedDimensions: 0,
  }
}
