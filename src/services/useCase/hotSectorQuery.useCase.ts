/**
 * @module services/useCase/hotSectorQuery.useCase
 * @description 热门板块查询执行用例
 *
 * 封装对 input/hotSectorService 的跨域调用，使 trading/strategy 等域
 * 可通过 UseCase 合法获取热门板块数据，避免 Service 之间的直接耦合。
 */

import { getLogger } from '@/lib/logger'
import { tryResult, type Result } from '@/services/contracts'
import { getHotSectors, type HotSector } from '@/services/fetcher/hotSectorService'

const logger = getLogger()

export interface HotSectorQueryInput {
  /** 返回的板块数量上限 */
  topN?: number
}

export interface HotSectorQueryResult {
  /** 热门板块列表（按 score 降序） */
  hotSectors: HotSector[]
}

/**
 * 热门板块查询执行用例
 *
 * @param input 查询参数
 * @returns Result<热门板块列表>；失败时 error 为收敛后的 V9Error
 */
export async function hotSectorQueryUseCase(
  input: HotSectorQueryInput = {},
): Promise<Result<HotSectorQueryResult>> {
  const topN = input.topN ?? 10

  logger.info('[hotSectorQueryUseCase] 开始查询热门板块', { topN })

  const result = await tryResult(
    async () => {
      const allSectors = getHotSectors()
      const sorted = allSectors.sort((a, b) => b.score - a.score)
      const hotSectors = sorted.slice(0, topN)

      logger.info('[hotSectorQueryUseCase] 查询完成', {
        totalCount: allSectors.length,
        returnedCount: hotSectors.length,
        topSectors: hotSectors.map((s) => ({ name: s.name, score: s.score })),
      })

      return { hotSectors }
    },
    { source: 'hotSectorQueryUseCase', operation: 'query', meta: { topN } },
  )

  if (!result.ok) {
    logger.error('[hotSectorQueryUseCase] 查询失败', {
      error: result.error.message,
      code: result.error.code,
    })
  }

  return result
}
