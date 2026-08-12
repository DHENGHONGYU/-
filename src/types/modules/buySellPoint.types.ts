/**
 * @module BuySellPointTypes
 * @description 买卖点标注与分析的类型定义。
 *
 * 涵盖 K 线图 markers、买卖点分析结果、参数有效性评估等，
 * 供 chart 组件、analyzer 服务和复盘报告共同引用。
 *
 * @doc [V9-DOC-BACK-013, V9-DOC-ARCH-007, V9-DOC-ARCH-008]
 */

// ============================================================
// 买点 / 卖点类型枚举
// ============================================================

/** 买点类型 */
export type BuyPointType =
  | 'buy_dip'           // 回踩买点：价格低于 MA20 且 RSI 超卖
  | 'buy_pivot'         // 突破买点：站上 MA20 + 放量 + MACD 红柱
  | 'buy_safety_margin' // 估值买点：PE/PB 低于安全阈值
  | 'buy_breakout'      // 突破买点：突破前期高点
  | 'composite_buy'     // 共振买点：多个买入信号叠加

/** 卖点类型 */
export type SellPointType =
  | 'sell_profit_taking'  // 止盈卖点：价格高于 MA20 且 RSI 超买
  | 'sell_trailing_stop'  // 移动止损：从高点回撤超阈值
  | 'sell_stop_loss'      // 固定止损：亏损达固定比例
  | 'composite_sell'      // 共振卖点：多个卖出信号叠加

/** 买卖点方向 */
export type PointDirection = 'buy' | 'sell'

// ============================================================
// K 线图 Marker
// ============================================================

/** K 线图标注点（与 lightweight-charts v5 SeriesMarker 对齐） */
export interface ChartMarker {
  /** 时间戳（与 K 线数据 time 字段格式一致） */
  time: string
  /** 标注位置：高于/低于 K 线 */
  position: 'aboveBar' | 'belowBar' | 'inBar'
  /** 标注形状 */
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown'
  /** 标注颜色 */
  color: string
  /** 标注文字 */
  text?: string
  /** 标注大小 */
  size?: number
}

/** 带元数据的买卖点标注（用于分析） */
export interface AnnotatedTradePoint {
  /** 关联信号 ID */
  signalId: string
  /** 股票代码 */
  symbol: string
  /** 买点或卖点类型 */
  type: BuyPointType | SellPointType
  /** 方向 */
  direction: PointDirection
  /** 触发时间 */
  time: string
  /** 触发价格 */
  price: number
  /** 信号置信度 (0-1) */
  confidence: number
  /** 触发理由 */
  rationale: string
  /** 关联的技术指标快照 */
  snapshot?: {
    priceToMA20?: number
    rsi14?: number
    volumeRatio?: number
    macdDirection?: string
  }
}

// ============================================================
// 买卖点分析结果
// ============================================================

/** 单个买卖点类型的统计分析 */
export interface PointTypeStats {
  /** 买卖点类型 */
  type: BuyPointType | SellPointType
  /** 中文名称 */
  name: string
  /** 方向 */
  direction: PointDirection
  /** 触发次数 */
  count: number
  /** 盈利次数（仅买点：后续上涨；仅卖点：后续下跌） */
  profitableCount: number
  /** 胜率 (%) */
  winRate: number
  /** 平均收益 (%) */
  avgReturn: number
  /** 参数建议 */
  parameterAdvice: string
}

/** 买卖点参数有效性评估 */
export interface ParameterEffectiveness {
  /** 参数名称 */
  parameterName: string
  /** 当前值 */
  currentValue: number
  /** 建议值 */
  suggestedValue: number
  /** 有效性评分 (0-100) */
  effectivenessScore: number
  /** 评估说明 */
  assessment: string
}

/** 入场时机分析 */
export interface EntryTimingAnalysis {
  /** 买点类型统计 */
  buyPointStats: PointTypeStats[]
  /** 最优买点类型 */
  bestBuyPointType: BuyPointType | null
  /** 最差买点类型 */
  worstBuyPointType: BuyPointType | null
  /** 入场时机评分 (0-100) */
  timingScore: number
  /** 时机分析总结 */
  summary: string
}

/** 出场时机分析 */
export interface ExitTimingAnalysis {
  /** 卖点类型统计 */
  sellPointStats: PointTypeStats[]
  /** 最优卖点类型 */
  bestSellPointType: SellPointType | null
  /** 最差卖点类型 */
  worstSellPointType: SellPointType | null
  /** 出场时机评分 (0-100) */
  timingScore: number
  /** 时机分析总结 */
  summary: string
}

/** 买卖点复盘分析报告 */
export interface BuySellPointReview {
  /** 分析时间 */
  analyzedAt: number
  /** 入场时机分析 */
  entryTiming: EntryTimingAnalysis
  /** 出场时机分析 */
  exitTiming: ExitTimingAnalysis
  /** 参数有效性评估列表 */
  parameterEffectiveness: ParameterEffectiveness[]
  /** 核心技能提炼 */
  coreSkills: CoreSkillInsight[]
  /** 综合评分 (0-100) */
  overallScore: number
  /** 总结建议 */
  summary: string
}

/** 核心技能洞察 */
export interface CoreSkillInsight {
  /** 技能名称 */
  skill: string
  /** 洞察内容 */
  insight: string
  /** 建议行动 */
  action: string
  /** 优先级 */
  priority: 'high' | 'medium' | 'low'
}

// ============================================================
// 买卖点配置类型
// ============================================================

/** 买点参数集 */
export interface BuyPointParams {
  /** 回踩 MA20 偏离阈值 (%) */
  dipToMA20Pct: number
  /** 回踩 RSI 上限 */
  dipRsi14Max: number
  /** 突破量比下限 */
  pivotVolumeRatioMin: number
  /** 估值 PE 上限 */
  peMax: number
  /** 估值 PB 上限 */
  pbMax: number
  /** 突破前高回看天数 */
  breakoutLookbackDays: number
}

/** 卖点参数集 */
export interface SellPointParams {
  /** 止盈 MA20 偏离阈值 (%) */
  profitTakingToMA20Pct: number
  /** 止盈 RSI 下限 */
  profitTakingRsi14Min: number
  /** 固定止损比例 (%) */
  fixedStopLossPct: number
  /** 移动止损回撤比例 (%) */
  trailingStopDrawdownPct: number
  /** 移动止损回看天数 */
  trailingStopLookbackDays: number
}

/** 买卖点完整配置 */
export interface BuySellPointConfig {
  version: string
  buyPoints: BuyPointParams
  sellPoints: SellPointParams
}
