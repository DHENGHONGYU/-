/**
 * 行业分析服务（统一入口）
 *
 * 整合三级行业分类、数据聚合、V4维度分析、评分计算。
 * 与 v6ScoreService 和 scoreAutoTrigger 联动，
 * 实现"数据采集 → 行业聚合 → V4分析 → 个股评分联动"的闭环。
 *
 * @module services/analysis/industryAnalysisService
 * @created 2026-07-16 - v2.9.0
  * @doc [V9-DOC-PROJ-124, V9-DOC-BACK-004, V9-DOC-BACK-012, V9-DOC-PROJ-113, V9-DOC-PROD-001]
*/

import { getLogger } from '@/lib/logger'
import type { Stock } from '@/data/types/types.stock'
import type { FinancialData, QuoteData } from '@/services/scoring/v6-engine/types'
import type {
  IndustryV4Analysis,
  IndustryDefinition,
} from '@/data/types/types.sector'
import {
  matchStockIndustry,
  getIndustryPath,
  INDUSTRY_MAP,
  INDUSTRY_STATS,
} from '@/data/industryHierarchy'
import {
  aggregateAllIndustries,
  type StockWithData,
  type IndustryAggregationResult,
  aggregateAllIndustriesEnhanced,
  type IndustryAggregationResultEnhanced,
} from './industryDataAggregator'
import {
  analyzeAllIndustriesV4,
  getV4RatingLabel,
  getAllocationRecommendation,
  analyzeAllIndustriesV4Enhanced,
} from './industryV4Analyzer'
import type { IndustryV4AnalysisEnhanced } from '@/data/types/types.sector'

const logger = getLogger()

// ============================================================
// 缓存管理
// ============================================================

/** 行业分析缓存（内存级，避免重复计算） */
let industryCache: {
  aggregations: IndustryAggregationResult[]
  v4Analyses: IndustryV4Analysis[]
  timestamp: number
} | null = null

/** 缓存有效期（5分钟） */
const CACHE_TTL = 5 * 60 * 1000

/**
 * 检查缓存是否有效
 */
function isCacheValid(): boolean {
  if (!industryCache) return false
  return Date.now() - industryCache.timestamp < CACHE_TTL
}

/**
 * 使缓存失效（数据更新后调用）
 */
export function invalidateIndustryCache(): void {
  industryCache = null
  logger.info('[industryAnalysisService] 行业分析缓存已失效')
}

// ============================================================
// 核心分析流程
// ============================================================

/**
 * 执行全量行业分析（数据聚合 + V4 维度分析）
 */
export async function runFullIndustryAnalysis(
  stocks: Array<{ stock: Stock; financials: FinancialData; quotes: QuoteData }>,
  options: { forceRefresh?: boolean } = {},
): Promise<{
  aggregations: IndustryAggregationResult[]
  v4Analyses: IndustryV4Analysis[]
}> {
  // 检查缓存
  if (!options.forceRefresh && isCacheValid() && industryCache) {
    logger.debug('[industryAnalysisService] 使用缓存的行业分析结果')
    return {
      aggregations: industryCache.aggregations,
      v4Analyses: industryCache.v4Analyses,
    }
  }

  logger.info(`[industryAnalysisService] 开始全量行业分析, 股票数=${stocks.length}`)

  const startTime = Date.now()

  // Step 1: 数据聚合
  const stockWithDataList: StockWithData[] = stocks.map((s) => ({
    stock: s.stock,
    financials: s.financials,
    quotes: s.quotes,
  }))

  const aggregations = aggregateAllIndustries(stockWithDataList)

  // Step 2: V4 维度分析
  const v4Analyses = analyzeAllIndustriesV4(aggregations)

  // 更新缓存
  industryCache = {
    aggregations,
    v4Analyses,
    timestamp: Date.now(),
  }

  const duration = Date.now() - startTime
  logger.info(`[industryAnalysisService] 全量行业分析完成, 耗时=${duration}ms, 行业数=${aggregations.length}`)

  return { aggregations, v4Analyses }
}

/**
 * 执行增强版全量行业分析（数据聚合 + V4 维度 + 子指标 + 趋势 + 估值）
 *
 * v2.9.5 增强版，包含：
 * - V4 四维度评分
 * - 细化子指标（景气度9项、竞争格局6项、政策4项、技术6项）
 * - 行业趋势分析（方向、强度、加速度）
 * - 估值分析（PE/PB分位、溢价率、PEG）
 */
export async function runFullIndustryAnalysisEnhanced(
  stocks: Array<{ stock: Stock; financials: FinancialData; quotes: QuoteData }>,
  options: { forceRefresh?: boolean; hs300Pe?: number; hs300Pb?: number } = {},
): Promise<{
  aggregations: IndustryAggregationResultEnhanced[]
  v4Analyses: IndustryV4AnalysisEnhanced[]
}> {
  logger.info(`[industryAnalysisService] 开始增强版全量行业分析, 股票数=${stocks.length}`)

  const startTime = Date.now()

  const stockWithDataList: StockWithData[] = stocks.map((s) => ({
    stock: s.stock,
    financials: s.financials,
    quotes: s.quotes,
  }))

  // Step 1: 增强版数据聚合（含 CR5/CR10、周转率、分位数、估值）
  const aggregations = aggregateAllIndustriesEnhanced(stockWithDataList, {
    hs300Pe: options.hs300Pe,
    hs300Pb: options.hs300Pb,
  })

  // Step 2: 增强版 V4 分析（含子指标、趋势、估值）
  const v4Analyses = analyzeAllIndustriesV4Enhanced(
    aggregations.map((agg) => ({
      industry: agg.industry,
      financialAggregate: agg.financialAggregate,
      quoteAggregate: agg.quoteAggregate,
      validation: agg.validation,
      valuation: agg.valuation,
    })),
  )

  const duration = Date.now() - startTime
  logger.info(`[industryAnalysisService] 增强版全量分析完成, 耗时=${duration}ms, 行业数=${aggregations.length}`)

  return { aggregations, v4Analyses }
}

/**
 * 按优先级选择最佳匹配行业：三级 ≥ 二级 ≥ 一级 → 降级兜底。
 * 消除 getStockIndustryV4Analysis / Enhanced 中重复的深层 else-if 链（audit:complexity L5）。
 */
function selectBestMatch<T extends { dataCompleteness: number }>(
  tier3: T | null,
  tier2: T | null,
  tier1: T | null,
): T | null {
  if (tier3 && tier3.dataCompleteness >= 0.5) return tier3
  if (tier2 && tier2.dataCompleteness >= 0.4) return tier2
  return tier1 ?? tier3 ?? tier2
}

/**
 * 获取单只股票对应的行业 V4 分析结果（增强版）
 */
export function getStockIndustryV4AnalysisEnhanced(
  stock: Stock,
  allV4Analyses: IndustryV4AnalysisEnhanced[],
): {
  bestMatch: IndustryV4AnalysisEnhanced | null
  tier3: IndustryV4AnalysisEnhanced | null
  tier2: IndustryV4AnalysisEnhanced | null
  tier1: IndustryV4AnalysisEnhanced | null
} {
  const match = matchStockIndustry({
    name: stock.name,
    sector: stock.sector,
    conceptTags: stock.theme,
  })

  const v4Map = new Map(allV4Analyses.map((v) => [v.industryCode, v]))

  const tier3 = match.tier3 ? v4Map.get(match.tier3.code) ?? null : null
  const tier2 = match.tier2 ? v4Map.get(match.tier2.code) ?? null : null
  const tier1 = match.tier1 ? v4Map.get(match.tier1.code) ?? null : null
  const bestMatch = selectBestMatch(tier3, tier2, tier1)

  return { bestMatch, tier3, tier2, tier1 }
}

/**
 * 获取单只股票对应的行业 V4 分析结果
 *
 * 优先级：三级 > 二级 > 一级
 * 如果三级样本不足，自动上卷到二级
 */
export function getStockIndustryV4Analysis(
  stock: Stock,
  allV4Analyses: IndustryV4Analysis[],
): {
  bestMatch: IndustryV4Analysis | null
  tier3: IndustryV4Analysis | null
  tier2: IndustryV4Analysis | null
  tier1: IndustryV4Analysis | null
} {
  const match = matchStockIndustry({
    name: stock.name,
    sector: stock.sector,
    conceptTags: stock.theme,
  })

  const v4Map = new Map(allV4Analyses.map((v) => [v.industryCode, v]))

  const tier3 = match.tier3 ? v4Map.get(match.tier3.code) ?? null : null
  const tier2 = match.tier2 ? v4Map.get(match.tier2.code) ?? null : null
  const tier1 = match.tier1 ? v4Map.get(match.tier1.code) ?? null : null
  const bestMatch = selectBestMatch(tier3, tier2, tier1)

  return { bestMatch, tier3, tier2, tier1 }
}

// ============================================================
// 行业分类统计
// ============================================================

/**
 * 获取行业分类统计信息
 */
export function getIndustryStats() {
  return {
    ...INDUSTRY_STATS,
    description: '三级行业分类体系：一级大类 → 二级细分 → 三级赛道',
  }
}

/**
 * 获取行业层级路径
 */
export function getIndustryHierarchyPath(industryCode: string): IndustryDefinition[] {
  return getIndustryPath(industryCode)
}

/**
 * 按层级获取行业列表
 */
export function getIndustriesByTier(tier: 'tier1' | 'tier2' | 'tier3'): IndustryDefinition[] {
  return Object.values(INDUSTRY_MAP).filter((ind) => ind.tier === tier)
}

// ============================================================
// 评分辅助函数
// ============================================================

/**
 * 将 V4 分析结果转换为评分引擎可用的 IndustryScoreData 格式
 */
export function v4ToIndustryScoreData(v4: IndustryV4Analysis): {
  sectorName: string
  skillCScore: number
  skillCRating: string
  skillNScore: number
  relevance: number
  allocationBias: string
} {
  const rating = getV4RatingLabel(v4.v4Composite)
  const advice = getAllocationRecommendation(v4.v4Composite)

  return {
    sectorName: v4.industryName,
    skillCScore: v4.v4Composite ?? 0,
    skillCRating: rating,
    skillNScore: v4.v4Composite ?? 0,
    relevance: Math.min(1, v4.dataCompleteness * 1.2),
    allocationBias: advice,
  }
}

// ============================================================
// 行业数据质量报告
// ============================================================

/**
 * 生成行业数据质量报告
 */
export function generateDataQualityReport(
  aggregations: IndustryAggregationResult[],
): {
  totalIndustries: number
  sufficientIndustries: number
  warningIndustries: number
  insufficientIndustries: number
  avgCompleteness: number
  issues: string[]
} {
  let sufficient = 0
  let warning = 0
  let insufficient = 0
  let totalCompleteness = 0
  const issues: string[] = []

  for (const agg of aggregations) {
    totalCompleteness += agg.validation.dataCompleteness

    switch (agg.validation.sampleAdequacy) {
      case 'sufficient':
        sufficient++
        break
      case 'warning':
        warning++
        issues.push(`[警告] ${agg.industry.name}: 样本数 ${agg.constituentStocks.length} 偏少`)
        break
      case 'insufficient':
        insufficient++
        issues.push(`[不足] ${agg.industry.name}: 样本数 ${agg.constituentStocks.length} 不足`)
        break
    }

    if (agg.validation.dataCompleteness < 0.3) {
      issues.push(`[低完整度] ${agg.industry.name}: 数据完整度 ${(agg.validation.dataCompleteness * 100).toFixed(0)}%`)
    }
  }

  return {
    totalIndustries: aggregations.length,
    sufficientIndustries: sufficient,
    warningIndustries: warning,
    insufficientIndustries: insufficient,
    avgCompleteness: aggregations.length > 0 ? totalCompleteness / aggregations.length : 0,
    issues,
  }
}

export { getV4RatingLabel, getAllocationRecommendation }
