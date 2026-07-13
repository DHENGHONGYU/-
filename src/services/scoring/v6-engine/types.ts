/**
 * V6 评分引擎类型层
 *
 * 定义 LayerInput、LayerScore、CompositeScore、AuditTrail 等核心类型。
 */

import type { Stock, DailyQuotes } from '@/data/types'
import type { ChipLevel, V6ScoreEngineConfig, LayerId } from '@/types/modules/engine.types'

// Re-export types for backward compatibility
export type { LayerId } from '@/types/modules/engine.types'

/** 所有层 ID 常量 */
export const ALL_LAYER_IDS: LayerId[] = [
  'lMinus1', 'l0', 'l1', 'l2', 'l3f', 'l3v', 'l4', 'l5', 'l6', 'l7', 'l8',
]

/** 层标签映射 */
export const LAYER_LABELS: Record<LayerId, string> = {
  lMinus1: 'L-1 行业评分估值',
  l0: 'L0 STEEP 宏观扫描',
  l1: 'L1 护城河分析',
  l2: 'L2 竞品格局',
  l3f: 'L3a 财务健康',
  l3v: 'L3b 估值水平',
  l4: 'L4 情景推演',
  l5: 'L5 T-M 矩阵',
  l6: 'L6 Hype 周期',
  l7: 'L7 第二曲线',
  l8: 'L8 技术筹码',
}

// ============================================================
// 基础数据输入
// ============================================================

/** 股票基础数据 */
export interface StockBasicData {
  symbol: string
  name: string
  sector?: string
  price?: number
  marketCap?: number
  pe?: number
  pb?: number
  roe?: number
  eps?: number
  peg?: number
}

/** 财务数据 */
export interface FinancialData {
  /** 营业收入（亿元） */
  revenue?: number
  /** 营收同比增速 */
  revenueYoY?: number
  /** 归母净利润（亿元） */
  netProfit?: number
  /** 净利润同比增速 */
  netProfitYoY?: number
  /** 毛利率 */
  grossMargin?: number
  /** 净利率 */
  netMargin?: number
  /** 经营现金流（亿元） */
  operatingCF?: number
  /** 研发费用占比 */
  rdRatio?: number
  /** 应收账款（亿元） */
  receivables?: number
  /** 存货周转天数 */
  inventoryTurnoverDays?: number
  /** 有息负债（亿元） */
  interestBearingDebt?: number
  /** 商誉（亿元） */
  goodwill?: number
  /** 净资产 */
  netAssets?: number
  /** 在手订单（亿元） */
  ordersInHand?: number
  /** 新签订单（亿元） */
  newOrders?: number
  /** 大股东质押比例 */
  shareholderPledge?: number
  /** 客户集中度 TOP5 */
  customerConcentration?: number
  /** 审计意见 */
  auditOpinion?: string
}

/** K线/行情数据 */
export interface QuoteData {
  /** 最新收盘价 */
  latestClose?: number
  /** 20日收益率 */
  return20d?: number
  /** 20日波动率 */
  volatility20d?: number
  /** 20日均换手率 */
  avgTurnover20d?: number
  /** 60日收益率 */
  return60d?: number
  /** 历史收盘价序列 */
  history?: number[]
  /** 历史成交量序列 */
  volumeHistory?: number[]
}

/** 行业评分数据（来自 L-1 映射） */
export interface IndustryScoreData {
  /** 行业名称 */
  sectorName: string
  /** SKILL-C 四维评级总分 */
  skillCScore: number
  /** SKILL-C 评级 */
  skillCRating: string
  /** SKILL-N 六维板块总分 */
  skillNScore: number
  /** 关联度系数 */
  relevance: number
  /** SKILL-N 配置建议 */
  allocationBias?: string
}

/** 0-1 事件数据 */
export interface ZeroToOneEvent {
  /** 事件类型 */
  type: string
  /** 事件描述 */
  description: string
  /** 发生日期 */
  date: string
  /** MCE 指数 */
  mce?: number
  /** 距今月数 */
  monthsAgo: number
}

// ============================================================
// 各层输入
// ============================================================

export interface LayerInput {
  /** 股票基础数据 */
  stock: StockBasicData
  /** 财务数据 */
  financials: FinancialData
  /** K线数据 */
  quotes: QuoteData
  /** 行业评分数据（L-1 专用） */
  industryScore?: IndustryScoreData
  /** 0-1 事件列表（L3 IPC 专用） */
  zeroToOneEvents?: ZeroToOneEvent[]
  /** 引擎配置 */
  config: V6ScoreEngineConfig
}

// ============================================================
// 各层输出
// ============================================================

/** 单层评分 */
export interface LayerScore {
  /** 层 ID */
  layerId: LayerId
  /** 层名称 */
  layerName: string
  /** 层得分（0-5） */
  score: number
  /** 评分摘要 */
  summary: string
  /** 风险列表 */
  risks: string[]
  /** 引用的证据 */
  evidence: string[]
  /** 权重 */
  weight: number
  /** 加权得分 */
  weightedScore: number
  /** 数据来源 */
  dataSources: string[]
  /** 审计追踪 */
  auditTrail?: AuditEntry[]
}

/** 综合评分 */
export interface CompositeScore {
  /** 综合得分（0-5） */
  score: number
  /** 评级 */
  rating: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
  /** 各层明细 */
  layers: Record<LayerId, LayerScore>
  /** 所有风险汇总 */
  allRisks: string[]
  /** 投资建议 */
  recommendation: string
  /** 计算时间戳 */
  timestamp: number
  /** 引擎版本 */
  engineVersion: string
  /** 置信度 */
  confidence?: {
    ess: number          // 证据充分度分数
    level: string        // 七级置信度
    dataSources: Record<string, string> // 数据来源->分级
  }
  /** 被跳过的层列表（数据缺失导致未参与计算） */
  skippedLayers?: LayerId[]
  /** 数据覆盖率（0-1，参与计算的层数 / 总层数） */
  coverageRate?: number
}

// ============================================================
// 审计追踪
// ============================================================

/** 审计条目 */
export interface AuditEntry {
  /** 时间戳 */
  timestamp: number
  /** 层 ID */
  layerId: LayerId
  /** 步骤 */
  step: string
  /** 输入值 */
  input: Record<string, unknown>
  /** 输出值 */
  output: Record<string, unknown>
  /** 所用公式 */
  formula?: string
  /** 数据来源 */
  dataSource?: string
}

/** 单因子对综合评分的贡献明细 */
export interface FactorContribution {
  /** 层/因子 ID */
  factorId: LayerId
  /** 展示名称 */
  label: string
  /** 原始权重（来自引擎配置） */
  weight: number
  /** 归一化有效权重（参与计算的权重 / 总权重） */
  normalizedWeight: number
  /** 该因子原始层得分（0-5 分制） */
  score: number
  /** 中性基准分（来自阈值 layerScore 中点） */
  baseline: number
  /** 因子对最终 0-100 综合分的绝对贡献值 */
  contribution: number
  /** 相对于中性基准的 signed 贡献（正向/负向） */
  signedContribution: number
  /** 该因子贡献占最终得分的比例（0-1） */
  contributionRate: number
}

/** 审计追踪集合 */
export interface ScoreAuditTrail {
  symbol: string
  timestamp: number
  config: V6ScoreEngineConfig
  layers: Record<LayerId, AuditEntry[]>
  composite: {
    weightedSum: number
    layers: Record<LayerId, number>
    rating: string
  }
  /** 各因子贡献明细（由 audit() 根据实际权重与阈值计算） */
  factorContributions: FactorContribution[]
}

// ============================================================
// 计算器接口
// ============================================================

/** 层计算器接口 */
export interface LayerCalculator {
  /** 层 ID */
  readonly layerId: LayerId
  /** 计算层得分 */
  calculate(input: LayerInput): Promise<LayerScore>
}

// ============================================================
// 风险预警结果
// ============================================================

export interface RiskWarningResult {
  /** 红色预警触发的数量 */
  redCount: number
  /** 黄色预警触发的数量 */
  yellowCount: number
  /** 红色预警详情 */
  redDetails: string[]
  /** 黄色预警详情 */
  yellowDetails: string[]
}

// ============================================================
// IPC 临界点结果
// ============================================================

export interface IPCResult {
  /** OCR 得分 */
  ocrScore: number
  /** MCE 得分 */
  mceScore: number
  /** TIMS 得分 */
  timsScore: number
  /** IPC 综合得分 */
  ipcScore: number
  /** 临界点阶段 */
  stage: 'broken' | 'near' | 'before' | 'far' | 'none'
  /** 阶段描述 */
  stageLabel: string
  /** L3 加分 */
  l3Bonus: number
}

// ============================================================
// 筹码变化度结果
// ============================================================

export interface ChipResult {
  /** 八级指标得分 */
  levels: Record<ChipLevel, number | null>
  /** 综合筹码得分 */
  score: number
  /** 筹码博弈态势 */
  matrix: string
  /** 风险等级 */
  riskLevel: 'low' | 'medium' | 'high'
}

// ============================================================
// 应用层输入（简化版）
// ============================================================

/** 简化版引擎输入，自动从 Stock + DailyQuotes 构建 */
export interface V6ScoreInput {
  symbol: string
  /** 基础数据 */
  stock: StockBasicData
  /** 财务数据 */
  financials: FinancialData
  /** K线数据 */
  quotes: QuoteData
  /** 行业评分（可选，L-1 用） */
  industryScore?: IndustryScoreData
  /** 0-1 事件（可选，IPC 用） */
  zeroToOneEvents?: ZeroToOneEvent[]
}

// ============================================================
// 数据适配函数：Stock / DailyQuotes → 引擎输入
// ============================================================

/**
 * 将 dataLayer 的 Stock 适配为引擎 StockBasicData
 *
 * 仅提取引擎关心的基础字段；缺失字段保持 undefined，由各层计算器自行降级。
 */
export function stockToBasicData(stock: Stock): StockBasicData {
  return {
    symbol: stock.symbol,
    name: stock.name,
    price: stock.price,
    pe: stock.pe,
    pb: stock.pb,
    roe: stock.roe,
    marketCap: stock.marketCap,
    sector: stock.industryCode,
  }
}

/**
 * 安全计算收益率，避免除以零或 undefined。
 * 将 `past !== undefined && past !== 0 && latestClose !== undefined` 收敛到单一位置。
 */
function safeReturn(past: number | undefined, latestClose: number | undefined): number | undefined {
  if (past === undefined || past === 0 || latestClose === undefined) {
    return undefined
  }
  return (latestClose - past) / past
}

/**
 * 将 dataLayer 的 DailyQuotes 适配为引擎 QuoteData
 *
 * 计算 20/60 日收益率、20 日波动率与平均换手率；历史数据不足时字段保持 undefined。
 */
export function quotesToQuoteData(quotes: DailyQuotes): QuoteData {
  const history = quotes.history
  const latestBar = history[history.length - 1]
  const latestClose = latestBar?.close

  // 20 日收益率
  let return20d: number | undefined
  if (history.length >= 21) {
    const past = history[history.length - 20 - 1]?.close
    return20d = safeReturn(past, latestClose)
  }

  // 60 日收益率
  let return60d: number | undefined
  if (history.length >= 61) {
    const past = history[history.length - 60 - 1]?.close
    return60d = safeReturn(past, latestClose)
  }

  // 20 日波动率（日收益标准差）
  let volatility20d: number | undefined
  if (history.length >= 20) {
    const returns: number[] = []
    for (let i = history.length - 20; i < history.length; i++) {
      const prev = history[i - 1]?.close
      const curr = history[i]?.close
      if (prev === undefined || prev === 0 || curr === undefined) continue
      returns.push((curr - prev) / prev)
    }
    if (returns.length > 0) {
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length
      const variance =
        returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length
      volatility20d = Math.sqrt(variance)
    }
  }

  return {
    latestClose,
    return20d,
    return60d,
    volatility20d,
    history: history.map((bar) => bar.close),
    volumeHistory: history.map((bar) => bar.volume),
  }
}