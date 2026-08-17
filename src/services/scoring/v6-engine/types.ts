/**
 * V6 评分引擎类型层
 *
 * 定义 LayerInput、LayerScore、CompositeScore、AuditTrail 等核心类型。
  * @doc [V9-DOC-PROJ-066, V9-DOC-PROJ-053, V9-DOC-PROJ-113, V9-DOC-ARCH-008, V9-DOC-FRONT-012]
*/

import type { Stock, DailyQuotes } from '@/data/types'
import type { ChipLevel, V6ScoreEngineConfig, LayerId } from '@/types/modules/engine.types'
import type { ChipDistribution } from './calculators/chipDistribution'

// Re-export types for backward compatibility
export type { LayerId } from '@/types/modules/engine.types'
export type { ChipDistribution, PriceBucket } from './calculators/chipDistribution'

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
  /** 数据完整度状态：完整 / 部分缺失 / 完全缺失 */
  dataStatus?: 'complete' | 'partial' | 'missing'
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
  /** v4.4 量比（当日成交量 / 过去5日均量） */
  volumeRatio?: number
  /** v4.4 20日换手率标准差 */
  turnover20dStd?: number
  /** v4.4 最近一日涨跌幅 */
  latestReturn1d?: number
  /** 60日收益率 */
  return60d?: number
  /** 历史收盘价序列 */
  history?: number[]
  /** 历史成交量序列 */
  volumeHistory?: number[]
  /** 最近多期股东人数（期末，单位：户） */
  shareholderCount?: number[]
  /** 最近多期北向/陆股通持股（万股） */
  northboundHoldings?: number[]
  /** 最近多期主力资金净流入（亿元） */
  mainForceFlow?: number[]
  /** 最近多期融资余额（亿元） */
  marginBalance?: number[]
  /** ★ v4.5.4 当日成交金额（元），用于蓝筹股豁免低流动性拦截 */
  dailyTurnoverAmount?: number
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

// ── P0-1: 维度 15 分红股本数据 ──

/** 分红记录 */
export interface DividendRecord {
  /** 除权除息日 */
  exDividendDate: string
  /** 每股派息（税前，元） */
  cashDividendPerShare: number
  /** 每股送股 */
  bonusShareRatio: number
  /** 每股转增 */
  transferShareRatio: number
}

/** 分红股本摘要数据（维度 15，用于 L3v 估值层） */
export interface DividendShareData {
  /** 近 12 个月股息率（%） */
  dividendYield: number
  /** 近 3 年累计分红金额（亿元） */
  totalDividend3Y: number
  /** 近 3 年分红率（%） */
  payoutRatio3Y: number
  /** 历史分红记录（近 5 年） */
  history: DividendRecord[]
  /** 总股本（亿股） */
  totalShares: number
  /** 流通股本（亿股） */
  floatShares: number
  /** 下一批限售股解禁数量（亿股） */
  nextUnlockShares?: number
}

// ── P0-1: 维度 16 一致预期与评级数据 ──

/** 一致预期单年数据 */
export interface ConsensusEstimateRecord {
  /** 预测年度 */
  fiscalYear: number
  /** 预测营收（亿元） */
  revenueEstimate: number
  /** 预测净利润（亿元） */
  netProfitEstimate: number
  /** 预测 EPS（元） */
  epsEstimate: number
  /** 分析师数量 */
  analystCount: number
}

/** 评级汇总数据 */
export interface RatingSummaryData {
  /** 买入评级数 */
  buyCount: number
  /** 增持评级数 */
  overweightCount: number
  /** 持有评级数 */
  holdCount: number
  /** 减持/卖出评级数 */
  underweightSellCount: number
  /** 综合评级（1-5，1=强力买入） */
  consensusRating: number
  /** 综合目标价（元） */
  consensusTargetPrice: number
  /** 最近评级变化趋势 */
  recentTrend: 'upgrade' | 'downgrade' | 'stable'
}

/** 一致预期与评级完整数据（维度 16，用于 L3v/L4 层） */
export interface ConsensusData {
  /** 未来 3 年一致预期 */
  estimates: ConsensusEstimateRecord[]
  /** 评级汇总 */
  rating: RatingSummaryData
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
  /** L1/L2 层得分（L3a IPC 跨层推理用） */
  peerScores?: {
    l1?: number
    l2?: number
  }
  /** P0-1: 分红股本数据（维度 15，L3v DDM 折价因子用） */
  dividend?: DividendShareData
  /** P0-1: 一致预期与评级数据（维度 16，L3v/L4 预期差因子用） */
  consensus?: ConsensusData
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
  /** 该层是否真实参与综合评分（P0：区分"数据缺失消毒为0"与"真实计算"） */
  participated?: boolean
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
  /** 交叉验证结果（P2-5） */
  crossValidation?: {
    passed: boolean
    issues: Array<{
      ruleId: string
      severity: 'info' | 'warning' | 'critical'
      title: string
      description: string
    }>
  }
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
  /** 十一级指标得分（含 PAS 穿透率 + BIAS 乖离率 + PRO 获利盘比例） */
  levels: Record<ChipLevel, number | null>
  /** 综合筹码得分 */
  score: number
  /** 筹码博弈态势 */
  matrix: string
  /** 风险等级 */
  riskLevel: 'low' | 'medium' | 'high'
  /** 筹码分布（有历史数据时填充，proxy 模式为 null） */
  distribution?: ChipDistribution | null
  /** 穿透率原始值（正=向上穿透，负=向下穿透，null=无数据） */
  pas?: number | null
  /** 乖离率原始值（正=股价高于筹码重心，负=低于，null=无数据） */
  bias?: number | null
  /** 获利盘比例原始值（0-1，null=无数据） */
  profitRatio?: number | null
  /** 止盈预警标记（获利盘 > 80% 且 MATRIX ≥ 3.5 时触发） */
  takeProfitWarning?: boolean
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

  // 20 日均换手率（仅当有 turnoverRate 数据时计算）
  let avgTurnover20d: number | undefined
  let turnover20dStd: number | undefined
  if (history.length >= 20) {
    const turnovers: number[] = []
    for (let i = history.length - 20; i < history.length; i++) {
      const t = history[i]?.turnoverRate
      if (typeof t === 'number' && Number.isFinite(t)) {
        turnovers.push(t)
      }
    }
    if (turnovers.length >= 10) {
      avgTurnover20d = turnovers.reduce((a, b) => a + b, 0) / turnovers.length
      const tMean = avgTurnover20d
      const tVariance = turnovers.reduce((s, t) => s + (t - tMean) ** 2, 0) / turnovers.length
      turnover20dStd = Math.sqrt(tVariance)
    }
  }

  // v4.4 量比 + 最近一日涨跌幅
  let volumeRatio: number | undefined
  let latestReturn1d: number | undefined
  if (history.length >= 6) {
    const latestVol = latestBar?.volume
    const latestCloseVal = latestBar?.close
    const prevClose = history[history.length - 2]?.close
    const past5Vols: number[] = []
    for (let i = history.length - 6; i < history.length - 1; i++) {
      const v = history[i]?.volume
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) past5Vols.push(v)
    }
    if (past5Vols.length >= 3 && typeof latestVol === 'number' && latestVol > 0) {
      volumeRatio = latestVol / (past5Vols.reduce((a, b) => a + b, 0) / past5Vols.length)
    }
    if (typeof latestCloseVal === 'number' && typeof prevClose === 'number' && prevClose > 0) {
      latestReturn1d = (latestCloseVal - prevClose) / prevClose
    }
  }

  return {
    latestClose,
    return20d,
    return60d,
    volatility20d,
    avgTurnover20d,
    volumeRatio,
    turnover20dStd,
    latestReturn1d,
    history: history.map((bar) => bar.close),
    volumeHistory: history.map((bar) => bar.volume),
  }
}

// ============================================================
// 换手率-量比协同分析结果 (v4.4/v4.5)
// ============================================================

export type TVRLevel = 'ACT' | 'VRL' | 'SYG' | 'CN' | 'AS' | 'DV' | 'BC' | 'ES' | 'TVR'

export type MainForceChipFlowType =
  | 'accumulation' | 'probing' | 'lockup' | 'pullup'
  | 'distribution' | 'washout' | 'fakeup' | 'neutral'

export type ChipFlowDirection = 'inflow' | 'outflow' | 'lock' | 'neutral'

/**
 * ★ v4.6 新增：断线交易风格（基于 换手率 × 量比 能量强度判断）
 *
 * 断线交易（Breakout Trading）的核心判断指标 = 换手率 × 量比：
 *   - 换手率：反映筹码松动度（市场关注度、参与者广度）
 *   - 量比：反映资金增量（新钱进场力度，存量博弈 vs 增量进场）
 *   - 乘积 = 能量强度：能量越高，趋势确定性越强，但同时需警惕"死亡换手"
 *
 * 8 种风格映射到不同的交易纪律（仓位上限/止盈止损间距/介入时点）。
 */
export type BreakoutTradeStyle =
  | 'sniper_breakout'    // 狙击型突破：中高换手+极高量比（如4%×5=0.20），能量爆炸=主升浪启动
  | 'momentum_breakout'  // 动量型突破：中高换手+显著放量（如5%×3=0.15），动能充足=追涨安全
  | 'steady_breakout'    // 稳健型突破：中换手+温和放量（如3%×2=0.06），趋势健康=可中线持有
  | 'probe_breakout'     // 试探型突破：低换手+极大量（如2%×6=0.12），试盘前奏=需次日确认
  | 'value_breakout'     // 价值型突破：低换手+温和量（如1.5%×2=0.03），筹码锁定+温和放量=慢牛
  | 'fake_breakout'      // 假突破：高换手+低量比（如8%×1=0.08），存量对倒诱多=必逃
  | 'breakout_watch'     // 观望待突破：极低换手+极低量（如0.5%×0.5=0.0025），抛压枯竭=等放量介入
  | 'no_breakout'        // 无突破特征：其余组合

/**
 * ★ v4.6 新增：换手率 × 量比 能量等级（断线交易核心能量判断）
 *
 * P1-12 分层合规迁移：类型实现已下沉到 src/domain/scoring/energy.ts，
 * 此处 re-export 保持 API 零破坏；能量计算函数 computeTurnoverVolumeEnergy
 * 同样从 domain/scoring/energy 经 l7_l8.ts re-export 对外暴露。
 */
import type { TurnoverVolumeEnergy } from '@/domain/scoring/energy'
export type { TurnoverVolumeEnergy } from '@/domain/scoring/energy'

/**
 * ★ v4.7 资金流向上下文 — 用于假突破二次确认
 *
 * 从 quotes.mainForceFlow / northboundHoldings / marginBalance 提取最新值。
 * 当技术面触发假突破条件（tpct≥8% & v<1.5）但资金面显示主力净流入时，
 * 降级为非假突破，降低误报率。
 */
export interface FundFlowContext {
  /** 主力资金最新净流入（亿元，>0 净流入，<0 净流出） */
  mainForceNet?: number
  /** 北向资金最新净流入（亿元，>0 净流入，<0 净流出） */
  northboundNet?: number
  /** 融资余额最新变动（亿元，>0 增加，<0 减少） */
  marginChange?: number
}

export type TradeSignalType =
  | 'golden_buy' | 'follow_buy' | 'hold' | 'wait' | 'reduce' | 'golden_sell' | 'escape'

export interface TradeSignal {
  type: TradeSignalType
  label: string
  conclusion: string
  indicators: string[]
  dimension: 2 | 3
  confidence: number
}

/** 市场时段标记 ★ v4.5.1 新增（低流动性/盘后特殊处理） */
export type MarketSession =
  | 'trading_hours'    // 交易时间（换手率>=0.5% 或 量比>=0.8）
  | 'low_liquidity'    // 低流动性（换手<0.5% 且 量比<0.8，盘后/午休/冷门股）
  | 'unknown'          // 数据不足无法判断

/**
 * ★ v4.5.3 低流动性拦截原因明细：记录触发拦截的阈值与实际值，
 * 用于调度器日志与后续拦截准确性分析。
 */
export interface LowLiquidityInterceptMeta {
  /** 实际换手率（小数，如 0.003 = 0.3%） */
  turnoverActual: number
  /** 换手率阈值（< 0.5% = 0.005） */
  turnoverThreshold: number
  /** 实际量比 */
  volumeRatioActual: number
  /** 量比阈值（v4.5.4 起 < 0.7） */
  volumeRatioThreshold: number
  /** 中文规则表述 */
  rule: string
  /** 命中时间戳（调度器侧填充，毫秒） */
  timestamp?: number
  /** ★ v4.5.4 当日成交金额（元），蓝筹豁免判定依据 */
  dailyTurnoverAmount?: number
  /** ★ v4.5.4 成交金额豁免阈值（元，默认 3 亿 = 3_0000_0000） */
  dailyTurnoverAmountThreshold?: number
  /** ★ v4.5.4 是否被成交金额豁免放行（true=蓝筹股放行，false/undefined=正常拦截） */
  bypassedByAmount?: boolean
}

export interface MainForceChipFlowSignal {
  type: MainForceChipFlowType
  label: string
  opportunityScore: number
  direction: ChipFlowDirection
  confidence: number
  description: string
  action: string
  tradeSignal: TradeSignal
  /** ★ v4.5.1 市场时段标记（低流动性/盘后特殊处理） */
  marketSession: MarketSession
  /** ★ v4.6 断线交易风格（基于 换手率×量比 核心判断） */
  breakoutStyle: BreakoutTradeStyle
  /** ★ v4.6 换手率×量比 能量强度（断线交易核心能量判断，仓位/止盈/止损硬约束） */
  energy: TurnoverVolumeEnergy
  /** ★ v4.5.3 低流动性拦截触发原因（仅在 marketSession === 'low_liquidity' 时有值） */
  lowLiquidityMeta?: LowLiquidityInterceptMeta
}

export interface TurnoverVolumeSynergyResult {
  levels: Record<TVRLevel, number | null>
  score: number
  activityLabel: string
  volumeRatioLabel: string
  capitalNature: string
  signals: string[]
  riskLevel: 'low' | 'medium' | 'high'
  chipFlow: MainForceChipFlowSignal
}