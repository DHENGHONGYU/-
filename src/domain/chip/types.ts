import type { SignalDirection } from '@/fixtures/chipStrategyMockData'
import type { TurnoverVolumeEnergy } from '@/services/scoring/v6-engine/types'
import { Layers, TrendingUp, Target, AlertTriangle } from 'lucide-react'

// ============================================================
// 类型定义
// ============================================================

export type PositionLevel = 'low' | 'mid' | 'high' | 'any'
export type EnergyLevel = 1 | 2 | 3 | 4 | 5

export interface ChipSignalRow {
  id: string
  name: string
  turnoverRange: string
  volumeRatioRange: string
  position: PositionLevel
  priceChange: string
  indicatorCombo: string
  signalType: string
  tradeSignal: string
  tradeAction: SignalDirection
  opportunityScore: number
  action: string
  energyLevel: EnergyLevel
  mockSymbol?: string
  mockName?: string
  mockTurnover?: number
  mockVolumeRatio?: number
  mockReturn60d?: number
  mockPriceChange?: number
}

// ============================================================
// 12 种主力筹码变动信号数据
// ============================================================

export const CHIP_SIGNALS: ChipSignalRow[] = [
  {
    id: 'golden_buy_accumulation',
    name: '温和吸筹',
    turnoverRange: '3% - 5%',
    volumeRatioRange: '> 2.5',
    position: 'low',
    priceChange: '不限',
    indicatorCombo: '换手率(温和) + 量比(显著放量) + 低位/中位',
    signalType: 'accumulation',
    tradeSignal: '黄金买点',
    tradeAction: 'buy',
    opportunityScore: 5.0,
    action: '提前埋伏，需耐心等待启动',
    energyLevel: 3,
    mockSymbol: '300580',
    mockName: '贝斯特',
    mockTurnover: 4.2,
    mockVolumeRatio: 3.1,
    mockReturn60d: -8.5,
    mockPriceChange: 1.8,
  },
  {
    id: 'follow_buy_probing',
    name: '主力试盘',
    turnoverRange: '< 3%',
    volumeRatioRange: '> 5',
    position: 'any',
    priceChange: '不限',
    indicatorCombo: '换手率(低) + 量比(极端放量)',
    signalType: 'probing',
    tradeSignal: '跟进买点',
    tradeAction: 'buy',
    opportunityScore: 4.5,
    action: '加入自选重点盯，次日确认后跟进',
    energyLevel: 2,
    mockSymbol: '688256',
    mockName: '寒武纪',
    mockTurnover: 2.8,
    mockVolumeRatio: 5.6,
    mockReturn60d: 5.2,
    mockPriceChange: 3.5,
  },
  {
    id: 'golden_buy_pullup',
    name: '强势启动',
    turnoverRange: '5% - 10%',
    volumeRatioRange: '> 5',
    position: 'low',
    priceChange: '价涨',
    indicatorCombo: '换手率(活跃) + 量比(极端放量) + 低位 + 价涨',
    signalType: 'pullup',
    tradeSignal: '黄金买点',
    tradeAction: 'buy',
    opportunityScore: 4.5,
    action: '果断上车',
    energyLevel: 5,
    mockSymbol: '300114',
    mockName: '中航电测',
    mockTurnover: 8.5,
    mockVolumeRatio: 6.3,
    mockReturn60d: -7.0,
    mockPriceChange: 7.5,
  },
  {
    id: 'follow_buy_main_wave',
    name: '主升浪加速',
    turnoverRange: '5% - 10%',
    volumeRatioRange: '2.5 - 5',
    position: 'mid',
    priceChange: '价涨',
    indicatorCombo: '换手率(活跃) + 量比(显著放量) + 价涨',
    signalType: 'pullup',
    tradeSignal: '跟进买点',
    tradeAction: 'buy',
    opportunityScore: 4.0,
    action: '上车并守好纪律，别被盘中震荡甩下',
    energyLevel: 4,
    mockSymbol: '000938',
    mockName: '紫光股份',
    mockTurnover: 7.5,
    mockVolumeRatio: 3.2,
    mockReturn60d: 15.6,
    mockPriceChange: 6.2,
  },
  {
    id: 'wait_lockup',
    name: '筹码锁定',
    turnoverRange: '< 1%',
    volumeRatioRange: '< 0.5',
    position: 'any',
    priceChange: '企稳/价涨',
    indicatorCombo: '换手率(极低) + 量比(极度缩量) + 企稳',
    signalType: 'lockup',
    tradeSignal: '观望',
    tradeAction: 'watch',
    opportunityScore: 4.0,
    action: '等待放量突破启动信号，突破时介入',
    energyLevel: 1,
    mockSymbol: '600519',
    mockName: '贵州茅台',
    mockTurnover: 0.3,
    mockVolumeRatio: 0.4,
    mockReturn60d: 3.2,
    mockPriceChange: 0.5,
  },
  {
    id: 'follow_buy_violent',
    name: '暴力吸筹',
    turnoverRange: '> 10%',
    volumeRatioRange: '> 5',
    position: 'low',
    priceChange: '不限',
    indicatorCombo: '换手率(极高) + 量比(极端放量) + 低位',
    signalType: 'accumulation',
    tradeSignal: '跟进买点',
    tradeAction: 'buy',
    opportunityScore: 4.0,
    action: '可跟，但控制仓位',
    energyLevel: 5,
    mockSymbol: '301207',
    mockName: '万邦医药',
    mockTurnover: 49.1,
    mockVolumeRatio: 5.5,
    mockReturn60d: -15.8,
    mockPriceChange: 12.3,
  },
  {
    id: 'hold_healthy',
    name: '健康趋势',
    turnoverRange: '3% - 10%',
    volumeRatioRange: '1.5 - 2.5',
    position: 'any',
    priceChange: '价涨',
    indicatorCombo: '换手率(活跃) + 量比(温和放量) + 价涨',
    signalType: 'pullup',
    tradeSignal: '持有',
    tradeAction: 'hold',
    opportunityScore: 3.5,
    action: '持有/适当介入',
    energyLevel: 3,
    mockSymbol: '002475',
    mockName: '立讯精密',
    mockTurnover: 5.8,
    mockVolumeRatio: 1.8,
    mockReturn60d: 8.5,
    mockPriceChange: 2.3,
  },
  {
    id: 'hold_concentrating',
    name: '筹码集中',
    turnoverRange: '< 10%',
    volumeRatioRange: '稳定',
    position: 'any',
    priceChange: '价涨',
    indicatorCombo: '换手率(稳定, std/mean<0.3) + 价涨',
    signalType: 'lockup',
    tradeSignal: '持有',
    tradeAction: 'hold',
    opportunityScore: 3.5,
    action: '拿住躺赢，主升浪才刚开始',
    energyLevel: 2,
    mockSymbol: '300750',
    mockName: '宁德时代',
    mockTurnover: 8.2,
    mockVolumeRatio: 1.6,
    mockReturn60d: 22.1,
    mockPriceChange: 1.5,
  },
  {
    id: 'escape_fakeup',
    name: '对倒陷阱',
    turnoverRange: '> 5%',
    volumeRatioRange: '< 1.5',
    position: 'any',
    priceChange: '不限',
    indicatorCombo: '换手率(高) + 量比(低) — 量价背离',
    signalType: 'fakeup',
    tradeSignal: '逃离',
    tradeAction: 'escape',
    opportunityScore: 1.5,
    action: '先跑，安全第一',
    energyLevel: 2,
    mockSymbol: '002375',
    mockName: '亚厦股份',
    mockTurnover: 6.8,
    mockVolumeRatio: 1.2,
    mockReturn60d: 18.5,
    mockPriceChange: -0.8,
  },
  {
    id: 'escape_death',
    name: '死亡换手',
    turnoverRange: '> 15%',
    volumeRatioRange: '> 5',
    position: 'high',
    priceChange: '不限',
    indicatorCombo: '换手率(死亡换手) + 量比(极端放量) + 高位',
    signalType: 'distribution',
    tradeSignal: '逃离',
    tradeAction: 'escape',
    opportunityScore: 1.0,
    action: '立即清仓，一股不留',
    energyLevel: 5,
    mockSymbol: '300059',
    mockName: '东方财富',
    mockTurnover: 18.5,
    mockVolumeRatio: 6.2,
    mockReturn60d: 42.3,
    mockPriceChange: -5.6,
  },
  {
    id: 'sell_distribution',
    name: '主力派发',
    turnoverRange: '> 10%',
    volumeRatioRange: '> 2.5',
    position: 'high',
    priceChange: '不限',
    indicatorCombo: '换手率(极高) + 量比(显著放量) + 高位',
    signalType: 'distribution',
    tradeSignal: '黄金卖点',
    tradeAction: 'sell',
    opportunityScore: 1.0,
    action: '坚决回避/清仓',
    energyLevel: 4,
    mockSymbol: '688981',
    mockName: '中芯国际',
    mockTurnover: 12.3,
    mockVolumeRatio: 3.5,
    mockReturn60d: 35.8,
    mockPriceChange: -2.1,
  },
  {
    id: 'reduce_stagnation',
    name: '高位滞涨',
    turnoverRange: '> 5%',
    volumeRatioRange: '不限',
    position: 'high',
    priceChange: '价不涨',
    indicatorCombo: '换手率(高) + 高位 + 价不涨/价跌',
    signalType: 'distribution',
    tradeSignal: '减仓',
    tradeAction: 'sell',
    opportunityScore: 1.0,
    action: '减仓防范风险',
    energyLevel: 3,
    mockSymbol: '601012',
    mockName: '隆基绿能',
    mockTurnover: 6.5,
    mockVolumeRatio: 1.1,
    mockReturn60d: 35.0,
    mockPriceChange: -0.3,
  },
]

// ============================================================
// 个股筹码分析 — 类型与判断引擎
// ============================================================

/** 个股筹码输入（用户从行情软件读取后填入） */
export interface StockChipInput {
  symbol: string
  name: string
  turnover: number       // 换手率 %，如 4.2 表示 4.2%
  volumeRatio: number    // 量比，如 3.1
  return60d: number      // 60日收益率 %，如 -8.5
  priceChange: number    // 当日涨跌幅 %，如 1.8
  pe?: number
  pb?: number
  industryCode?: string
  sector?: string
  poolLabel?: string     // 来源池
}

/** 判断依据条目：对照五层框架/7 法则/12 信号 */
export interface JudgmentBasis {
  /** 来源：framework(五层框架) / rule(7法则) / signal(12信号) / valuation(估值) */
  source: 'framework' | 'rule' | 'signal' | 'valuation'
  /** 规则名称 */
  name: string
  /** 是否命中 */
  matched: boolean
  /** 详细说明 */
  detail: string
}

/** 个股筹码分析结果 */
export interface ChipAnalysisResult {
  /** 位置判断 */
  position: PositionLevel
  positionReason: string
  /** 能量等级（复用 l7_l8 纯函数） */
  energy: TurnoverVolumeEnergy
  /** 量价配合 */
  volumePriceMatch: boolean
  volumePriceReason: string
  /** 匹配的 12 种信号（可能多个） */
  matchedSignals: ChipSignalRow[]
  /** 交易动作 */
  tradeAction: SignalDirection
  /** 交易信号名称 */
  tradeSignal: string
  /** 最终结论 */
  conclusion: string
  /** 操作建议 */
  action: string
  /** 判断依据（逐条对照规则） */
  basis: JudgmentBasis[]
  /** 估值层建议 */
  valuationAdvice?: string
  /** 是否共振买点 */
  isCompositeBuy: boolean
}

// ============================================================
// 筛选器
// ============================================================

export type FilterType = 'all' | 'buy' | 'sell' | 'hold' | 'escape'

// ============================================================
// 调试日志命名空间
// ============================================================

export const DEBUG_LOG_NAMESPACE = 'chipStrategyGrayZone'

// ============================================================
// 策略框架数据
// ============================================================

export interface StrategyLayer {
  title: string
  icon: typeof Layers
  items: string[]
}

export const STRATEGY_LAYERS: StrategyLayer[] = [
  {
    title: '宏观/板块层（天时）',
    icon: Layers,
    items: [
      '大盘环境：牛市/震荡/熊市判断，熊市中所有启动信号视为反弹',
      '五维评分：动量强度(35%) + 情绪热度(25%) + 技术突破(20%) + 估值风险(15%) + 大盘环境(5%)',
      '动量+技术突破双高 = 板块启动核心标志',
    ],
  },
  {
    title: '个股技术层（K线形态）',
    icon: TrendingUp,
    items: [
      '突破买点：站上MA20 + 放量(量比>1.5) + MACD红柱',
      '回踩买点：低于MA20 8% + RSI<30(超卖)',
      '估值买点：PE<25 且 PB<20',
      '共振买点：2+买入信号叠加 → composite_buy，置信度+0.2/信号',
    ],
  },
  {
    title: '筹码层（量价配合）',
    icon: Target,
    items: [
      '能量 = 换手率 × 量比 → L1(冷清) ~ L5(爆炸) 五级',
      'L5爆炸能量：仓位上限70%，止盈25%，止损10%',
      'L1冷清能量：仓位上限10%，止盈5%，止损2%',
      '12种主力筹码变动模式：从温和吸筹到死亡换手',
    ],
  },
  {
    title: '共振确认层（多信号叠加）',
    icon: Layers,
    items: [
      '单一信号胜率50%，共振信号胜率75%+',
      '技术+筹码+资金三维共振 = 最优标的',
      'V6引擎11层交叉验证加权评分',
    ],
  },
  {
    title: '风控约束层（纪律）',
    icon: AlertTriangle,
    items: [
      '景气恶化线：行业景气度连续两期<45 → 禁止加仓',
      '资金破位线：主力资金流出>3天 → 减仓',
      '回撤风控线：单票亏损>7%或回撤>10% → 止损',
      '仓位限制：单票≤25%，总仓位≤80%，间隔24h，每日≤5笔',
    ],
  },
]

// ============================================================
// 核心经验法则
// ============================================================

export const EXPERIENCE_RULES: { title: string; desc: string }[] = [
  { title: '位置定生死', desc: '高位放量是出货，低位放量是吸筹。60日收益>30%为高位，<0为低位' },
  { title: '量在价先', desc: '无量上涨是耍流氓，必须放量突破(量比>1.5)。缩量突破=假突破风险' },
  { title: '能量分级管理', desc: '换手率×量比=L1~L5能量等级。L5可重仓(25%)，L1仅观望' },
  { title: '警惕对倒陷阱', desc: '高换手(>5%) + 低量比(<1.5) = 诱多出货，坚决回避' },
  { title: '共振才是机会', desc: '单一信号胜率50%，共振信号胜率75%+。优先技术+筹码+资金三维共振' },
  { title: '纪律高于预测', desc: '固定止损7%，移动止损10%。不抱侥幸，跌破即走' },
  { title: '顺势而为', desc: '只做景气向上板块。大盘决定仓位：牛市80%，震荡50%，熊市20%' },
]

// ============================================================
// 筛选器选项
// ============================================================

export const FILTER_OPTIONS: { value: FilterType; label: string; icon: typeof Target }[] = [
  { value: 'all', label: '全部信号', icon: Layers },
  { value: 'buy', label: '买入信号', icon: TrendingUp },
  { value: 'hold', label: '持有信号', icon: Target },
  { value: 'sell', label: '卖出信号', icon: AlertTriangle },
  { value: 'escape', label: '逃离信号', icon: AlertTriangle },
]
