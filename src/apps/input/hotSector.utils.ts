import type { HotSector } from '@/services/input/hotSectorService'
import type { RankedSector } from './hotSector.types'
import { DYNAMIC_SCORE_WEIGHTS, MOMENTUM_WEIGHTS } from './hotSector.config'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/**
 * 动态权重排序：综合原始评分(60%) + 资金热度(30%) + 动量强度(10%)
 *
 * - 资金权重：资金因子(fundFlow) 与 动量因子(momentum) 的加权均值
 * - 动量权重：情绪因子(sentiment) 60% + 估值因子(valuation) 40%
 *
 * @param sectors 原始板块列表
 * @returns 按 dynamicScore 降序排列的板块列表
 */
export function rankSectorsByDynamicScore(sectors: HotSector[]): RankedSector[] {
  const ranked = sectors.map((sector) => {
    // 资金权重：资金因子(fundFlow) 与 动量因子(momentum) 的加权均值
    const capitalWeight = (sector.factors.fundFlow + sector.factors.momentum) / 2
    // 动量权重：情绪因子(sentiment) 与 估值因子(valuation) 的加权
    const momentumWeight =
      sector.factors.sentiment * MOMENTUM_WEIGHTS.sentiment +
      sector.factors.valuation * MOMENTUM_WEIGHTS.valuation
    // 动态综合评分
    const dynamicScore =
      sector.score * DYNAMIC_SCORE_WEIGHTS.original +
      capitalWeight * DYNAMIC_SCORE_WEIGHTS.capital +
      momentumWeight * DYNAMIC_SCORE_WEIGHTS.momentum

    logger.info('[HotSectorSection][动态权重]', {
      sectorCode: sector.code,
      sectorName: sector.name,
      originalScore: sector.score,
      capitalWeight: capitalWeight.toFixed(2),
      momentumWeight: momentumWeight.toFixed(2),
      dynamicScore: dynamicScore.toFixed(2),
    })

    return { ...sector, dynamicScore }
  })

  return ranked.sort((a, b) => b.dynamicScore - a.dynamicScore)
}
