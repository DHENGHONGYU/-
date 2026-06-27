import {
  getDefaultDualStrategyRuleConfig,
  type DualStrategyRuleConfig,
} from '@/config/dualStrategyRules'
import type { DataLayerResult, DualStrategyResult, Signal, Stock } from '@/data/types'
import { generateId } from '@/data/db'
import { getLogger } from '@/lib/logger'
import { analyzeHotSectors } from '@/services/scoring/hotSectorAnalyzer'
import { analyzeValuePits } from '@/services/scoring/valuePitAnalyzer'
import { detectBySector } from '@/services/scoring/rotationSignalDetector'

const logger = getLogger()

export interface RunDualStrategyOptions {
  ruleConfig?: DualStrategyRuleConfig
  persistScores?: boolean
}

/**
 * 双策略编排引擎（对齐后版本）。
 *
 * 对输入 symbol 列表同时执行：
 * 1. 热门板块策略评分（scoring/hotSectorAnalyzer）
 * 2. 价值洼地策略评分（scoring/valuePitAnalyzer）
 * 3. 价值洼地轮动信号检测（scoring/rotationSignalDetector）
 *
 * 返回结构化的 DualStrategyResult，供驾驶舱 Widget 与交易执行层消费。
 */
export async function runDualStrategy(
  stocks: Stock[],
  options: RunDualStrategyOptions = {},
): Promise<DataLayerResult<DualStrategyResult>> {
  const ruleConfig = options.ruleConfig ?? getDefaultDualStrategyRuleConfig()

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

  const [hotResult, pitResult] = await Promise.all([
    analyzeHotSectors(stocks, { ruleConfig }),
    analyzeValuePits(stocks, { ruleConfig }),
  ])

  const hotSectorScores = hotResult.data ?? []
  const valuePitScores = pitResult.data ?? []

  const signals: Signal[] = []
  const watchlistCandidates: Array<{ symbol: string; reason: string }> = []

  for (const score of valuePitScores) {
    if (score.action !== 'immediate' && score.action !== 'probe' && score.action !== 'wait') {
      continue
    }

    const rotation = await detectBySector(score.name)
    const isRotationTriggered = rotation?.triggered ?? false

    // 更新 score 的 rotationSignal 标志
    score.rotationSignal = isRotationTriggered

    if (isRotationTriggered && (score.action === 'probe' || score.action === 'wait')) {
      signals.push({
        id: generateId(),
        symbol: score.symbol,
        direction: 'buy',
        type: 'buy_rotation',
        confidence: Math.min(0.9, 0.5 + score.score / 10),
        rationale: `价值洼地轮动信号触发：板块 ${score.name} 成交量/资金/技术金叉条件满足`,
        snapshot: {
          priceToMA20: undefined,
          priceToMA60: undefined,
        },
        createdAt: Date.now(),
      })
    } else if (!isRotationTriggered && score.action === 'wait') {
      watchlistCandidates.push({
        symbol: score.symbol,
        reason: `板块 ${score.name} 轮动信号尚未触发`,
      })
    }
  }

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
