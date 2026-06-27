import { dataLayer } from '@/data/dataLayer'
import { hasEnoughHistory, hasRealBasicData } from '@/services/fetcher/fetcherAdapter'
import { getLogger } from '@/lib/logger'
import type { DataLayerResult, DailyQuotes, Stock, V6Score } from '@/data/types'

const logger = getLogger()

const FACTOR_NAMES = ['估值', '成长', '盈利', '质量', '动量', '波动', '流动性', '行业', '情绪']

/**
 * 是否启用随机数降级。
 * v1.0.0 后默认关闭，优先使用真实数据。
 * 仅在测试或演示场景中开启。
 */
const USE_MOCK_SCORE = false

function calculateFactorFromBasicData(stock: Stock, factorName: string): number | null {
  // P0：仅当全部基础字段存在时，使用简单启发式计算；否则返回 null 触发降级。
  if (!hasRealBasicData(stock)) {
    return null
  }

  switch (factorName) {
    case '估值':
      // PE 越低分越高，PB 越低分越高；此处取一个保守的启发式映射
      return Math.max(0, Math.min(5, 5 - (stock.pe ?? 0) / 20))
    case '盈利':
      return Math.max(0, Math.min(5, (stock.roe ?? 0) / 5))
    case '流动性':
      return Math.max(0, Math.min(5, (stock.marketCap ?? 0) / 1e12))
    case '成长':
    case '质量':
    case '动量':
    case '波动':
    case '行业':
    case '情绪':
    default:
      // 其余维度暂时无法从基础数据直接计算，返回 null
      return null
  }
}

function calculateMomentumScore(quotes: DailyQuotes): number {
  const history = quotes.history
  if (history.length < 20) return 2.5
  const current = history[history.length - 1]?.close
  const past = history[history.length - 20]?.close
  if (current === undefined || past === undefined || past === 0) return 2.5
  const returns = (current - past) / past
  // 收益 -30% → 0 分，0% → 2.5 分，+30% → 5 分
  return Math.max(0, Math.min(5, 2.5 + (returns / 0.3) * 2.5))
}

function calculateVolatilityScore(quotes: DailyQuotes): number {
  const history = quotes.history
  if (history.length < 20) return 2.5
  const returns: number[] = []
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]?.close
    const curr = history[i]?.close
    if (prev !== undefined && prev !== 0 && curr !== undefined) {
      returns.push((curr - prev) / prev)
    }
  }
  if (returns.length === 0) return 2.5
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length
  const std = Math.sqrt(variance)
  // 日波动 0% → 5 分，5% → 0 分
  return Math.max(0, Math.min(5, 5 - (std / 0.05) * 5))
}

function calculateLiquidityScore(stock: Stock, quotes: DailyQuotes): number {
  const latest = quotes.latest
  if (!latest || !stock.marketCap || stock.marketCap <= 0) return 2.5
  // 以近 20 日平均成交额 / 市值 作为流动性代理
  const recent = quotes.history.slice(-20).filter((bar) => bar.amount !== undefined)
  if (recent.length === 0) return 2.5
  const avgAmount = recent.reduce((sum, bar) => sum + bar.amount, 0) / recent.length
  const turnover = avgAmount / stock.marketCap
  // 日换手 0% → 0 分，2% → 5 分
  return Math.max(0, Math.min(5, (turnover / 0.02) * 5))
}

function calculateFactorFromQuotes(
  stock: Stock,
  quotes: DailyQuotes | undefined,
  factorName: string,
): number | null {
  if (!quotes || !hasEnoughHistory(quotes, 20)) {
    return null
  }

  switch (factorName) {
    case '动量':
      return calculateMomentumScore(quotes)
    case '波动':
      return calculateVolatilityScore(quotes)
    case '流动性':
      return calculateLiquidityScore(stock, quotes)
    default:
      return null
  }
}

/**
 * 获取全部 V6 评分（只读）
 */
export async function getAllV6Scores(): Promise<DataLayerResult<V6Score[]>> {
  try {
    const list = await dataLayer.v6Scores.list()
    return { success: true, data: list }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export interface V6ScoreQuality {
  dataCompleteness: number // 0-100, 评分因子数据完整度
  hasQuotes: boolean
  hasBasicData: boolean
  missingFactors: string[]
}

export async function runV6Score(symbol: string): Promise<DataLayerResult<V6Score>> {
  const stock = await dataLayer.stocks.get(symbol)
  if (!stock) {
    return { success: false, error: `Stock not found: ${symbol}` }
  }

  const quotes = await dataLayer.dailyQuotes.get(symbol)
  const hasQuotes = quotes !== null && hasEnoughHistory(quotes, 20)
  const hasBasicData = hasRealBasicData(stock)

  const factors: Record<string, number> = {}
  const missingFactors: string[] = []
  let total = 0
  let validCount = 0

  for (const name of FACTOR_NAMES) {
    let value: number | null = null

    // 优先从 K线数据计算动量/波动/流动性
    value = calculateFactorFromQuotes(stock, quotes, name)

    // 其次从基础数据计算估值/盈利/流动性
    if (value === null) {
      value = calculateFactorFromBasicData(stock, name)
    }

    // 记录缺失因子（不使用随机数降级）
    if (value === null) {
      missingFactors.push(name)
      if (USE_MOCK_SCORE) {
        value = Math.random() * 5
        logger.warn(`[v6ScoreService] ${symbol} 因子 ${name} 数据缺失，使用模拟分（仅用于演示）`)
      }
    }

    if (value !== null) {
      factors[name] = value
      total += value
      validCount++
    }
  }

  const score = validCount > 0 ? total / validCount : 0
  const dataCompleteness = (validCount / FACTOR_NAMES.length) * 100

  logger.info(`[v6ScoreService] ${symbol} 评分完成`, {
    score: score.toFixed(2),
    dataCompleteness: `${dataCompleteness.toFixed(0)}%`,
    validFactors: validCount,
    missingFactors: missingFactors.length,
    hasQuotes,
    hasBasicData,
  })

  const v6Score: V6Score = {
    symbol,
    score,
    factors,
    algorithmVersion: 'v9-auto',
    calculatedAt: Date.now(),
    dataVersion: stock.dataVersion,
    // 扩展字段：评分质量指标
    ...(dataCompleteness < 100 && {
      qualityWarning: `数据完整度 ${dataCompleteness.toFixed(0)}%，缺失因子: ${missingFactors.join(', ')}`,
    }),
  }

  const result = await dataLayer.v6Scores.save(v6Score)
  if (!result.success) {
    return { success: false, error: result.error }
  }
  return { success: true, data: v6Score }
}

/**
 * 获取评分质量指标
 */
export function getV6ScoreQuality(_symbol: string, factors: Record<string, number>): V6ScoreQuality {
  const missingFactors = FACTOR_NAMES.filter((name) => factors[name] === undefined || factors[name] === null)
  const validCount = FACTOR_NAMES.length - missingFactors.length
  return {
    dataCompleteness: (validCount / FACTOR_NAMES.length) * 100,
    hasQuotes: true, // 需要从外部传入
    hasBasicData: validCount >= 3,
    missingFactors,
  }
}
