/**
 * @module strategyDataAdapter
 * @lifecycle @Global
 * @description 策略数据适配器。将外部 API 返回的原始数据转换为策略引擎所需的标准输入格式。
 *
 * 适配映射：
 * - adaptToHotSector:  腾讯API（板块资金流向） → HotSectorAnalyzerInput
 * - adaptToValuePit:   东财API（个股估值数据） → ValuePitAnalyzerInput
 * - adaptToRotation:   量价数据（K线+资金流） → RotationSignalInput
 *
 * @compliance
 * - 所有适配器必须包含数据格式转换的单元测试
 * - 禁止绕过 DataBridge 直接调用数据源
 * - 遵循现有 TypeScript 类型安全约束
 */

import type { HotSectorAnalyzerInput, MomentumInput, SentimentInput, BreakoutInput, ValuationRiskInput, MarketEnvInput } from '@/services/scoring/hotSectorAnalyzer'
import type { RotationSignalInput } from '@/services/scoring/rotationSignalDetector'
import type { ValuePitAnalyzerInput } from '@/services/scoring/valuePitAnalyzer'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// DefaultValue 映射（A 类根治：防止 API 脏数据流入 UI）
// ============================================================

/** 各维度默认值常量（API 字段缺失时使用） */
const SENTIMENT_DEFAULTS: SentimentInput = {
  sentimentRank: 0,
  retailSentiment: 0,
  institutionBuyCount: 0,
  limitUpCount: 0,
}

const MOMENTUM_DEFAULTS: MomentumInput = {
  sectorStrengthScore: 0,
  priceChangeRank: 0,
  volumeExpansion: 0,
  consecutiveInflow: 0,
  relativeStrength: 0,
}

const BREAKOUT_DEFAULTS: BreakoutInput = {
  hasBreakoutPattern: false,
  rsiSignal: 'neutral',
  rsi: 50,
  priceAboveMA20: false,
  priceAboveMA60: false,
}

const VALUATION_RISK_DEFAULTS: ValuationRiskInput = {
  pe: 0,
  pbPercentile: 0,
  marketCap: 0,
  dividendYield: 0,
}

const MARKET_ENV_DEFAULTS: MarketEnvInput = {
  marketTrend: 'sideways',
  systemicRisk: 'medium',
}

/**
 * 将任意值强制转为 number，无效值返回 0。
 * 防止 API 返回字符串/null/undefined 等脏数据。
 * @internal 暴露用于单元测试
 */
export function toSafeNumber(value: unknown, defaultValue = 0): number {
  if (value === null || value === undefined || value === '') return defaultValue
  const num = Number(value)
  return Number.isFinite(num) ? num : defaultValue
}

/**
 * 将任意值强制转为指定枚举值，无效值返回默认值。
 * @internal 暴露用于单元测试
 */
export function toSafeEnum<T extends string>(value: unknown, allowed: readonly T[], defaultValue: T): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T
  }
  return defaultValue
}

/**
 * 将任意值强制转为 boolean，无效值返回默认值。
 * @internal 暴露用于单元测试
 */
export function toSafeBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === 'true' || value === 1) return true
  if (value === 0 || value === 'false' || value === 0) return false
  return defaultValue
}

/**
 * 规范化 sentiment 数据：补全缺失字段，强制类型转换。
 * 用户报告的 API 返回 {"sentiment": {"sentimentRank": 10, "retailSentiment": 0.4}}
 * 缺少 institutionBuyCount / limitUpCount，此处补全为 0。
 * @internal 暴露用于单元测试
 */
export function normalizeSentiment(raw: unknown): SentimentInput {
  if (!raw || typeof raw !== 'object') return { ...SENTIMENT_DEFAULTS }
  const r = raw as Record<string, unknown>
  return {
    sentimentRank: toSafeNumber(r.sentimentRank, SENTIMENT_DEFAULTS.sentimentRank),
    retailSentiment: toSafeNumber(r.retailSentiment, SENTIMENT_DEFAULTS.retailSentiment),
    institutionBuyCount: toSafeNumber(r.institutionBuyCount, SENTIMENT_DEFAULTS.institutionBuyCount),
    limitUpCount: toSafeNumber(r.limitUpCount, SENTIMENT_DEFAULTS.limitUpCount),
  }
}

/** @internal 暴露用于单元测试 */
export function normalizeMomentum(raw: unknown): MomentumInput {
  if (!raw || typeof raw !== 'object') return { ...MOMENTUM_DEFAULTS }
  const r = raw as Record<string, unknown>
  return {
    sectorStrengthScore: toSafeNumber(r.sectorStrengthScore, MOMENTUM_DEFAULTS.sectorStrengthScore),
    priceChangeRank: toSafeNumber(r.priceChangeRank, MOMENTUM_DEFAULTS.priceChangeRank),
    volumeExpansion: toSafeNumber(r.volumeExpansion, MOMENTUM_DEFAULTS.volumeExpansion),
    consecutiveInflow: toSafeNumber(r.consecutiveInflow, MOMENTUM_DEFAULTS.consecutiveInflow),
    relativeStrength: toSafeNumber(r.relativeStrength, MOMENTUM_DEFAULTS.relativeStrength),
  }
}

/** @internal 暴露用于单元测试 */
export function normalizeBreakout(raw: unknown): BreakoutInput {
  if (!raw || typeof raw !== 'object') return { ...BREAKOUT_DEFAULTS }
  const r = raw as Record<string, unknown>
  return {
    hasBreakoutPattern: toSafeBoolean(r.hasBreakoutPattern, BREAKOUT_DEFAULTS.hasBreakoutPattern),
    rsiSignal: toSafeEnum(r.rsiSignal, ['bullish', 'bearish', 'neutral'] as const, BREAKOUT_DEFAULTS.rsiSignal),
    rsi: toSafeNumber(r.rsi, BREAKOUT_DEFAULTS.rsi),
    priceAboveMA20: toSafeBoolean(r.priceAboveMA20, BREAKOUT_DEFAULTS.priceAboveMA20),
    priceAboveMA60: toSafeBoolean(r.priceAboveMA60, BREAKOUT_DEFAULTS.priceAboveMA60),
  }
}

/** @internal 暴露用于单元测试 */
export function normalizeValuationRisk(raw: unknown): ValuationRiskInput {
  if (!raw || typeof raw !== 'object') return { ...VALUATION_RISK_DEFAULTS }
  const r = raw as Record<string, unknown>
  return {
    pe: toSafeNumber(r.pe, VALUATION_RISK_DEFAULTS.pe),
    pbPercentile: toSafeNumber(r.pbPercentile, VALUATION_RISK_DEFAULTS.pbPercentile),
    marketCap: toSafeNumber(r.marketCap, VALUATION_RISK_DEFAULTS.marketCap),
    dividendYield: toSafeNumber(r.dividendYield, VALUATION_RISK_DEFAULTS.dividendYield),
  }
}

/** @internal 暴露用于单元测试 */
export function normalizeMarketEnv(raw: unknown): MarketEnvInput {
  if (!raw || typeof raw !== 'object') return { ...MARKET_ENV_DEFAULTS }
  const r = raw as Record<string, unknown>
  return {
    marketTrend: toSafeEnum(r.marketTrend, ['bull', 'bear', 'sideways'] as const, MARKET_ENV_DEFAULTS.marketTrend),
    systemicRisk: toSafeEnum(r.systemicRisk, ['low', 'medium', 'high'] as const, MARKET_ENV_DEFAULTS.systemicRisk),
  }
}

// ============================================================
// 外部 API 原始数据类型
// ============================================================

/** 腾讯API：板块资金流向原始数据 */
export interface TencentSectorFlowRaw {
  /** 板块代码 */
  code: string
  /** 板块名称 */
  name: string
  /** 板块强度 0-5 */
  strength: number
  /** 涨跌幅排名 */
  changeRank: number
  /** 量比（近5日/近20日） */
  volumeRatio: number
  /** 主力净流入天数 */
  mainInflowDays: number
  /** 相对强弱 RS */
  rs: number
  /** 舆情热度排名 */
  heatRank: number
  /** 散户情绪指标 0-1 */
  retailIndex: number
  /** 机构买入家数 */
  instBuyCount: number
  /** 涨停家数 */
  limitUpCount: number
  /** 突破形态标记 */
  breakout: boolean
  /** MACD 信号 */
  macd: 'bullish' | 'bearish' | 'neutral'
  /** RSI(14) */
  rsi: number
  /** 价格 > MA20 */
  aboveMA20: boolean
  /** 价格 > MA60 */
  aboveMA60: boolean
  /** 市盈率 */
  pe: number
  /** 市净率分位 */
  pbPercentile: number
  /** 市值（亿元） */
  mktCap: number
  /** 股息率 % */
  divYield: number
  /** 大盘趋势 */
  trend: 'bull' | 'bear' | 'sideways'
  /** 系统性风险 */
  risk: 'low' | 'medium' | 'high'
}

/** 东财API：个股估值数据原始数据 */
export interface EastMoneyValuationRaw {
  /** 股票代码 */
  code: string
  /** 股票名称 */
  name: string
  /** 政策利好评分 0-5 */
  policyScore: number
  /** 周期位置评分 0-5 */
  cycleScore: number
  /** 技术突破评分 0-5 */
  techScore: number
  /** 订单增长评分 0-5 */
  orderScore: number
  /** PE 历史分位 */
  pePct: number
  /** PB 历史分位 */
  pbPct: number
  /** 股息率 % */
  divYield: number
  /** PEG */
  peg: number
  /** 北向持股变化 % */
  northChange: number
  /** 基金持仓变化 % */
  fundChange: number
  /** 股东户数变化 % */
  holderChange: number
  /** 板块成交量分位 */
  sectorVolPct: number
  /** 资金流入强度 0-5 */
  inflowStrength: number
  /** 金叉标记 */
  goldenCross: boolean
  /** 日均成交额（万元） */
  avgAmount: number
  /** 换手率 % */
  turnover: number
  /** 市值（亿元） */
  mktCap: number
}

/** 量价数据：K线+资金流原始数据 */
export interface PriceVolumeRaw {
  /** 板块/股票ID */
  id: string
  /** 历史成交量序列 */
  volumes: number[]
  /** 每日资金净流入序列 */
  netFlows: number[]
  /** 收盘价序列 */
  closes: number[]
}

// ============================================================
// 适配器函数
// ============================================================

/**
 * 腾讯API → HotSectorAnalyzerInput
 * 将板块资金流向原始数据映射为热门板块五维评分引擎所需输入。
 *
 * A 类根治：通过 normalize 函数补全缺失字段，防止 API 脏数据流入 UI。
 * 即使 raw 中某些字段为 undefined/null/字符串，也能安全转换为合法类型。
 */
export function adaptToHotSector(raw: TencentSectorFlowRaw): HotSectorAnalyzerInput {
  logger.info(`[strategyDataAdapter] adaptToHotSector: ${raw.code} ${raw.name}`)

  // 将 raw 字段重新组织为维度对象后，通过 normalize 补全缺失字段
  const sentimentRaw = {
    sentimentRank: raw.heatRank,
    retailSentiment: raw.retailIndex,
    institutionBuyCount: raw.instBuyCount,
    limitUpCount: raw.limitUpCount,
  }
  const momentumRaw = {
    sectorStrengthScore: raw.strength,
    priceChangeRank: raw.changeRank,
    volumeExpansion: raw.volumeRatio,
    consecutiveInflow: raw.mainInflowDays,
    relativeStrength: raw.rs,
  }
  const breakoutRaw = {
    hasBreakoutPattern: raw.breakout,
    // P0-08: BreakoutInput.macdSignal 重命名为 rsiSignal（实际按 RSI 阈值推导）
    // 后端 raw.macd 信号方向与 RSI 信号方向语义一致，直接映射
    rsiSignal: raw.macd,
    rsi: raw.rsi,
    priceAboveMA20: raw.aboveMA20,
    priceAboveMA60: raw.aboveMA60,
  }
  const valuationRiskRaw = {
    pe: raw.pe,
    pbPercentile: raw.pbPercentile,
    marketCap: raw.mktCap,
    dividendYield: raw.divYield,
  }
  const marketEnvRaw = {
    marketTrend: raw.trend,
    systemicRisk: raw.risk,
  }

  return {
    symbol: raw.code,
    sectorName: raw.name,
    momentum: normalizeMomentum(momentumRaw),
    sentiment: normalizeSentiment(sentimentRaw),
    breakout: normalizeBreakout(breakoutRaw),
    valuationRisk: normalizeValuationRisk(valuationRiskRaw),
    marketEnv: normalizeMarketEnv(marketEnvRaw),
  }
}

/**
 * 东财API → ValuePitAnalyzerInput
 * 将个股估值数据原始数据映射为价值洼地五维评分引擎所需输入。
 */
export function adaptToValuePit(raw: EastMoneyValuationRaw): ValuePitAnalyzerInput {
  logger.info(`[strategyDataAdapter] adaptToValuePit: ${raw.code} ${raw.name}`)

  return {
    symbol: raw.code,
    sectorName: raw.name,
    catalyst: {
      policyCatalyst: raw.policyScore,
      cycleTurningPoint: raw.cycleScore,
      techBreakthrough: raw.techScore,
      orderSurge: raw.orderScore,
    },
    valuationMargin: {
      pePercentile: raw.pePct,
      pbPercentile: raw.pbPct,
      dividendYield: raw.divYield,
      peg: raw.peg,
    },
    chipStructure: {
      northBoundChange: raw.northChange,
      fundPositionChange: raw.fundChange,
      shareholderChange: raw.holderChange,
    },
    rotationPosition: {
      sectorVolumePercentile: raw.sectorVolPct,
      capitalInflowStrength: raw.inflowStrength,
      hasGoldenCross: raw.goldenCross,
    },
    liquidity: {
      avgDailyAmount: raw.avgAmount,
      turnoverRate: raw.turnover,
      marketCap: raw.mktCap,
    },
  }
}

/**
 * 量价数据 → RotationSignalInput
 * 将K线+资金流原始数据映射为轮动信号检测器所需输入。
 */
export function adaptToRotation(raw: PriceVolumeRaw): RotationSignalInput {
  logger.info(`[strategyDataAdapter] adaptToRotation: ${raw.id}`)

  return {
    sectorId: raw.id,
    volume: {
      history: raw.volumes,
    },
    capitalFlow: {
      dailyNetFlow: raw.netFlows,
    },
    goldenCross: {
      closes: raw.closes,
    },
  }
}

/**
 * 批量适配腾讯API数据。
 */
export function adaptBatchToHotSector(rawList: TencentSectorFlowRaw[]): HotSectorAnalyzerInput[] {
  logger.info(`[strategyDataAdapter] adaptBatchToHotSector: ${rawList.length} items`)
  return rawList.map(adaptToHotSector)
}

/**
 * 规范化直接从 API 拿到的 HotSectorAnalyzerInput 结构（部分字段可能缺失）。
 *
 * 使用场景：当调用方直接持有 HotSectorAnalyzerInput 形态的数据（非 TencentSectorFlowRaw），
 * 例如从 IndexedDB 读取历史数据、或 API 返回的 JSON 结构与 HotSectorAnalyzerInput 一致但字段不全。
 *
 * 用户报告的脏数据示例：
 * ```json
 * {"sentiment": {"sentimentRank": 10, "retailSentiment": 0.4}}
 * ```
 * 调用本函数后 sentiment 将被补全为：
 * ```json
 * {"sentimentRank": 10, "retailSentiment": 0.4, "institutionBuyCount": 0, "limitUpCount": 0}
 * ```
 */
export function normalizeHotSectorInput(raw: unknown): HotSectorAnalyzerInput {
  if (!raw || typeof raw !== 'object') {
    logger.warn('[strategyDataAdapter] normalizeHotSectorInput: raw 非对象，返回零值默认输入')
    return {
      symbol: '',
      sectorName: '',
      momentum: { ...MOMENTUM_DEFAULTS },
      sentiment: { ...SENTIMENT_DEFAULTS },
      breakout: { ...BREAKOUT_DEFAULTS },
      valuationRisk: { ...VALUATION_RISK_DEFAULTS },
      marketEnv: { ...MARKET_ENV_DEFAULTS },
    }
  }
  const r = raw as Record<string, unknown>
  return {
    symbol: typeof r.symbol === 'string' ? r.symbol : toSafeString(r.symbol),
    sectorName: typeof r.sectorName === 'string' ? r.sectorName : toSafeString(r.sectorName),
    momentum: normalizeMomentum(r.momentum),
    sentiment: normalizeSentiment(r.sentiment),
    breakout: normalizeBreakout(r.breakout),
    valuationRisk: normalizeValuationRisk(r.valuationRisk),
    marketEnv: normalizeMarketEnv(r.marketEnv),
  }
}

/**
 * 批量适配东财API数据。
 */
export function adaptBatchToValuePit(rawList: EastMoneyValuationRaw[]): ValuePitAnalyzerInput[] {
  logger.info(`[strategyDataAdapter] adaptBatchToValuePit: ${rawList.length} items`)
  return rawList.map(adaptToValuePit)
}

/**
 * 批量适配量价数据。
 */
export function adaptBatchToRotation(rawList: PriceVolumeRaw[]): RotationSignalInput[] {
  logger.info(`[strategyDataAdapter] adaptBatchToRotation: ${rawList.length} items`)
  return rawList.map(adaptToRotation)
}