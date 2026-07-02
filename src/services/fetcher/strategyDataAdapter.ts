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

import type { HotSectorAnalyzerInput } from '@/services/scoring/hotSectorAnalyzer'
import type { RotationSignalInput } from '@/services/scoring/rotationSignalDetector'
import type { ValuePitAnalyzerInput } from '@/services/scoring/valuePitAnalyzer'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

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
 */
export function adaptToHotSector(raw: TencentSectorFlowRaw): HotSectorAnalyzerInput {
  logger.info(`[strategyDataAdapter] adaptToHotSector: ${raw.code} ${raw.name}`)

  return {
    symbol: raw.code,
    sectorName: raw.name,
    momentum: {
      sectorStrengthScore: raw.strength,
      priceChangeRank: raw.changeRank,
      volumeExpansion: raw.volumeRatio,
      consecutiveInflow: raw.mainInflowDays,
      relativeStrength: raw.rs,
    },
    sentiment: {
      sentimentRank: raw.heatRank,
      retailSentiment: raw.retailIndex,
      institutionBuyCount: raw.instBuyCount,
      limitUpCount: raw.limitUpCount,
    },
    breakout: {
      hasBreakoutPattern: raw.breakout,
      // P0-08: BreakoutInput.macdSignal 重命名为 rsiSignal（实际按 RSI 阈值推导）
      // 后端 raw.macd 信号方向与 RSI 信号方向语义一致，直接映射
      rsiSignal: raw.macd,
      rsi: raw.rsi,
      priceAboveMA20: raw.aboveMA20,
      priceAboveMA60: raw.aboveMA60,
    },
    valuationRisk: {
      pe: raw.pe,
      pbPercentile: raw.pbPercentile,
      marketCap: raw.mktCap,
      dividendYield: raw.divYield,
    },
    marketEnv: {
      marketTrend: raw.trend,
      systemicRisk: raw.risk,
    },
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