/**
 * 行业数据聚合与校验服务
 *
 * 核心功能：
 * 1. 从个股财务/行情数据聚合行业级别指标（中位数法）
 * 2. 行业数据质量校验（样本充足性、数据完整度、异常值检测）
 * 3. 为 V4 维度分析提供数据基础
 *
 * 设计原则：
 * - 数据驱动：完全基于已采集的个股数据，不依赖外部行业数据源
 * - 开放体系：支持任意行业分类，不预设行业边界
 * - 质量优先：所有聚合结果附带质量标签，避免低质量数据误导
 *
 * @module services/analysis/industryDataAggregator
 * @created 2026-07-16 - v2.9.0
 * @updated 2026-07-16 - v2.9.5：增强版聚合（CR5/CR10、周转率、分位数等）
 */

import type { FinancialData, QuoteData } from '@/services/scoring/v6-engine/types'
import type {
  IndustryFinancialAggregate,
  IndustryQuoteAggregate,
  IndustryDataValidation,
  IndustryDefinition,
  IndustryFinancialAggregateEnhanced,
  IndustryValuationAnalysis,
  ValuationPercentile,
} from '@/data/types/types.sector'
import { getLogger } from '@/lib/logger'
import { matchStockIndustry, INDUSTRY_MAP, getIndustryPath } from '@/data/industryHierarchy'
import type { Stock } from '@/data/types/types.stock'

const logger = getLogger()

// ============================================================
// 配置常量
// ============================================================

/** 样本充足性阈值 */
const SAMPLE_THRESHOLDS = {
  sufficient: 10,
  warning: 5,
  insufficient: 3,
}

/** 数据完整度阈值 */
const COMPLETENESS_THRESHOLDS = {
  high: 0.8,
  medium: 0.5,
  low: 0.3,
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 计算中位数（忽略 undefined 和 NaN）
 */
function median(values: Array<number | undefined | null>): number | null {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (valid.length === 0) return null

  const sorted = [...valid].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    const left = sorted[mid - 1]
    const right = sorted[mid]
    if (left === undefined || right === undefined) return null
    return (left + right) / 2
  }

  return sorted[mid] ?? null
}

/**
 * 计算分位数（0-1）
 *
 * 例如 percentile(values, 0.25) 返回 25% 分位数
 */
function percentile(
  values: Array<number | undefined | null>,
  p: number,
): number | null {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (valid.length === 0) return null
  if (p <= 0) return Math.min(...valid)
  if (p >= 1) return Math.max(...valid)

  const sorted = [...valid].sort((a, b) => a - b)
  const index = p * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)

  if (lower === upper) {
    return sorted[lower] ?? null
  }

  const weight = index - lower
  const lowerVal = sorted[lower]
  const upperVal = sorted[upper]

  if (lowerVal === undefined || upperVal === undefined) return null
  return lowerVal * (1 - weight) + upperVal * weight
}

// ============================================================
// 股票-行业匹配
// ============================================================

export interface StockWithData {
  stock: Stock
  financials: FinancialData
  quotes: QuoteData
}

/**
 * 将股票池按三级行业分类分组
 */
export function groupStocksByIndustry(
  stocks: StockWithData[],
): Map<string, StockWithData[]> {
  const groups = new Map<string, StockWithData[]>()

  for (const item of stocks) {
    const match = matchStockIndustry({
      name: item.stock.name,
      sector: item.stock.sector,
      conceptTags: item.stock.theme,
    })

    const industryCode = match.tier3?.code ?? match.tier2?.code ?? match.tier1?.code
    if (industryCode) {
      if (!groups.has(industryCode)) {
        groups.set(industryCode, [])
      }
      groups.get(industryCode)!.push(item)
    }
  }

  return groups
}

// ============================================================
// 财务数据聚合
// ============================================================

/**
 * 聚合行业财务指标（中位数法）
 */
export function aggregateFinancialMetrics(
  industryCode: string,
  stocks: StockWithData[],
): IndustryFinancialAggregate {
  const revenueYoYs = stocks.map((s) => s.financials.revenueYoY)
  const netProfitYoYs = stocks.map((s) => s.financials.netProfitYoY)
  const grossMargins = stocks.map((s) => s.financials.grossMargin)
  const netMargins = stocks.map((s) => s.financials.netMargin)
  const rdRatios = stocks.map((s) => s.financials.rdRatio)

  const roes = stocks.map((s) => s.stock.roe)

  const result: IndustryFinancialAggregate = {
    industryCode,
    revenueYoYMedian: median(revenueYoYs),
    netProfitYoYMedian: median(netProfitYoYs),
    grossMarginMedian: median(grossMargins),
    netMarginMedian: median(netMargins),
    roeMedian: median(roes),
    rdRatioMedian: median(rdRatios),
    debtRatioMedian: null,
    sampleCount: stocks.length,
    calculatedAt: Date.now(),
  }

  logger.debug(`[industryDataAggregator] 财务聚合完成: ${industryCode}, 样本=${stocks.length}`, {
    revenueYoY: result.revenueYoYMedian,
    netProfitYoY: result.netProfitYoYMedian,
  })

  return result
}

// ============================================================
// 行情数据聚合
// ============================================================

/**
 * 聚合行业行情指标
 */
export function aggregateQuoteMetrics(
  industryCode: string,
  stocks: StockWithData[],
): IndustryQuoteAggregate {
  const return20ds = stocks.map((s) => s.quotes.return20d)
  const volatilities = stocks.map((s) => s.quotes.volatility20d)
  const turnovers = stocks.map((s) => s.quotes.avgTurnover20d)
  const pes = stocks.map((s) => s.stock.pe)
  const pbs = stocks.map((s) => s.stock.pb)
  const marketCaps = stocks
    .map((s) => s.stock.marketCap)
    .filter((v): v is number => typeof v === 'number')

  const totalMarketCap = marketCaps.reduce((sum, v) => sum + v, 0)

  const result: IndustryQuoteAggregate = {
    industryCode,
    periodReturnMedian: median(return20ds),
    periodAmplitudeMedian: median(volatilities),
    avgTurnoverRate: median(turnovers),
    peMedian: median(pes),
    pbMedian: median(pbs),
    totalMarketCap: totalMarketCap > 0 ? totalMarketCap / 1e8 : null,
    sampleCount: stocks.length,
    calculatedAt: Date.now(),
  }

  logger.debug(`[industryDataAggregator] 行情聚合完成: ${industryCode}, 样本=${stocks.length}`, {
    return20d: result.periodReturnMedian,
    pe: result.peMedian,
  })

  return result
}

// ============================================================
// 数据质量校验
// ============================================================

/**
 * 校验行业数据质量
 */
export function validateIndustryData(
  industry: IndustryDefinition,
  financials: IndustryFinancialAggregate,
  quotes: IndustryQuoteAggregate,
): IndustryDataValidation {
  const issues: IndustryDataValidation['issues'] = []

  // 1. 样本充足性检查
  const sampleCount = financials.sampleCount
  let sampleAdequacy: IndustryDataValidation['sampleAdequacy'] = 'sufficient'

  if (sampleCount < SAMPLE_THRESHOLDS.insufficient) {
    sampleAdequacy = 'insufficient'
    issues.push({
      level: 'error',
      field: 'sampleCount',
      message: `样本数 ${sampleCount} 不足（最低要求 ${SAMPLE_THRESHOLDS.insufficient}），行业分析不可靠`,
    })
  } else if (sampleCount < SAMPLE_THRESHOLDS.warning) {
    sampleAdequacy = 'warning'
    issues.push({
      level: 'warning',
      field: 'sampleCount',
      message: `样本数 ${sampleCount} 偏少（建议 ≥ ${SAMPLE_THRESHOLDS.warning}），分析结果需谨慎使用`,
    })
  }

  // 2. 财务数据完整度检查
  const finFields: Array<keyof IndustryFinancialAggregate> = [
    'revenueYoYMedian',
    'netProfitYoYMedian',
    'grossMarginMedian',
    'netMarginMedian',
    'roeMedian',
    'rdRatioMedian',
  ]

  let finValid = 0
  for (const field of finFields) {
    if (financials[field] !== null && financials[field] !== undefined) {
      finValid++
    }
  }
  const finCompleteness = finValid / finFields.length

  if (finCompleteness < COMPLETENESS_THRESHOLDS.low) {
    issues.push({
      level: 'error',
      field: 'financialCompleteness',
      message: `财务数据完整度过低: ${(finCompleteness * 100).toFixed(0)}%`,
    })
  } else if (finCompleteness < COMPLETENESS_THRESHOLDS.medium) {
    issues.push({
      level: 'warning',
      field: 'financialCompleteness',
      message: `财务数据完整度一般: ${(finCompleteness * 100).toFixed(0)}%`,
    })
  }

  // 3. 行情数据完整度检查
  const quoteFields: Array<keyof IndustryQuoteAggregate> = [
    'periodReturnMedian',
    'avgTurnoverRate',
    'peMedian',
    'pbMedian',
  ]

  let quoteValid = 0
  for (const field of quoteFields) {
    if (quotes[field] !== null && quotes[field] !== undefined) {
      quoteValid++
    }
  }
  const quoteCompleteness = quoteValid / quoteFields.length

  // 4. 综合数据完整度
  const dataCompleteness = (finCompleteness + quoteCompleteness) / 2

  // 5. 营收增速异常值检测（粗略范围检查）
  if (
    financials.revenueYoYMedian !== null &&
    Math.abs(financials.revenueYoYMedian) > 200
  ) {
    issues.push({
      level: 'warning',
      field: 'revenueYoYMedian',
      message: `营收增速中位数异常: ${financials.revenueYoYMedian.toFixed(1)}%`,
    })
  }

  // 6. 行业层级检查
  if (industry.tier === 'tier3' && sampleCount < SAMPLE_THRESHOLDS.warning) {
    issues.push({
      level: 'info',
      field: 'tier3Sample',
      message: `三级行业样本偏少，建议参考二级行业数据`,
    })
  }

  const hasError = issues.some((i) => i.level === 'error')

  logger.info(`[industryDataAggregator] 数据校验: ${industry.name}, 完整度=${(dataCompleteness * 100).toFixed(0)}%, 样本=${sampleCount}`, {
    issues: issues.length,
    sampleAdequacy,
  })

  return {
    industryCode: industry.code,
    valid: !hasError,
    issues,
    dataCompleteness,
    sampleAdequacy,
  }
}

// ============================================================
// 批量聚合入口
// ============================================================

export interface IndustryAggregationResult {
  industry: IndustryDefinition
  financialAggregate: IndustryFinancialAggregate
  quoteAggregate: IndustryQuoteAggregate
  validation: IndustryDataValidation
  constituentStocks: StockWithData[]
}

/**
 * 对所有行业进行批量数据聚合与校验
 */
export function aggregateAllIndustries(
  stocks: StockWithData[],
): IndustryAggregationResult[] {
  const groups = groupStocksByIndustry(stocks)
  const results: IndustryAggregationResult[] = []

  for (const [industryCode, stockList] of groups.entries()) {
    const industry = INDUSTRY_MAP[industryCode]
    if (!industry) continue

    const financialAggregate = aggregateFinancialMetrics(industryCode, stockList)
    const quoteAggregate = aggregateQuoteMetrics(industryCode, stockList)
    const validation = validateIndustryData(industry, financialAggregate, quoteAggregate)

    results.push({
      industry,
      financialAggregate,
      quoteAggregate,
      validation,
      constituentStocks: stockList,
    })
  }

  logger.info(`[industryDataAggregator] 批量聚合完成: ${results.length} 个行业, ${stocks.length} 只股票`)

  return results.sort((a, b) => b.constituentStocks.length - a.constituentStocks.length)
}

/**
 * 计算某行业在不同层级的聚合数据（tier3 → tier2 → tier1 上卷）
 */
export function rollupIndustryData(
  industryCode: string,
  allResults: IndustryAggregationResult[],
): {
  tier3: IndustryAggregationResult | null
  tier2: IndustryAggregationResult | null
  tier1: IndustryAggregationResult | null
} {
  const path = getIndustryPath(industryCode)
  const resultMap = new Map(allResults.map((r) => [r.industry.code, r]))

  const tier3Def = path.find((p) => p.tier === 'tier3')
  const tier2Def = path.find((p) => p.tier === 'tier2')
  const tier1Def = path.find((p) => p.tier === 'tier1')

  return {
    tier3: tier3Def ? resultMap.get(tier3Def.code) ?? null : null,
    tier2: tier2Def ? resultMap.get(tier2Def.code) ?? null : null,
    tier1: tier1Def ? resultMap.get(tier1Def.code) ?? null : null,
  }
}

// ============================================================
// 增强版：财务聚合（v2.9.5 新增）
// ============================================================

/**
 * 增强版财务指标聚合（含周转率、集中度、分位数等）
 */
export function aggregateFinancialMetricsEnhanced(
  industryCode: string,
  stocks: StockWithData[],
): IndustryFinancialAggregateEnhanced {
  const base = aggregateFinancialMetrics(industryCode, stocks)

  // 营运能力指标
  const inventoryDays = stocks.map((s) => s.financials.inventoryTurnoverDays)
  const receivableDays = stocks.map((s) => s.financials.receivables)
  const payableDays: Array<number | undefined | null> = stocks.map(() => null) // 暂缺应付数据

  // 现金流质量
  const ocfToProfit = stocks.map((s) => {
    const operatingCF = s.financials.operatingCF
    const netProfit = s.financials.netProfit
    if (operatingCF === undefined || netProfit === undefined || netProfit === 0) return null
    return (operatingCF / netProfit) * 100
  })

  // 补贴强度（暂缺政府补助数据，留空）
  const subsidyRatios: Array<number | undefined | null> = stocks.map(() => null)

  // 合同负债/营收（暂缺，留空）
  const contractLiabilityRatios: Array<number | undefined | null> = stocks.map(() => null)

  // 固定资产周转率（暂缺固定资产数据，留空）
  const fixedAssetTurnovers: Array<number | undefined | null> = stocks.map(() => null)

  // CR5 / CR10 市值集中度
  const marketCaps = stocks
    .map((s) => s.stock.marketCap)
    .filter((v): v is number => typeof v === 'number' && v > 0)
    .sort((a, b) => b - a)

  const totalMarketCap = marketCaps.reduce((sum, v) => sum + v, 0)
  const cr5Count = Math.min(5, marketCaps.length)
  const cr10Count = Math.min(10, marketCaps.length)

  const cr5Sum = marketCaps.slice(0, cr5Count).reduce((sum, v) => sum + v, 0)
  const cr10Sum = marketCaps.slice(0, cr10Count).reduce((sum, v) => sum + v, 0)

  const marketCapCr5 = totalMarketCap > 0 ? cr5Sum / totalMarketCap : null
  const marketCapCr10 = totalMarketCap > 0 ? cr10Sum / totalMarketCap : null

  // 净利率分位数（头部/尾部）
  const netMargins = stocks.map((s) => s.financials.netMargin)
  const top25NetMargin = percentile(netMargins, 0.75)
  const bottom25NetMargin = percentile(netMargins, 0.25)

  // 毛利率分化度
  const grossMargins = stocks.map((s) => s.financials.grossMargin)
  const top25GrossMargin = percentile(grossMargins, 0.75)
  const bottom25GrossMargin = percentile(grossMargins, 0.25)
  const grossMarginDispersion =
    top25GrossMargin !== null && bottom25GrossMargin !== null
      ? top25GrossMargin - bottom25GrossMargin
      : null

  const result: IndustryFinancialAggregateEnhanced = {
    ...base,
    inventoryTurnoverDaysMedian: median(inventoryDays),
    receivableTurnoverDaysMedian: median(receivableDays),
    payableTurnoverDaysMedian: median(payableDays),
    ocfToProfitRatioMedian: median(ocfToProfit),
    subsidyToRevenueRatioMedian: median(subsidyRatios),
    contractLiabilityRatioMedian: median(contractLiabilityRatios),
    fixedAssetTurnoverMedian: median(fixedAssetTurnovers),
    marketCapCr5,
    marketCapCr10,
    top25NetMargin,
    bottom25NetMargin,
    grossMarginDispersion,
  }

  logger.debug(`[industryDataAggregator] 增强版财务聚合: ${industryCode}`, {
    cr5: marketCapCr5,
    cr10: marketCapCr10,
    inventoryDays: result.inventoryTurnoverDaysMedian,
  })

  return result
}

// ============================================================
// 估值分析（v2.9.5 新增）
// ============================================================

/**
 * 将估值百分位转换为等级标签
 */
function percentileToLevel(p: number | null): ValuationPercentile | null {
  if (p === null) return null
  if (p < 0.1) return 'extremely_low'
  if (p < 0.25) return 'low'
  if (p < 0.4) return 'medium_low'
  if (p < 0.6) return 'medium'
  if (p < 0.75) return 'medium_high'
  if (p < 0.9) return 'high'
  return 'extremely_high'
}

/**
 * 计算行业估值分析
 *
 * 基于当前样本的 PE/PB 分布估算百分位（无历史数据时用横截面分布代替）
 */
export function analyzeIndustryValuation(
  industry: IndustryDefinition,
  quoteAggregate: IndustryQuoteAggregate,
  stocks: StockWithData[],
  options: { hs300Pe?: number; hs300Pb?: number } = {},
): IndustryValuationAnalysis {
  const pes = stocks
    .map((s) => s.stock.pe)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 500)

  const pbs = stocks
    .map((s) => s.stock.pb)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 50)

  // 基于当前样本估算 PE 百分位（中位数在样本中的位置）
  let pePercentile: number | null = null
  let pbPercentile: number | null = null

  if (pes.length >= 5 && quoteAggregate.peMedian !== null) {
    const belowCount = pes.filter((v) => v <= quoteAggregate.peMedian!).length
    pePercentile = belowCount / pes.length
  }

  if (pbs.length >= 5 && quoteAggregate.pbMedian !== null) {
    const belowCount = pbs.filter((v) => v <= quoteAggregate.pbMedian!).length
    pbPercentile = belowCount / pbs.length
  }

  // 相对沪深300溢价率（默认沪深300 PE=12, PB=1.3）
  const hs300Pe = options.hs300Pe ?? 12
  const hs300Pb = options.hs300Pb ?? 1.3

  const pePremiumVsHs300 =
    quoteAggregate.peMedian !== null && hs300Pe > 0
      ? ((quoteAggregate.peMedian - hs300Pe) / hs300Pe) * 100
      : null

  const pbPremiumVsHs300 =
    quoteAggregate.pbMedian !== null && hs300Pb > 0
      ? ((quoteAggregate.pbMedian - hs300Pb) / hs300Pb) * 100
      : null

  // PEG 中位数 = PE / 净利润增速
  const pegs = stocks.map((s) => {
    const pe = s.stock.pe
    const growth = s.financials.netProfitYoY
    if (pe === undefined || growth === undefined || growth === 0 || growth < 0) return null
    return pe / Math.abs(growth)
  })
  const pegMedian = median(pegs)

  // 股息率（暂缺，留空）
  const dividendYieldMedian: number | null = null

  // 估值综合评分（0-5，越低越便宜）
  let weightedScoreSum = 0
  let totalWeight = 0

  // PE 分位评分（权重 0.4）
  if (pePercentile !== null) {
    const peScore = 5 - pePercentile * 5 // 0分位=5分，100分位=0分
    weightedScoreSum += peScore * 0.4
    totalWeight += 0.4
  }

  // PB 分位评分（权重 0.3）
  if (pbPercentile !== null) {
    const pbScore = 5 - pbPercentile * 5
    weightedScoreSum += pbScore * 0.3
    totalWeight += 0.3
  }

  // PEG 评分（权重 0.3）
  if (pegMedian !== null && pegMedian > 0) {
    const pegScore = Math.max(0, Math.min(5, 5 - pegMedian * 2)) // PEG=1 → 3分，PEG=0.5 → 4分，PEG=2.5 → 0分
    weightedScoreSum += pegScore * 0.3
    totalWeight += 0.3
  }

  const valuationScore: number | null = totalWeight > 0 ? weightedScoreSum / totalWeight : null

  // 估值总结
  let summary = ''
  if (pePercentile !== null && pbPercentile !== null) {
    const peLevel = percentileToLevel(pePercentile)
    const pbLevel = percentileToLevel(pbPercentile)
    summary = `PE ${quoteAggregate.peMedian?.toFixed(1) ?? 'N/A'}倍（${percentileLabel(peLevel)}），PB ${quoteAggregate.pbMedian?.toFixed(2) ?? 'N/A'}倍（${percentileLabel(pbLevel)}）`
  } else {
    summary = `估值数据不足，样本 ${stocks.length} 只`
  }

  return {
    industryCode: industry.code,
    industryName: industry.name,
    peMedian: quoteAggregate.peMedian,
    pbMedian: quoteAggregate.pbMedian,
    pePercentile,
    pbPercentile,
    pePercentileLevel: percentileToLevel(pePercentile),
    pbPercentileLevel: percentileToLevel(pbPercentile),
    pePremiumVsHs300,
    pbPremiumVsHs300,
    pegMedian,
    dividendYieldMedian,
    valuationScore,
    summary,
    analyzedAt: Date.now(),
  }
}

function percentileLabel(level: ValuationPercentile | null): string {
  const map: Record<ValuationPercentile, string> = {
    extremely_low: '极度低估',
    low: '低估',
    medium_low: '偏低估',
    medium: '合理',
    medium_high: '偏高估',
    high: '高估',
    extremely_high: '极度高估',
  }
  return level ? map[level] : '未知'
}

// ============================================================
// 增强版批量聚合入口（v2.9.5 新增）
// ============================================================

export interface IndustryAggregationResultEnhanced {
  industry: IndustryDefinition
  financialAggregate: IndustryFinancialAggregateEnhanced
  quoteAggregate: IndustryQuoteAggregate
  validation: IndustryDataValidation
  valuation: IndustryValuationAnalysis
  constituentStocks: StockWithData[]
}

/**
 * 增强版批量聚合（含估值分析）
 */
export function aggregateAllIndustriesEnhanced(
  stocks: StockWithData[],
  options: { hs300Pe?: number; hs300Pb?: number } = {},
): IndustryAggregationResultEnhanced[] {
  const groups = groupStocksByIndustry(stocks)
  const results: IndustryAggregationResultEnhanced[] = []

  for (const [industryCode, stockList] of groups.entries()) {
    const industry = INDUSTRY_MAP[industryCode]
    if (!industry) continue

    const financialAggregate = aggregateFinancialMetricsEnhanced(industryCode, stockList)
    const quoteAggregate = aggregateQuoteMetrics(industryCode, stockList)
    const validation = validateIndustryData(industry, financialAggregate, quoteAggregate)
    const valuation = analyzeIndustryValuation(industry, quoteAggregate, stockList, options)

    results.push({
      industry,
      financialAggregate,
      quoteAggregate,
      validation,
      valuation,
      constituentStocks: stockList,
    })
  }

  logger.info(`[industryDataAggregator] 增强版批量聚合完成: ${results.length} 个行业`)

  return results.sort((a, b) => b.constituentStocks.length - a.constituentStocks.length)
}
