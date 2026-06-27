import {
  getDefaultDualStrategyRuleConfig,
  type DualStrategyRuleConfig,
} from '@/config/dualStrategyRules'
import { dataLayer } from '@/data/dataLayer'
import type { DataLayerResult, HotSectorScore, Stock } from '@/data/types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export interface HotSectorAnalyzerOptions {
  ruleConfig?: DualStrategyRuleConfig
  persist?: boolean
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(5, value))
}

function computeMA(closes: number[], period: number): number | undefined {
  if (closes.length < period) return undefined
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function computeRSI14(closes: number[]): number | undefined {
  if (closes.length < 15) return undefined
  const window = closes.slice(-15)
  let gains = 0
  let losses = 0
  for (let i = 1; i < window.length; i++) {
    const delta = window[i]! - window[i - 1]!
    if (delta > 0) gains += delta
    else losses -= delta
  }
  if (losses === 0) return 100
  const rs = gains / losses
  return 100 - 100 / (1 + rs)
}

/**
 * 计算单只股票的热门板块策略五维评分。
 *
 * 当前为启发式实现，真实场景应由外部数据/LLM 填充各维度。
 */
async function analyzeStock(
  stock: Stock,
  ruleConfig: DualStrategyRuleConfig,
): Promise<HotSectorScore | null> {
  const [v6Score, quotes, industryScores] = await Promise.all([
    dataLayer.v6Scores.get(stock.symbol).catch(() => undefined),
    dataLayer.dailyQuotes.get(stock.symbol).catch(() => undefined),
    dataLayer.industryScores.list().catch(() => []),
  ])

  const v6Value = v6Score?.score ?? 0
  if (v6Value < ruleConfig.hotSectorV6Min) {
    return null
  }

  const hasQuotes = quotes !== undefined && quotes.history.length >= 20
  const closes = hasQuotes ? quotes!.history.map((bar) => bar.close) : []
  const latest = hasQuotes ? closes[closes.length - 1]! : 0
  const ma20 = hasQuotes ? computeMA(closes, 20) : undefined
  const ma60 = hasQuotes ? computeMA(closes, 60) : undefined
  const rsi14 = hasQuotes ? computeRSI14(closes) : undefined

  // 动量：价格相对 MA20 的趋势强度，-30% → 0 分，+30% → 5 分
  let momentum = 2.5
  if (ma20 !== undefined && ma20 !== 0) {
    const priceToMA20 = (latest - ma20) / ma20
    momentum = clampScore(2.5 + (priceToMA20 / 0.3) * 2.5)
  }

  // 情绪：优先使用行业评分综合分，其次 V6 情绪因子
  const matchedIndustry = stock.sector
    ? industryScores
        .filter((s) => s.name.includes(stock.sector!) || stock.sector!.includes(s.name))
        .sort((a, b) => (b.scoredAt ?? 0) - (a.scoredAt ?? 0))[0]
    : undefined
  let sentiment = matchedIndustry?.overallScore ?? v6Score?.factors?.情绪 ?? 2.5
  sentiment = clampScore(sentiment)

  // 技术：RSI 中性偏强映射到 0-5；同时考虑 MA20/MA60 多头排列
  let technical = 2.5
  if (rsi14 !== undefined) {
    technical = clampScore((rsi14 / 100) * 5)
  }
  if (ma20 !== undefined && ma60 !== undefined && ma20 > ma60) {
    technical = clampScore(technical + 0.5)
  }

  // 估值：PE/PB 越低分越高；优先使用 V6 估值因子
  let valuation = v6Score?.factors?.估值 ?? 2.5
  if (stock.pe !== undefined && stock.pe > 0) {
    valuation = clampScore(Math.max(0, Math.min(5, 5 - stock.pe / 20)))
  }

  // 综合：四维加权
  const composite = clampScore((momentum + sentiment + technical + valuation) / 4)

  let triggerAction: HotSectorScore['triggerAction'] = 'ignore'
  if (composite >= ruleConfig.hotSectorImmediateThreshold) {
    triggerAction = 'immediate'
  } else if (composite >= ruleConfig.hotSectorProbeThreshold) {
    triggerAction = 'probe'
  }

  const missingFactors: string[] = []
  if (!hasQuotes) missingFactors.push('kline')
  if (v6Score === undefined) missingFactors.push('v6')

  const score: HotSectorScore = {
    symbol: stock.symbol,
    score: composite,
    dimensions: {
      momentum,
      sentiment,
      technical,
      valuation,
      composite,
    },
    triggerAction,
    calculatedAt: Date.now(),
    dataVersion: stock.dataVersion ?? 1,
    ...(missingFactors.length > 0 && {
      qualityWarning: `数据完整度不足，缺失: ${missingFactors.join(', ')}`,
    }),
  }

  return score
}

/**
 * 对输入股票池计算热门板块策略评分。
 */
export async function analyzeHotSectors(
  stocks: Stock[],
  options: HotSectorAnalyzerOptions = {},
): Promise<DataLayerResult<HotSectorScore[]>> {
  const ruleConfig = options.ruleConfig ?? getDefaultDualStrategyRuleConfig()
  const persist = options.persist ?? true

  if (stocks.length === 0) {
    return { success: true, data: [] }
  }

  logger.info(`[hotSectorAnalyzer] 开始分析 ${stocks.length} 只标的`)

  const results: HotSectorScore[] = []

  for (const stock of stocks) {
    const score = await analyzeStock(stock, ruleConfig)
    if (score === null) continue

    if (persist) {
      const saveResult = await dataLayer.hotSectorScores.save(score)
      if (!saveResult.success) {
        logger.warn(`[hotSectorAnalyzer] 保存评分失败: ${stock.symbol}`, { error: saveResult.error })
      }
    }

    results.push(score)
  }

  logger.info(`[hotSectorAnalyzer] 完成，输出 ${results.length} 条评分`)
  return { success: true, data: results }
}

/**
 * 获取最近一次热门板块评分。
 */
export async function getLatestHotSectorScore(symbol: string): Promise<HotSectorScore | undefined> {
  return dataLayer.hotSectorScores.get(symbol)
}
