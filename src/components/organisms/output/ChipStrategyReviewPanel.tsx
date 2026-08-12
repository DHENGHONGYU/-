/**
 * 筹码与交易策略分析面板
 *
 * 在交易复盘舱中单独展示筹码和交易策略的核心指标分析表，
 * 重点关注 K线形态、筹码、成交量、换手率、股东人数、量比等维度。
 *
 * 数据来源：L8 技术筹码层（detectMainForceChipFlow）12 种主力筹码变动信号 +
 *           signalGenerator 买卖点信号 + TVR 换手率-量比协同指标。
 *
 * @doc [V9-DOC-BACK-013, V9-DOC-ARCH-007, V9-DOC-PROJ-113]
 */

// ============================================================
// 类型定义
// ============================================================

/** 筹码信号类型（与 l7_l8.ts 中 MainForceChipFlowType 对齐） */
export type ChipSignalType =
  | 'accumulation'    // 吸筹
  | 'probing'         // 试盘
  | 'pullup'          // 拉升
  | 'lockup'          // 锁仓
  | 'distribution'    // 派发
  | 'fakeup'          // 对倒诱多
  | 'neutral'         // 中性

/** 交易信号类型（与 l7_l8.ts 中 TradeSignalType 对齐） */
export type TradeActionType =
  | 'golden_buy'      // 黄金买点
  | 'follow_buy'      // 跟进买点
  | 'hold'            // 持有
  | 'wait'            // 观望
  | 'reduce'          // 减仓
  | 'golden_sell'     // 黄金卖点
  | 'escape'          // 逃离

/** 能量等级（与 l7_l8.ts 中 TurnoverVolumeEnergy.level 对齐） */
export type EnergyLevel = 1 | 2 | 3 | 4 | 5

/** 单只股票的筹码策略分析行 */
export interface ChipStrategyRow {
  /** 股票代码 */
  symbol: string
  /** 股票名称 */
  name: string
  // ---- K线形态 ----
  /** K线形态描述 */
  klinePattern: string
  /** MA20 偏离度 (%) */
  priceToMA20: number
  /** MA60 偏离度 (%) */
  priceToMA60: number
  /** MACD 方向 */
  macdDirection: 'red' | 'green' | 'neutral'
  /** RSI14 值 */
  rsi14: number
  // ---- 成交量 & 换手率 ----
  /** 成交量放大倍数（量比） */
  volumeRatio: number
  /** 20日均换手率 (%) */
  avgTurnover20d: number
  /** 换手率标准差 */
  turnoverStd: number
  /** 量比标签 */
  volumeRatioLabel: string
  // ---- 筹码分析 ----
  /** 60日收益率 (%)，用于位置判断 */
  return60d: number
  /** 位置判断 */
  position: 'high' | 'mid' | 'low'
  /** 股东人数变化度 (SCD, 0-5) */
  shareholderChangeDegree: number
  /** 筹码集中度 (PCH, 0-5) */
  chipConcentration: number
  /** 主力吸筹强度 (AII, 0-5) */
  accumulationIntensity: number
  /** 筹码博弈矩阵 (MATRIX, 0-5) */
  chipMatrix: string
  // ---- 信号识别 ----
  /** 主力筹码信号类型 */
  chipSignalType: ChipSignalType
  /** 主力筹码信号名称 */
  chipSignalName: string
  /** 交易信号类型 */
  tradeAction: TradeActionType
  /** 交易信号名称 */
  tradeActionName: string
  /** 能量等级 */
  energyLevel: EnergyLevel
  /** 能量标签 */
  energyLabel: string
  /** 机会评分 (0-5) */
  opportunityScore: number
  /** 置信度 (0-1) */
  confidence: number
  /** 操作建议 */
  action: string
  /** 信号触发理由 */
  rationale: string
}

// =================================================