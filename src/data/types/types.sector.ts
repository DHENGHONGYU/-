/**
 * @fileoverview 板块评分域类型（L1 板块业务域）
 *
 * V6 Pro 迁移：板块评分体系 — 十五五规划 20 大新兴行业
 * V2.9.0 扩展：三级行业分类体系 + V4 维度分析框架
 * V2.9.5 扩展：V4子指标细化 + 行业趋势分析 + 估值分析
 *
 * @module data/types/types.sector
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
 * @updated 2026-07-16 - v2.9.0：新增三级行业分类 + V4 维度分析
 * @updated 2026-07-16 - v2.9.5：V4子指标细化 + 趋势分析 + 估值分析
/** 板块评分三维度  * @doc [V9-DOC-QA-066]
*/
export interface SectorScoreDimensions {
  /** 十五五规划契合度 0-5 */
  planAlignment: number
  /** 政策支持力度 0-5 */
  policySupport: number
  /** 中美同等热度 0-5 */
  usChinaParity: number
}

/** 中美对比数据 */
export interface SectorUsChinaData {
  chinaShare?: string
  usStatus?: string
  gap?: string
}

/** 板块定义（十五五规划新兴行业） */
export interface SectorDefinition {
  code: string
  name: string
  category: '新兴产业' | '未来产业' | '战略基础'
  description: string
  keywords: string[]
  dimensions: SectorScoreDimensions
  weight: { plan: number; policy: number; parity: number }
  composite: number
  isCore: boolean
  usChina: SectorUsChinaData
  keyStocks: Array<{ symbol: string; name: string }>
  relatedConcepts: string[]
}

/** 板块-股票映射 */
export interface SectorStockMapping {
  sectorCode: string
  sectorName: string
  stockSymbols: string[]
  matchType: 'primary' | 'secondary'
}

/** 板块评分记录（存入 IndexedDB） */
export interface SectorScoreRecord {
  id: string // sectorCode__date
  sectorCode: string
  scoreDate: string
  dimensions: SectorScoreDimensions
  composite: number
  isCore: boolean
  modelUsed: string
  createdAt: string
}

// ============================================================
// 三级行业分类体系（v2.9.0 新增）
// ============================================================

/** 行业层级 */
export type IndustryTier = 'tier1' | 'tier2' | 'tier3'

/** V4 维度评分 */
export interface IndustryV4Dimensions {
  /** V4-1 景气度：行业增长速度、产能利用率、库存周期 */
  prosperity: number | null
  /** V4-2 竞争格局：集中度、进入壁垒、议价能力 */
  competition: number | null
  /** V4-3 政策环境：政策支持力度、监管风险、补贴力度 */
  policy: number | null
  /** V4-4 技术成熟度：技术迭代速度、渗透率、替代风险 */
  technology: number | null
}

/** V4 维度详情（含评分依据） */
export interface IndustryV4DimensionDetail {
  name: string
  score: number | null
  weight: number
  rationale: string
  evidence: string[]
  subIndicators: Array<{ name: string; value: number | null; unit?: string }>
}

/** 三级行业定义 */
export interface IndustryDefinition {
  /** 行业代码（唯一标识） */
  code: string
  /** 行业名称 */
  name: string
  /** 行业层级 */
  tier: IndustryTier
  /** 上级行业代码（tier2/tier3 有值） */
  parentCode?: string
  /** 行业描述 */
  description: string
  /** 关键词列表（用于股票匹配） */
  keywords: string[]
  /** 申万/东方财富行业代码映射 */
  externalCodes?: {
    sw?: string
    em?: string
    ths?: string
  }
}

/** 行业 V4 分析结果 */
export interface IndustryV4Analysis {
  /** 行业代码 */
  industryCode: string
  /** 行业名称 */
  industryName: string
  /** 行业层级 */
  tier: IndustryTier
  /** V4 综合分（0-5） */
  v4Composite: number | null
  /** V4 四维度详情 */
  dimensions: {
    prosperity: IndustryV4DimensionDetail
    competition: IndustryV4DimensionDetail
    policy: IndustryV4DimensionDetail
    technology: IndustryV4DimensionDetail
  }
  /** 成分股数量 */
  constituentCount: number
  /** 数据完整度（0-1） */
  dataCompleteness: number
  /** 数据来源标记 */
  dataSources: string[]
  /** 分析时间 */
  analyzedAt: number
}

/** 行业财务聚合指标 */
export interface IndustryFinancialAggregate {
  industryCode: string
  /** 营收增速中位数（%） */
  revenueYoYMedian: number | null
  /** 净利润增速中位数（%） */
  netProfitYoYMedian: number | null
  /** 毛利率中位数（%） */
  grossMarginMedian: number | null
  /** 净利率中位数（%） */
  netMarginMedian: number | null
  /** ROE 中位数（%） */
  roeMedian: number | null
  /** 研发费用率中位数（%） */
  rdRatioMedian: number | null
  /** 资产负债率中位数（%） */
  debtRatioMedian: number | null
  /** 成分股数量 */
  sampleCount: number
  /** 统计时间 */
  calculatedAt: number
}

/** 行业行情聚合指标 */
export interface IndustryQuoteAggregate {
  industryCode: string
  /** 区间涨跌幅中位数（%） */
  periodReturnMedian: number | null
  /** 区间振幅中位数（%） */
  periodAmplitudeMedian: number | null
  /** 换手率均值（%） */
  avgTurnoverRate: number | null
  /** 市盈率中位数 */
  peMedian: number | null
  /** 市净率中位数 */
  pbMedian: number | null
  /** 总市值（亿） */
  totalMarketCap: number | null
  /** 成分股数量 */
  sampleCount: number
  /** 统计时间 */
  calculatedAt: number
}

/** 行业数据校验结果 */
export interface IndustryDataValidation {
  industryCode: string
  valid: boolean
  issues: Array<{
    level: 'error' | 'warning' | 'info'
    field: string
    message: string
  }>
  dataCompleteness: number
  sampleAdequacy: 'sufficient' | 'warning' | 'insufficient'
}

// ============================================================
// V4 子指标细化（v2.9.5 新增）
// ============================================================

/** 景气度子指标 */
export interface ProsperitySubIndicators {
  /** 营收增速中位数（%） */
  revenueGrowth: number | null
  /** 净利润增速中位数（%） */
  profitGrowth: number | null
  /** 毛利率中位数（%） */
  grossMargin: number | null
  /** ROE 中位数（%） */
  roe: number | null
  /** 产能利用率估算（基于营收/资产比值） */
  capacityUtilization: number | null
  /** 库存周转天数中位数（天） */
  inventoryTurnoverDays: number | null
  /** 库存周期位置（0-1，低位/上升/高位/下降） */
  inventoryCyclePosition: number | null
  /** 订单能见度（基于预收账款/合同负债） */
  orderVisibility: number | null
  /** 经营性现金流/净利润比值中位数 */
  cashFlowQuality: number | null
}

/** 竞争格局子指标 */
export interface CompetitionSubIndicators {
  /** CR5 集中度（前5市值占比，0-1） */
  cr5: number | null
  /** CR10 集中度（前10市值占比，0-1） */
  cr10: number | null
  /** 毛利率分化度（top25% - bottom25%） */
  marginDispersion: number | null
  /** 头部企业利润率优势（龙头净利率 - 行业中位数） */
  leaderMarginAdvantage: number | null
  /** 进入壁垒评分（0-5，基于重资产/技术/牌照等） */
  entryBarrier: number | null
  /** 议价能力（上下游占款能力，基于应收/应付） */
  pricingPower: number | null
}

/** 政策环境子指标 */
export interface PolicySubIndicators {
  /** 政策支持力度（0-5，基于行业分类映射） */
  policySupport: number | null
  /** 监管风险（0-5，值越高风险越大） */
  regulatoryRisk: number | null
  /** 补贴力度估算（基于政府补助/营收） */
  subsidyIntensity: number | null
  /** 十五五规划契合度（0-5） */
  planAlignment: number | null
}

/** 技术成熟度子指标 */
export interface TechnologySubIndicators {
  /** 研发费用率中位数（%） */
  rdRatio: number | null
  /** 技术人员占比估算（基于研发费用率推算） */
  techTalentRatio: number | null
  /** 技术成熟度阶段（1-5，萌芽/成长/成熟/衰退） */
  maturityStage: number | null
  /** 市场渗透率估算（0-1） */
  penetrationRate: number | null
  /** 技术迭代速度（0-5，基于研发强度+行业属性） */
  iterationSpeed: number | null
  /** 替代风险（0-5，值越高风险越大） */
  substitutionRisk: number | null
}

/** V4 维度子指标集合 */
export interface V4SubIndicators {
  prosperity: ProsperitySubIndicators
  competition: CompetitionSubIndicators
  policy: PolicySubIndicators
  technology: TechnologySubIndicators
}

// ============================================================
// 行业趋势分析（v2.9.5 新增）
// ============================================================

/** 趋势方向 */
export type TrendDirection = 'up' | 'down' | 'flat' | 'unknown'

/** 趋势强度 */
export type TrendStrength = 'strong' | 'moderate' | 'weak' | 'unknown'

/** 景气度趋势 */
export interface ProsperityTrend {
  /** 当前景气度评分 */
  currentScore: number | null
  /** 上期景气度评分 */
  previousScore: number | null
  /** 变化值（本期-上期） */
  change: number | null
  /** 变化率（%） */
  changeRate: number | null
  /** 趋势方向 */
  direction: TrendDirection
  /** 趋势强度 */
  strength: TrendStrength
  /** 加速度（二阶导数，正=加速向上） */
  acceleration: number | null
  /** 连续变化期数 */
  consecutivePeriods: number
  /** 是否拐点 */
  isInflectionPoint: boolean
  /** 拐点类型 */
  inflectionType: 'bottom' | 'top' | null
}

/** 行业趋势分析结果 */
export interface IndustryTrendAnalysis {
  industryCode: string
  industryName: string
  /** 景气度趋势 */
  prosperityTrend: ProsperityTrend
  /** 营收增速趋势 */
  revenueGrowthTrend: ProsperityTrend
  /** 利润增速趋势 */
  profitGrowthTrend: ProsperityTrend
  /** 综合趋势评分（0-5） */
  trendScore: number | null
  /** 趋势总结 */
  summary: string
  /** 分析时间 */
  analyzedAt: number
}

// ============================================================
// 行业估值分析（v2.9.5 新增）
// ============================================================

/** 估值百分位等级 */
export type ValuationPercentile = 'extremely_low' | 'low' | 'medium_low' | 'medium' | 'medium_high' | 'high' | 'extremely_high'

/** 行业估值分析结果 */
export interface IndustryValuationAnalysis {
  industryCode: string
  industryName: string
  /** PE 中位数 */
  peMedian: number | null
  /** PB 中位数 */
  pbMedian: number | null
  /** PE 历史分位（0-1，基于当前样本分布估算） */
  pePercentile: number | null
  /** PB 历史分位（0-1） */
  pbPercentile: number | null
  /** PE 分位等级 */
  pePercentileLevel: ValuationPercentile | null
  /** PB 分位等级 */
  pbPercentileLevel: ValuationPercentile | null
  /** 相对沪深300 PE 溢价率（%） */
  pePremiumVsHs300: number | null
  /** 相对沪深300 PB 溢价率（%） */
  pbPremiumVsHs300: number | null
  /** PEG 中位数 */
  pegMedian: number | null
  /** 股息率中位数（%） */
  dividendYieldMedian: number | null
  /** 估值综合评分（0-5，越低越便宜） */
  valuationScore: number | null
  /** 估值总结 */
  summary: string
  /** 分析时间 */
  analyzedAt: number
}

// ============================================================
// 扩展：行业 V4 分析（v2.9.5 增强版）
// ============================================================

/** 行业 V4 分析结果（增强版，含子指标/趋势/估值） */
export interface IndustryV4AnalysisEnhanced extends IndustryV4Analysis {
  /** V4 子指标明细 */
  subIndicators: V4SubIndicators
  /** 趋势分析（如有多期数据） */
  trend?: IndustryTrendAnalysis
  /** 估值分析 */
  valuation?: IndustryValuationAnalysis
}

// ============================================================
// 扩展：行业财务聚合（v2.9.5 增强版）
// ============================================================

/** 行业财务聚合指标（增强版） */
export interface IndustryFinancialAggregateEnhanced extends IndustryFinancialAggregate {
  /** 库存周转天数中位数（天） */
  inventoryTurnoverDaysMedian: number | null
  /** 应收账款周转天数中位数（天） */
  receivableTurnoverDaysMedian: number | null
  /** 应付账款周转天数中位数（天） */
  payableTurnoverDaysMedian: number | null
  /** 经营性现金流/净利润比值中位数 */
  ocfToProfitRatioMedian: number | null
  /** 政府补助/营收比值中位数 */
  subsidyToRevenueRatioMedian: number | null
  /** 合同负债/营收比值中位数 */
  contractLiabilityRatioMedian: number | null
  /** 固定资产周转率中位数（次/年） */
  fixedAssetTurnoverMedian: number | null
  /** CR5 市值集中度 */
  marketCapCr5: number | null
  /** CR10 市值集中度 */
  marketCapCr10: number | null
  /** 龙头净利率（前25%分位） */
  top25NetMargin: number | null
  /** 尾部净利率（后25%分位） */
  bottom25NetMargin: number | null
  /** 毛利率分化度 */
  grossMarginDispersion: number | null
}

// ============================================================
// 行业轮动信号（v2.9.5 新增）
// ============================================================

/** 轮动信号类型 */
export type RotationSignalType =
  | 'strong_buy'
  | 'buy'
  | 'hold'
  | 'reduce'
  | 'strong_reduce'
  | 'observe'

/** 行业轮动信号 */
export interface IndustryRotationSignal {
  industryCode: string
  industryName: string
  signal: RotationSignalType
  signalStrength: number
  compositeScore: number
  scores: {
    v4: number | null
    trend: number | null
    valuation: number | null
    momentum: number | null
  }
  rationale: string
  risks: string[]
  generatedAt: number
}
