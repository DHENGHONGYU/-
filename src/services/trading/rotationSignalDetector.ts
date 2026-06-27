import {
  getDefaultDualStrategyRuleConfig,
  type DualStrategyRuleConfig,
} from '@/config/dualStrategyRules'
import { generateId } from '@/data/db'
import { dataLayer } from '@/data/dataLayer'
import type { DataLayerResult, Signal, ValuePitScore } from '@/data/types'
import { getLogger } from '@/lib/logger'
import { getRotationScores } from '@/services/analysis/rotationScoreService'

const logger = getLogger()

export interface RotationSignalDetectorOptions {
  ruleConfig?: DualStrategyRuleConfig
}

export interface RotationSignalResult {
  signals: Signal[]
  watchlistCandidates: Array<{ symbol: string; reason: string }>
}

function computeMA(closes: number[], period: number): number | undefined {
  if (closes.length < period) return undefined
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function computeVolumeRatio(history: Array<{ volume: number }>, short: number, long: number): number | undefined {
  if (history.length < long + 1) return undefined
  const recent = history.slice(-short)
  const past = history.slice(-long, -short)
  const recentAvg = recent.reduce((sum, bar) => sum + bar.volume, 0) / recent.length
  const pastAvg = past.reduce((sum, bar) => sum + bar.volume, 0) / past.length
  if (pastAvg === 0) return undefined
  return recentAvg / pastAvg
}

/**
 * 检测单只价值洼地候选是否触发轮动信号。
 *
 * 触发条件：
 * 1. 成交量显著放大（近 5 日均量 / 近 20 日均量 >= threshold）
 * 2. 资金净流入（使用板块轮动资金因子作为代理）
 * 3. 技术金叉（价格站上 MA20 且 MA20 > MA60）
 */
async function detectForScore(
  score: ValuePitScore,
  ruleConfig: DualStrategyRuleConfig,
): Promise<{ signal?: Signal; watchlistCandidate?: { symbol: string; reason: string } }> {
  const stock = await dataLayer.stocks.get(score.symbol)
  if (!stock) {
    return { watchlistCandidate: { symbol: score.symbol, reason: '股票基础数据缺失' } }
  }

  const quotes = await dataLayer.dailyQuotes.get(score.symbol).catch(() => undefined)
  if (!quotes || quotes.history.length < 60) {
    return {
      watchlistCandidate: {
        symbol: score.symbol,
        reason: 'K线数据不足，等待轮动信号',
      },
    }
  }

  const history = quotes.history
  const closes = history.map((bar) => bar.close)
  const latest = closes[closes.length - 1]!
  const ma20 = computeMA(closes, 20)
  const ma60 = computeMA(closes, 60)

  const volumeSurge = computeVolumeRatio(history, 5, 20)
  const volumeCondition =
    volumeSurge !== undefined && volumeSurge >= ruleConfig.rotationVolumeSurgeRatio

  let fundFlowCondition = false
  if (stock.sector) {
    try {
      const sectorResult = await getRotationScores()
      if (sectorResult.success && sectorResult.data) {
        const matchedSector = sectorResult.data
          .filter(
            (s) => s.sectorName.includes(stock.sector!) || stock.sector!.includes(s.sectorName),
          )
          .sort((a, b) => new Date(b.scoreDate).getTime() - new Date(a.scoreDate).getTime())[0]
        if (matchedSector && matchedSector.f2Zijin >= 15) {
          fundFlowCondition = true
        }
      }
    } catch (e) {
      logger.warn(`[rotationSignalDetector] 读取板块资金数据失败: ${stock.symbol}`, { error: e })
    }
  }

  const technicalCondition =
    ma20 !== undefined &&
    ma60 !== undefined &&
    latest > ma20 &&
    ma20 > ma60 &&
    (latest - ma20) / ma20 >= ruleConfig.rotationPriceToMA20Threshold

  const snapshot = {
    priceToMA20: ma20 !== undefined && ma20 !== 0 ? (latest - ma20) / ma20 : undefined,
    priceToMA60: ma60 !== undefined && ma60 !== 0 ? (latest - ma60) / ma60 : undefined,
    volumeRatio: volumeSurge,
  }

  if (volumeCondition && fundFlowCondition && technicalCondition) {
    const signal: Signal = {
      id: generateId(),
      symbol: score.symbol,
      direction: 'buy',
      type: 'buy_rotation',
      confidence: Math.min(0.9, 0.5 + score.score / 10),
      rationale: `价值洼地轮动信号触发：量比 ${volumeSurge!.toFixed(2)}，板块资金净流入，价格站上 MA20 且 MA20/MA60 多头排列`,
      snapshot,
      createdAt: Date.now(),
    }
    return { signal }
  }

  const reasons: string[] = []
  if (!volumeCondition) reasons.push('成交量未显著放大')
  if (!fundFlowCondition) reasons.push('板块资金未净流入')
  if (!technicalCondition) reasons.push('技术金叉未形成')

  return {
    watchlistCandidate: {
      symbol: score.symbol,
      reason: `等待轮动信号：${reasons.join('；')}`,
    },
  }
}

/**
 * 对价值洼地候选批量检测轮动信号。
 */
export async function detectRotationSignals(
  valuePitScores: ValuePitScore[],
  options: RotationSignalDetectorOptions = {},
): Promise<DataLayerResult<RotationSignalResult>> {
  const ruleConfig = options.ruleConfig ?? getDefaultDualStrategyRuleConfig()

  if (valuePitScores.length === 0) {
    return { success: true, data: { signals: [], watchlistCandidates: [] } }
  }

  logger.info(`[rotationSignalDetector] 开始检测 ${valuePitScores.length} 只候选`)

  const signals: Signal[] = []
  const watchlistCandidates: Array<{ symbol: string; reason: string }> = []

  for (const score of valuePitScores) {
    if (score.triggerAction !== 'wait' && score.triggerAction !== 'probe') {
      continue
    }

    const result = await detectForScore(score, ruleConfig)
    if (result.signal) {
      signals.push(result.signal)
    } else if (result.watchlistCandidate) {
      watchlistCandidates.push(result.watchlistCandidate)
    }
  }

  logger.info(
    `[rotationSignalDetector] 完成，信号 ${signals.length} 个，观察池候选 ${watchlistCandidates.length} 个`,
  )
  return { success: true, data: { signals, watchlistCandidates } }
}
