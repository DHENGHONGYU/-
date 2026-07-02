/**
 * V9 统一阈值配置中心
 *
 * 整合筛选、评分、交易、风控等各类阈值参数，提供统一访问接口。
 * 本文件位于 src/config/，禁止依赖 services/、apps/、pages/、components/、core/（除类型外）。
 *
 * 变更记录：
 * - v1.0.0 (2026-06-27): 初始版本，整合 screeningConfig 和 tradingConfig 阈值
 * - v1.1.0 (2026-06-29): 接入 valuePitThresholds 到统一阈值配置
 */

import { getDefaultScreeningConfig, type ScreeningThresholds } from './screeningConfig'
import { getDefaultTradingConfig, type SignalThresholds, type KellyConfig, type RiskConfig } from './tradingConfig'
import { VALUE_PIT_THRESHOLDS, type ValuePitThresholds } from './valuePitThresholds'

/**
 * V6 评分因子阈值
 */
export interface V6FactorThresholds {
  /** 估值因子：PE 上限（超过此值不推荐） */
  peMax: number
  /** 估值因子：PB 上限 */
  pbMax: number
  /** 盈利因子：ROE 下限（低于此值不推荐） */
  roeMin: number
  /** 流动性因子：市值下限（亿元） */
  marketCapMinBillion: number
  /** 动量因子：20日收益率下限 */
  momentumMinReturn: number
  /** 波动因子：日波动率上限 */
  volatilityMaxDaily: number
}

/**
 * 数据质量阈值
 */
export interface DataQualityThresholds {
  /** K线数据：最少历史天数 */
  klineMinDays: number
  /** 基础数据：必须字段完整度 (%) */
  basicDataCompletenessMin: number
  /** 数据新鲜度：最大过期小时数 */
  dataFreshnessMaxHours: number
  /** 评分因子：最低完整度 (%) */
  scoreCompletenessMin: number
}

/**
 * Agent 迧行阈值
 */
export interface AgentThresholds {
  /** 健康检查间隔 (ms) */
  healthCheckIntervalMs: number
  /** 任务超时时间 (ms) */
  taskTimeoutMs: number
  /** 失败率上限 (%) */
  maxFailureRatePercent: number
  /** 并发任务上限 */
  maxConcurrentTasks: number
}

/**
 * Widget 运行时阈值
 */
export interface WidgetThresholds {
  /** 加载超时时间 (ms) */
  loadTimeoutMs: number
  /** 刷新间隔 (ms) */
  refreshIntervalMs: number
  /** 缓存最大数量 */
  cacheMaxSize: number
  /** 错误重试次数 */
  maxRetries: number
}

/**
 * 统一阈值配置
 */
export interface UnifiedThresholds {
  version: string
  screening: ScreeningThresholds
  signal: SignalThresholds
  kelly: KellyConfig
  risk: RiskConfig
  v6Factor: V6FactorThresholds
  valuePit: ValuePitThresholds
  dataQuality: DataQualityThresholds
  agent: AgentThresholds
  widget: WidgetThresholds
}

/**
 * 获取默认阈值配置
 */
export function getDefaultThresholds(): UnifiedThresholds {
  const screeningConfig = getDefaultScreeningConfig()
  const tradingConfig = getDefaultTradingConfig()

  return {
    version: '1.0.0',
    screening: screeningConfig.thresholds,
    signal: tradingConfig.signalThresholds,
    kelly: tradingConfig.kelly,
    risk: tradingConfig.risk,
    v6Factor: {
      peMax: 50,
      pbMax: 10,
      roeMin: 8,
      marketCapMinBillion: 10,
      momentumMinReturn: -0.1,
      volatilityMaxDaily: 0.05,
    },
    dataQuality: {
      klineMinDays: 20,
      basicDataCompletenessMin: 80,
      dataFreshnessMaxHours: 48,
      scoreCompletenessMin: 60,
    },
    agent: {
      healthCheckIntervalMs: 30000,
      taskTimeoutMs: 60000,
      maxFailureRatePercent: 20,
      maxConcurrentTasks: 5,
    },
    widget: {
      loadTimeoutMs: 10000,
      refreshIntervalMs: 300000,
      cacheMaxSize: 50,
      maxRetries: 3,
    },
    valuePit: VALUE_PIT_THRESHOLDS,
  }
}

/**
 * 全局阈值实例（单例）
 */
let globalThresholds: UnifiedThresholds | null = null

/**
 * 获取当前阈值配置（单例）
 */
export function getThresholds(): UnifiedThresholds {
  if (!globalThresholds) {
    globalThresholds = getDefaultThresholds()
  }
  return globalThresholds
}

/**
 * 更新阈值配置（运行时覆盖）
 */
export function updateThresholds(overrides: Partial<UnifiedThresholds>): void {
  const current = getThresholds()
  globalThresholds = {
    ...current,
    ...overrides,
    // 深度合并子对象
    screening: { ...current.screening, ...overrides.screening },
    signal: { ...current.signal, ...overrides.signal },
    kelly: { ...current.kelly, ...overrides.kelly },
    risk: { ...current.risk, ...overrides.risk },
    v6Factor: { ...current.v6Factor, ...overrides.v6Factor },
    valuePit: { ...current.valuePit, ...overrides.valuePit },
    dataQuality: { ...current.dataQuality, ...overrides.dataQuality },
    agent: { ...current.agent, ...overrides.agent },
    widget: { ...current.widget, ...overrides.widget },
  }
}

/**
 * 重置为默认阈值
 */
export function resetThresholds(): void {
  globalThresholds = null
}

// ============================================================
// V6 计算器阈值常量
// ============================================================

/**
 * V6 评分引擎各层计算器使用的阈值常量集合。
 * 所有数值均来自 SKILL v4.3 评分 rubric。
 */
export const V6_CALCULATOR_THRESHOLDS = {
  // 通用评分范围
  SCORE_MAX: 5,
  SCORE_MIN: 0,

  // L0 STEEP 宏观扫描
  L0_STEEP_NORMALIZE_DIVISOR: 2,
  L0_STEEP_POSITIVE_THRESHOLD: 7,
  L0_STEEP_NEGATIVE_THRESHOLD: 5,
  L0_REVENUE_YOY_HIGH: 0.3,

  // L0 趋势
  L0_TREND_MIN_DAYS: 20,
  L0_TREND_RISE_MULTIPLIER: 1.05,
  L0_TREND_FALL_MULTIPLIER: 0.95,
  L0_TREND_BASELINE_SCORE: 3,
  L0_TREND_UP_SCORE: 4,
  L0_TREND_SIDEWAYS_SCORE: 3,
  L0_TREND_DOWN_SCORE: 2,
  L0_TREND_ACCELERATION: 0.03,
  L0_TREND_ACCELERATION_DELTA: 0.5,

  // L1 护城河
  L1_MOAT_RD_HIGH: 0.08,
  L1_MOAT_RD_MEDIUM: 0.05,
  L1_MOAT_CUSTOMER_CONCENTRATION_LOW: 0.3,
  L1_MOAT_MARKET_CAP_LARGE: 500e8,
  L1_MOAT_MARKET_CAP_MEDIUM: 100e8,
  L1_MOAT_CRITERIA_SCORE_MAP: { 0: 1, 0.5: 1.5, 1: 2, 1.5: 2.5, 2: 3, 2.5: 3.5, 3: 4, 3.5: 4.5, 4: 5 } as Record<number, number>,
  L1_MOAT_RISK_THRESHOLD: 3,

  // L2 竞品格局
  L2_PEER_BASELINE_SCORE: 3,
  L2_PEER_TECH_BOOST: 1.0,
  L2_PEER_LARGE_CAP: 500e8,
  L2_PEER_LARGE_CAP_BOOST: 1.0,
  L2_PEER_MEDIUM_CAP: 100e8,
  L2_PEER_MEDIUM_CAP_BOOST: 0.5,
  L2_PEER_REVENUE_THRESHOLD: 100,
  L2_PEER_REVENUE_BOOST: 0.5,
  L2_PEER_RISK_THRESHOLD: 3,

  // L3 财务五维度
  L3_FINANCE_REVENUE_YOY_TIER1: 0.5,
  L3_FINANCE_REVENUE_YOY_TIER2: 0.3,
  L3_FINANCE_REVENUE_YOY_TIER3: 0.1,
  L3_FINANCE_NET_MARGIN_TIER1: 0.2,
  L3_FINANCE_NET_MARGIN_TIER2: 0.1,
  L3_FINANCE_NET_MARGIN_TIER3: 0.05,
  L3_FINANCE_CASH_FLOW_RATIO_TIER1: 1.5,
  L3_FINANCE_CASH_FLOW_RATIO_TIER2: 1.2,
  L3_FINANCE_CASH_FLOW_RATIO_TIER3: 0.8,
  L3_FINANCE_OCR_TIER1: 2.5,
  L3_FINANCE_OCR_TIER2: 1.5,
  L3_FINANCE_OCR_TIER3: 0.8,
  L3_FINANCE_RISK_RED_PENALTY: 0.5,
  L3_FINANCE_RISK_YELLOW_PENALTY: 0.25,

  // L3 风险预警
  L3_RISK_AR_RATIO: 0.3,
  L3_RISK_INVENTORY_DAYS: 30,
  L3_RISK_PLEDGE_RATIO: 0.5,
  L3_RISK_GROSS_MARGIN_LOW: 0.2,
  L3_RISK_DEBT_ASSET_RATIO: 0.5,
  L3_RISK_GOODWILL_NET_ASSETS: 0.3,
  L3_RISK_CUSTOMER_CONCENTRATION: 0.5,

  // L3 估值
  L3_VALUATION_PE_LOW: 15,
  L3_VALUATION_PE_MEDIUM: 30,
  L3_VALUATION_PEG_TIER1: 0.8,
  L3_VALUATION_PEG_TIER2: 1.0,
  L3_VALUATION_PEG_TIER3: 1.5,
  L3_VALUATION_PEG_TIER4: 2.0,
  L3_VALUATION_INDUSTRY_ADJUST: 0.5,
  L3_VALUATION_RISK_THRESHOLD: 2,

  // L3 IPC
  L3_IPC_MONTHS_DECAY_3M: 3,
  L3_IPC_MONTHS_DECAY_6M: 6,
  L3_IPC_MONTHS_DECAY_12M: 12,
  L3_IPC_L2_SUPPRESS_THRESHOLD: 2.5,
  L3_IPC_L1_MOAT_BOOST_THRESHOLD: 4,

  // L4 情景推演
  L4_SCENARIO_BASE_PE: 25,
  L4_SCENARIO_BASE_GROWTH: 0.15,
  L4_SCENARIO_UP_MULTIPLIER: 1.2,
  L4_SCENARIO_DOWN_MULTIPLIER: 0.8,
  L4_SCENARIO_BULL_PROB: 0.3,
  L4_SCENARIO_BASE_PROB: 0.5,
  L4_SCENARIO_BEAR_PROB: 0.2,
  L4_SCENARIO_UPSIDE_TIER1: 0.5,
  L4_SCENARIO_UPSIDE_TIER2: 0.2,
  L4_SCENARIO_UPSIDE_TIER3: 0,
  L4_SCENARIO_REWARD_RATIO_HIGH: 2,
  L4_SCENARIO_RISK_THRESHOLD: 2.5,

  // L5 T-M矩阵
  L5_TM_TECH_HIGH: 60,
  L5_TM_TECH_MID: 50,
  L5_TM_MARKET_HIGH: 60,
  L5_TM_MARKET_MID: 50,
  L5_TM_REVENUE_BOOST_HIGH: 0.5,
  L5_TM_REVENUE_BOOST_MEDIUM: 0.2,
  L5_TM_RISK_THRESHOLD: 2.5,

  // L7 第二曲线
  L7_LIFE_STAGE_TIER1: 1.0,
  L7_LIFE_STAGE_TIER2: 0.5,
  L7_LIFE_STAGE_TIER3: 0.3,
  L7_LIFE_STAGE_TIER4: 0.15,
  L7_LIFE_STAGE_TIER5: 0.05,
  L7_CATALYST_OCR_TIER1: 2.0,
  L7_CATALYST_OCR_TIER2: 1.0,
  L7_CATALYST_RD_HIGH: 0.10,
  L7_RISK_THRESHOLD: 3,

  // L8 技术筹码
  L8_CHIP_SCD_RETURN_MULTIPLIER: 100,
  L8_CHIP_SCD_OFFSET: 1,
  L8_CHIP_SCD_SCORE_MULTIPLIER: 2.5,
  L8_CHIP_PCH_TURNOVER_LEVELS: [0.005, 0.01, 0.02, 0.03, 0.05, 0.07, 0.10] as number[],
  L8_CHIP_PCH_SCORES: [5, 4.5, 4, 3.5, 3, 2.5, 2, 1] as number[],
  L8_CHIP_AII_RETURN_MULTIPLIER: 100,
  L8_CHIP_AII_TURNOVER_MULTIPLIER: 0.5,
  L8_CHIP_AII_SCORE_MULTIPLIER: 0.4,
  L8_CHIP_AII_OFFSET: 3,
  L8_CHIP_MATRIX_RETURN_WEIGHT: 0.4,
  L8_CHIP_MATRIX_VOLATILITY_WEIGHT: 0.3,
  L8_CHIP_MATRIX_REFERENCE: 0.05,
  L8_CHIP_MATRIX_TURNOVER_WEIGHT: 0.3,
  L8_CHIP_MATRIX_SCORE_MULTIPLIER: 0.5,
  L8_CHIP_MATRIX_OFFSET: 3,
  L8_CHIP_RETURN60D_LEVELS: [0.3, 0.15, 0.05, -0.05, -0.15, -0.3] as number[],
  L8_CHIP_RETURN60D_SCORES: [5, 4, 3, 2.5, 2, 1.5, 1] as number[],
  L8_CHIP_VOLATILITY_LEVELS: [0.01, 0.015, 0.02, 0.03, 0.05] as number[],
  L8_CHIP_VOLATILITY_SCORES: [5, 4, 3, 2, 1.5, 1] as number[],
  L8_CHIP_DIV_TURNOVER_WEIGHT: 0.3,
  L8_CHIP_DIV_VOLATILITY_WEIGHT: 0.3,
  L8_CHIP_DIV_LEVELS: [5, 3, 1.5, 0.5] as number[],
  L8_CHIP_DIV_SCORES: [1, 2, 3, 4, 5] as number[],
  L8_CHIP_CSR_DEFAULT: 3,
  L8_CHIP_RISK_LOW: 3.5,
  L8_CHIP_RISK_MEDIUM: 2.5,

  // 通用估值
  PB_TIER1: 1.5,
  PB_TIER2: 3,
  PE_TIER_CHIP2: 60,
  PE_TIER_CHIP3: 80,
  PE_TIER_GENERAL3: 50,
} as const

// ============================================================
// 热门板块评分引擎阈值常量
// ============================================================

/**
 * HotSectorAnalyzer 使用的阈值、权重与公式参数集合。
 * 所有数值均从 hotSectorAnalyzer.ts 迁移而来，禁止在引擎中硬编码。
 */
export const HOT_SECTOR_THRESHOLDS = {
  // 通用评分范围
  SCORE_MIN: 0,
  SCORE_MAX: 5,

  // 五维权重
  WEIGHT_MOMENTUM: 0.35,
  WEIGHT_SENTIMENT: 0.25,
  WEIGHT_BREAKOUT: 0.20,
  WEIGHT_VALUATION_RISK: 0.15,
  WEIGHT_MARKET_ENV: 0.05,

  // 动量强度
  MOMENTUM_RANK_TOP10: 10,
  MOMENTUM_RANK_TOP30: 30,
  MOMENTUM_RANK_TOP50: 50,
  MOMENTUM_RANK_TOP10_BONUS: 1.5,
  MOMENTUM_RANK_TOP30_BONUS: 1.0,
  MOMENTUM_RANK_TOP50_BONUS: 0.5,
  MOMENTUM_VOLUME_EXPANSION_HIGH: 2.0,
  MOMENTUM_VOLUME_EXPANSION_MEDIUM: 1.5,
  MOMENTUM_VOLUME_EXPANSION_HIGH_BONUS: 1.0,
  MOMENTUM_VOLUME_EXPANSION_MEDIUM_BONUS: 0.5,
  MOMENTUM_CONSECUTIVE_INFLOW_DAYS: 3,
  MOMENTUM_CONSECUTIVE_INFLOW_BONUS: 0.5,
  MOMENTUM_RS_BASE: 50,
  MOMENTUM_RS_DEVIATION_MULTIPLIER: 0.5,

  // 情绪热度
  SENTIMENT_RANK_TOP5: 5,
  SENTIMENT_RANK_TOP10: 10,
  SENTIMENT_RANK_TOP20: 20,
  SENTIMENT_RANK_TOP50: 50,
  SENTIMENT_RANK_TOP5_SCORE: 5,
  SENTIMENT_RANK_TOP10_SCORE: 4,
  SENTIMENT_RANK_TOP20_SCORE: 3,
  SENTIMENT_RANK_TOP50_SCORE: 1.5,
  SENTIMENT_RANK_OTHER_SCORE: 0.5,
  SENTIMENT_RETAIL_OVERHEATED: 0.8,
  SENTIMENT_RETAIL_PANIC: 0.2,
  SENTIMENT_RETAIL_OVERHEATED_PENALTY: 1.0,
  SENTIMENT_RETAIL_PANIC_PENALTY: 0.5,
  SENTIMENT_INSTITUTION_BUY_HIGH: 5,
  SENTIMENT_INSTITUTION_BUY_MEDIUM: 2,
  SENTIMENT_INSTITUTION_BUY_HIGH_BONUS: 1.5,
  SENTIMENT_INSTITUTION_BUY_MEDIUM_BONUS: 0.5,
  SENTIMENT_LIMIT_UP_HIGH: 10,
  SENTIMENT_LIMIT_UP_MEDIUM: 3,
  SENTIMENT_LIMIT_UP_HIGH_BONUS: 1.0,
  SENTIMENT_LIMIT_UP_MEDIUM_BONUS: 0.5,

  // 技术突破
  BREAKOUT_NEUTRAL_BASE: 2.5,
  BREAKOUT_PATTERN_BONUS: 2.0,
  BREAKOUT_RSI_SIGNAL_BULLISH_BONUS: 1.5,
  BREAKOUT_RSI_SIGNAL_BEARISH_PENALTY: 1.5,
  BREAKOUT_RSI_OPTIMAL_LOW: 50,
  BREAKOUT_RSI_OPTIMAL_HIGH: 70,
  BREAKOUT_RSI_OPTIMAL_BONUS: 1.0,
  BREAKOUT_RSI_OVERBOUGHT: 80,
  BREAKOUT_RSI_OVERBOUGHT_PENALTY: 1.5,
  BREAKOUT_RSI_OVERSOLD: 30,
  BREAKOUT_RSI_OVERSOLD_PENALTY: 1.0,
  BREAKOUT_MA_ALIGNMENT_BONUS: 1.0,
  BREAKOUT_MA_MISALIGNMENT_PENALTY: 1.0,

  // 估值风险
  VALUATION_PE_NEGATIVE: 0,
  VALUATION_PE_LOW: 10,
  VALUATION_PE_MEDIUM_LOW: 15,
  VALUATION_PE_MEDIUM: 20,
  VALUATION_PE_HIGH: 30,
  VALUATION_PE_VERY_HIGH: 50,
  VALUATION_PE_NEGATIVE_SCORE: 0,
  VALUATION_PE_LOW_SCORE: 5,
  VALUATION_PE_MEDIUM_LOW_SCORE: 4,
  VALUATION_PE_MEDIUM_SCORE: 3,
  VALUATION_PE_HIGH_SCORE: 2,
  VALUATION_PE_VERY_HIGH_SCORE: 1,
  VALUATION_PE_EXTREME_SCORE: 0.5,
  VALUATION_PB_PERCENTILE_LOW: 20,
  VALUATION_PB_PERCENTILE_HIGH: 80,
  VALUATION_PB_LOW_BONUS: 1.0,
  VALUATION_PB_HIGH_PENALTY: 1.0,
  VALUATION_MARKET_CAP_LARGE: 1000,
  VALUATION_MARKET_CAP_SMALL: 50,
  VALUATION_MARKET_CAP_LARGE_BONUS: 0.5,
  VALUATION_MARKET_CAP_SMALL_PENALTY: 0.5,
  VALUATION_DIVIDEND_YIELD_HIGH: 3,
  VALUATION_DIVIDEND_YIELD_MEDIUM: 1.5,
  VALUATION_DIVIDEND_YIELD_HIGH_BONUS: 1.0,
  VALUATION_DIVIDEND_YIELD_MEDIUM_BONUS: 0.5,

  // 大盘环境
  MARKET_ENV_BULL_SCORE: 5,
  MARKET_ENV_SIDEWAYS_SCORE: 3,
  MARKET_ENV_BEAR_SCORE: 1,
  MARKET_ENV_SYSTEMIC_RISK_LOW_BONUS: 1.0,
  MARKET_ENV_SYSTEMIC_RISK_HIGH_PENALTY: 2.0,

  // 动作阈值
  ACTION_IMMEDIATE_THRESHOLD: 4.0,
  ACTION_PROBE_THRESHOLD: 3.5,

  // 技术指标参数
  RSI_PERIOD: 14,
  RSI_DEFAULT: 50,
  RSI_MAX: 100,
  RSI_FORMULA_OFFSET: 1,
  RSI_SIGNAL_BULLISH_THRESHOLD: 60,
  RSI_SIGNAL_BEARISH_THRESHOLD: 40,

  // 排名通用最小值
  RANK_MIN: 1,

  // 数据要求
  KLINE_MIN_DAYS: 20,
  MA20_PERIOD: 20,
  MA60_PERIOD: 60,
  VOLUME_RECENT_DAYS: 5,
  VOLUME_PAST_TOTAL_DAYS: 25,
  VOLUME_PAST_DAYS: 20,
  VOLUME_DEFAULT_PAST_AVG: 1,
  VOLUME_DEFAULT_EXPANSION: 1,
  VOLUME_EXPANSION_ZERO_THRESHOLD: 0,

  // 默认值
  DEFAULT_SECTOR_STRENGTH_SCORE: 2.5,
  DEFAULT_PRICE_CHANGE_RANK: 25,
  DEFAULT_V6_SCORE: 2.5,
  DEFAULT_RETAIL_SENTIMENT: 0.5,
  DEFAULT_PB_PERCENTILE: 50,
  DEFAULT_MARKET_TREND: 'sideways' as const,
  DEFAULT_SYSTEMIC_RISK: 'medium' as const,
  DEFAULT_SECTOR_NAME: '未知板块' as const,

  // 排名与分位计算参数
  SECTOR_RANK_BASE: 50,
  SECTOR_RANK_MULTIPLIER: 10,
  PB_PERCENTILE_REFERENCE: 5,
  PB_PERCENTILE_MIN: 0,
  PB_PERCENTILE_MAX: 100,

  // 单位转换与精度
  MARKET_CAP_YUAN_TO_BILLION: 1e8,
  SCORE_ROUNDING_PRECISION: 100,
  DATA_VERSION: 1,
}

// ============================================================
// AI 交易复盘引擎阈值常量
// ============================================================

/**
 * TradeReviewAI 使用的阈值、扣分与目标分集合。
 * 所有数值均从 tradeReviewAI.ts 迁移而来，禁止在引擎中硬编码。
 */
export const TRADE_REVIEW_AI_THRESHOLDS = {
  // 技能等级评分边界（0-100 分制）
  SKILL_LEVEL_EXPERT_THRESHOLD: 85,
  SKILL_LEVEL_ADVANCED_THRESHOLD: 70,
  SKILL_LEVEL_INTERMEDIATE_THRESHOLD: 55,
  SKILL_LEVEL_BEGINNER_THRESHOLD: 35,

  // 错误严重度扣分（按 severity 分档）
  ERROR_PENALTY_CRITICAL: 20,
  ERROR_PENALTY_MAJOR: 12,
  ERROR_PENALTY_MINOR: 5,

  // 技能维度默认初始分（无错误时）
  DIMENSION_DEFAULT_SCORE: 85,

  // 各等级目标分（用于计算 gap）
  TARGET_SCORE_BEGINNER: 35,
  TARGET_SCORE_INTERMEDIATE: 55,
  TARGET_SCORE_ADVANCED: 70,
  TARGET_SCORE_EXPERT: 85,
  TARGET_SCORE_MASTER: 95,
} as const

// ============================================================
// 交易信号生成器阈值常量
// ============================================================

/**
 * SignalGenerator 使用的技术指标周期参数集合。
 * 所有数值均从 signalGenerator.ts 迁移而来，禁止在引擎中硬编码。
 */
export const SIGNAL_GENERATOR_THRESHOLDS = {
  // RSI 指标
  RSI_PERIOD: 14,
  /** RSI 计算所需最小收盘价数量 = RSI_PERIOD + 1 */
  RSI_MIN_CLOSES: 15,

  // 量比指标
  VOLUME_RATIO_PERIOD: 20,
  /** 量比计算所需最小 K 线数量 = VOLUME_RATIO_PERIOD + 1 */
  VOLUME_RATIO_MIN_BARS: 21,

  // MACD 指标
  MACD_EMA_SHORT_PERIOD: 12,
  MACD_EMA_LONG_PERIOD: 26,
  /** MACD 计算所需最小收盘价数量 = MACD_EMA_LONG_PERIOD + 9 */
  MACD_MIN_CLOSES: 35,

  // 均线指标
  MA_SHORT_PERIOD: 20,
  MA_LONG_PERIOD: 60,
} as const

// ============================================================
// V6 评分服务阈值常量
// ============================================================

/**
 * V6ScoreService 基础数据启发式映射使用的归一化参数集合。
 * 所有数值均从 v6ScoreService.ts 迁移而来，禁止在引擎中硬编码。
 */
export const V6_SCORE_SERVICE_THRESHOLDS = {
  // 评分上下限
  SCORE_MAX: 5,
  SCORE_MIN: 0,

  // 估值因子：PE 归一化除数（PE=0 → 5 分，PE=PE_DIVISOR → 4 分，依此类推）
  PE_DIVISOR: 20,

  // 盈利因子：ROE 归一化除数（ROE=ROE_DIVISOR → 1 分，ROE=5*ROE_DIVISOR → 5 分）
  ROE_DIVISOR: 5,
} as const

// ============================================================
// 轮动信号检测器阈值常量
// ============================================================

/**
 * RotationSignalDetector 金叉检测使用的默认周期参数集合。
 * 所有数值均从 rotationSignalDetector.ts 迁移而来，禁止在引擎中硬编码。
 */
export const ROTATION_SIGNAL_THRESHOLDS = {
  // 金叉检测默认均线周期
  GOLDEN_CROSS_SHORT_PERIOD_DEFAULT: 5,
  GOLDEN_CROSS_LONG_PERIOD_DEFAULT: 20,
} as const