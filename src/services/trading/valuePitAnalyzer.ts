import {
  getDefaultDualStrategyRuleConfig,
  type DualStrategyRuleConfig,
} from '@/config/dualStrategyRules'
import { dataLayer } from '@/data/dataLayer'
import type { DataLayerResult, Stock, ValuePitScore } from '@/data/types'
import { getLogger } from '@/lib/logger'
import { getRotationScores } from '@/services/analysis/rotationScoreService'

const logger = getLogger()

export interface ValuePitAnalyzerOptions {
  ruleConfig?: DualStrategyRuleConfig
  persist?: boolean
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(5, value))
}

/**
 * 计算单只股票的价值洼地策略五维评分。
 *
 * 当前为启发式实现，真实场景应由外部数据/LLM 填充各维度。
 */
async function analyzeStock(
  stock: Stock,
  ruleConfig: DualStrategyRuleConfig,
): Promise<ValuePitScore | null> {
  const [v6Score, quotes, industryScores] = await Promise.all([
    dataLayer.v6Scores.get(stock.symbol).catch(() => undefined),
    dataLayer.dailyQuotes.get(stock.symbol).catch(() => undefined),
    dataLayer.industryScores.list().catch(() => []),
  ])

  const v6Value = v6Score?.score ?? 0
  if (v6Value < ruleConfig.valuePitV6Min || v6Value > ruleConfig.valuePitV6Max) {
    return null
  }

  const hasQuotes = quotes !== undefined && quotes.history.length >= 20

  // 催化：使用行业评分综合分作为代理，若无则基于 V6 行业因子
  const matchedIndustry = stock.sector
    ? industryScores
        .filter((s) => s.name.includes(stock.sector!) || stock.sector!.includes(s.name))
        .sort((a, b) => (b.scoredAt ?? 0) - (a.scoredAt ?? 0))[0]
    : undefined
  let catalyst = matchedIndustry?.overallScore ?? v6Score?.factors?.行业 ?? 2.5
  catalyst = clampScore(catalyst)

  // 估值：PE/PB 越低分越高；优先使用 V6 估值因子
  let valuation = v6Score?.factors?.估值 ?? 2.5
  if (stock.pe !== undefined && stock.pe > 0) {
    valuation = clampScore(Math.max(0, Math.min(5, 5 - stock.pe / 20)))
  }

  // 筹码：以换手率代理筹码活跃度；成交额/市值高 → 筹码分散（分低），换手适中 → 分高
  let chip = 2.5
  if (hasQuotes && stock.marketCap && stock.marketCap > 0) {
    const recent = quotes!.history.slice(-20).filter((bar) => bar.amount !== undefined)
    if (recent.length > 0) {
      const avgAmount = recent.reduce((sum, bar) => sum + bar.amount, 0) / recent.length
      const turnover = avgAmount / stock.marketCap
      // 日换手 0% → 0 分，2% → 5 分
      chip = clampScore((turnover / 0.02) * 5)
    }
  }

  // 轮动：使用板块轮动评分服务中该股票所在板块的最新评分
  let rotation = 2.5
  if (stock.sector) {
    try {
      const sectorResult = await getRotationScores()
      if (sectorResult.success && sectorResult.data) {
        const matchedSector = sectorResult.data
          .filter((s) => s.sectorName.includes(stock.sector!) || stock.sector!.includes(s.sectorName))
          .sort((a, b) => new Date(b.scoreDate).getTime() - new Date(a.scoreDate).getTime())[0]
        if (matchedSector) {
          rotation = clampScore(matchedSector.total / 20)
        }
      }
    } catch (e) {
      logger.warn(`[valuePitAnalyzer] 读取板块轮动评分失败: ${stock.symbol}`, { error: e })
    }
  }

  // 流动性：以近 20 日平均成交额 / 市值作为代理
  let liquidity = 2.5
  if (hasQuotes && stock.marketCap && stock.marketCap > 0) {
    const recent = quotes!.history.slice(-20).filter((bar) => bar.amount !== undefined)
    if (recent.length > 0) {
      const avgAmount = recent.reduce((sum, bar) => sum + bar.amount, 0) / recent.length
      const turnover = avgAmount / stock.marketCap
      liquidity = clampScore((turnover / 0.02) * 5)
    }
  }

  // 综合：五维加权，估值与轮动权重略高
  const composite = clampScore(
    (catalyst * 0.2 + valuation * 0.3 + chip * 0.15 + rotation * 0.2 + liquidity * 0.15),
  )

  let triggerAction: ValuePitScore['triggerAction'] = 'ignore'
  if (composite >= ruleConfig.valuePitImmediateThreshold) {
    triggerAction = 'immediate'
  } else if (composite >= ruleConfig.valuePitProbeThreshold) {
    triggerAction = 'probe'
  } else if (composite >= ruleConfig.valuePitWaitThreshold) {
    triggerAction = 'wait'
  }

  const missingFactors: string[] = []
  if (!hasQuotes) missingFactors.push('kline')
  if (v6Score === undefined) missingFactors.push('v6')

  const score: ValuePitScore = {
    symbol: stock.symbol,
    score: composite,
    dimensions: {
      catalyst,
      valuation,
      chip,
      rotation,
      liquidity,
      composite,
    },
    rotationSignal: false,
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
 * 对输入股票池计算价值洼地策略评分。
 */
export async function analyzeValuePits(
  stocks: Stock[],
  options: ValuePitAnalyzerOptions = {},
): Promise<DataLayerResult<ValuePitScore[]>> {
  const ruleConfig = options.ruleConfig ?? getDefaultDualStrategyRuleConfig()
  const persist = options.persist ?? true

  if (stocks.length === 0) {
    return { success: true, data: [] }
  }

  logger.info(`[valuePitAnalyzer] 开始分析 ${stocks.length} 只标的`)

  const results: ValuePitScore[] = []

  for (const stock of stocks) {
    const score = await analyzeStock(stock, ruleConfig)
    if (score === null) continue

    if (persist) {
      const saveResult = await dataLayer.valuePitScores.save(score)
      if (!saveResult.success) {
        logger.warn(`[valuePitAnalyzer] 保存评分失败: ${stock.symbol}`, { error: saveResult.error })
      }
    }

    results.push(score)
  }

  logger.info(`[valuePitAnalyzer] 完成，输出 ${results.length} 条评分`)
  return { success: true, data: results }
}

/**
 * 获取最近一次价值洼地评分。
 */
export async function getLatestValuePitScore(symbol: string): Promise<ValuePitScore | undefined> {
  return dataLayer.valuePitScores.get(symbol)
}
