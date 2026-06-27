import {
  getDefaultDualStrategyRuleConfig,
  type DualStrategyRuleConfig,
} from '@/config/dualStrategyRules'
import type { DataLayerResult, DualStrategyResult, Stock } from '@/data/types'
import { getLogger } from '@/lib/logger'
import { analyzeHotSectors } from './hotSectorAnalyzer'
import { detectRotationSignals } from './rotationSignalDetector'
import { analyzeValuePits } from './valuePitAnalyzer'

const logger = getLogger()

export interface RunDualStrategyOptions {
  ruleConfig?: DualStrategyRuleConfig
  persistScores?: boolean
}

/**
 * 双策略编排引擎。
 *
 * 对输入股票池同时执行：
 * 1. 热门板块策略评分（HotSectorAnalyzer）
 * 2. 价值洼地策略评分（ValuePitAnalyzer）
 * 3. 价值洼地轮动信号检测（RotationSignalDetector）
 *
 * 返回结构化的 DualStrategyResult，供驾驶舱 Widget 与交易执行层消费。
 */
export async function runDualStrategy(
  stocks: Stock[],
  options: RunDualStrategyOptions = {},
): Promise<DataLayerResult<DualStrategyResult>> {
  const ruleConfig = options.ruleConfig ?? getDefaultDualStrategyRuleConfig()
  const persistScores = options.persistScores ?? true

  if (stocks.length === 0) {
    return {
      success: true,
      data: {
        hotSectorScores: [],
        valuePitScores: [],
        signals: [],
        watchlistCandidates: [],
        summary: {
          total: 0,
          hotSectorCount: 0,
          valuePitCount: 0,
          signalCount: 0,
          watchlistCount: 0,
        },
      },
    }
  }

  logger.info(`[dualStrategyEngine] 开始执行双策略，标的数 ${stocks.length}`)

  const [hotResult, valueResult] = await Promise.all([
    analyzeHotSectors(stocks, { ruleConfig, persist: persistScores }),
    analyzeValuePits(stocks, { ruleConfig, persist: persistScores }),
  ])

  if (!hotResult.success || hotResult.data === undefined) {
    return { success: false, error: hotResult.error ?? '热门板块评分未返回数据' }
  }
  if (!valueResult.success || valueResult.data === undefined) {
    return { success: false, error: valueResult.error ?? '价值洼地评分未返回数据' }
  }

  const hotSectorScores = hotResult.data
  const valuePitScores = valueResult.data

  const rotationResult = await detectRotationSignals(valuePitScores, { ruleConfig })
  if (!rotationResult.success || rotationResult.data === undefined) {
    return { success: false, error: rotationResult.error ?? '轮动信号检测未返回数据' }
  }

  const { signals, watchlistCandidates } = rotationResult.data

  const result: DualStrategyResult = {
    hotSectorScores,
    valuePitScores,
    signals,
    watchlistCandidates,
    summary: {
      total: stocks.length,
      hotSectorCount: hotSectorScores.length,
      valuePitCount: valuePitScores.length,
      signalCount: signals.length,
      watchlistCount: watchlistCandidates.length,
    },
  }

  logger.info(
    `[dualStrategyEngine] 完成：热门 ${result.summary.hotSectorCount} / 洼地 ${result.summary.valuePitCount} / 信号 ${result.summary.signalCount} / 观察 ${result.summary.watchlistCount}`,
  )
  return { success: true, data: result }
}
