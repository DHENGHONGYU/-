/**
 * @module services/useCase/runDualStrategy.useCase
 * @description 双策略执行用例
 *
 * 将原先 trading/dualStrategyEngine 中的跨域编排逻辑抽取为独立 UseCase，
 * 使其可合法调用 scoring 域的 analyzer/detector，避免 Service 之间的直接耦合。
 */

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

export interface RunDualStrategyInput {
  stocks: Stock[]
  ruleConfig?: DualStrategyRuleConfig
  persistScores?: boolean
}

/** 旧版接口别名，保持兼容性 */
export type RunDualStrategyOptions = RunDualStrategyInput

/**
 * 双策略执行用例
 *
 * 对输入 symbol 列表同时执行：
 * 1. 热门板块策略评分（scoring/hotSectorAnalyzer）
 * 2. 价值洼地策略评分（scoring/valuePitAnalyzer）
 * 3. 价值洼地轮动信号检测（scoring/rotationSignalDetector）
 *
 * @returns DualStrategyResult 或错误信息
 */
export async function runDualStrategyUseCase(
  input: RunDualStrategyInput,
): Promise<DataLayerResult<DualStrategyResult>> {
  const ruleConfig = input.ruleConfig ?? getDefaultDualStrategyRuleConfig()
  const stocks = input.stocks

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

  logger.info(`[runDualStrategyUseCase] 开始执行双策略，标的数 ${stocks.length}`)

  const [hotResult, pitResult] = await Promise.all([
    analyzeHotSectors(stocks, { ruleConfig }),
    analyzeValuePits(stocks, { ruleConfig }),
  ])

  const hotSectorScores = hotResult.data ?? []
  const valuePitScores = pitResult.data ?? []

  const signals: Signal[] = []
  const watchlistCandidates: Array<{ symbol: string; reason: string }> = []

  const rotationResults = await Promise.all(
    valuePitScores
      .filter((score) => score.action === 'immediate' || score.action === 'probe' || score.action === 'wait')
      .map(async (score) => {
        const rotation = await detectBySector(score.name)
        return { score, isRotationTriggered: rotation?.triggered ?? false }
      }),
  )

  for (const { score, isRotationTriggered } of rotationResults) {
    score.rotationSignal = isRotationTriggered

    if (isRotationTriggered && (score.action === 'probe' || score.action === 'wait')) {
      signals.push({
        id: generateId(),
        symbol: score.symbol,
        direction: 'buy',
        type: 'buy_rotation',
        strategy: 'dual',
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
    `[runDualStrategyUseCase] 完成：热门 ${result.summary.hotSectorCount} / 洼地 ${result.summary.valuePitCount} / 信号 ${result.summary.signalCount} / 观察 ${result.summary.watchlistCount}`,
  )
  return { success: true, data: result }
}
