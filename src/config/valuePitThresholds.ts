/**
 * ValuePitAnalyzer 阈值配置
 *
 * 集中管理价值洼地五维评分引擎中的所有阈值、权重、公式参数与默认值。
 * 本文件位于 src/config/，禁止依赖 services/、apps/、pages/、components/、core/（除类型外）。
/**
 * ValuePit 评分引擎阈值常量集合。
  * @doc [V9-DOC-DATA-047, V9-DOC-FRONT-020, V9-DOC-DATA-068]
*/
export const VALUE_PIT_THRESHOLDS = {
  // ============================================================
  // 通用评分边界与精度
  // ============================================================
  SCORE_MAX: 5,
  SCORE_MIN: 0,
  SCORE_ROUNDING_PRECISION: 100,

  // ============================================================
  // 五维权重（合计应为 1.0）
  // ============================================================
  WEIGHT_CATALYST: 0.30,
  WEIGHT_VALUATION_MARGIN: 0.25,
  WEIGHT_CHIP_STRUCTURE: 0.20,
  WEIGHT_ROTATION_POSITION: 0.15,
  WEIGHT_LIQUIDITY: 0.10,

  // ============================================================
  // 催化确定性（catalyst）
  // ============================================================
  CATALYST_DOUBLE_CONFIRM_THRESHOLD: 3,
  CATALYST_DOUBLE_CONFIRM_BONUS: 0.5,

  // ============================================================
  // 估值安全垫（valuationMargin）
  // ============================================================
  // PE / PB 历史分位档位与对应分数
  VALUATION_PERCENTILE_VERY_LOW: 20,
  VALUATION_PERCENTILE_LOW: 40,
  VALUATION_PERCENTILE_MEDIUM: 60,
  VALUATION_PERCENTILE_HIGH: 80,

  VALUATION_PERCENTILE_SCORE_VERY_LOW: 5,
  VALUATION_PERCENTILE_SCORE_LOW: 4,
  VALUATION_PERCENTILE_SCORE_MEDIUM: 3,
  VALUATION_PERCENTILE_SCORE_HIGH: 2,
  VALUATION_PERCENTILE_SCORE_VERY_HIGH: 1,

  // 股息率加分
  DIVIDEND_YIELD_HIGH_THRESHOLD: 4,
  DIVIDEND_YIELD_MEDIUM_THRESHOLD: 2,
  DIVIDEND_YIELD_HIGH_BONUS: 1.0,
  DIVIDEND_YIELD_MEDIUM_BONUS: 0.5,

  // PEG 调整
  PEG_VALID_MIN: 0,
  PEG_LOW_THRESHOLD: 0.5,
  PEG_FAIR_MIN: 0.5,
  PEG_FAIR_MAX: 1.0,
  PEG_HIGH_THRESHOLD: 2.0,
  PEG_LOW_BONUS: 1.0,
  PEG_FAIR_BONUS: 0.5,
  PEG_HIGH_PENALTY: 1.0,

  // ============================================================
  // 筹码结构（chipStructure）
  // ============================================================
  CHIP_STRUCTURE_NEUTRAL_BASE: 2.5,

  // 北向资金
  NORTHBOUND_STRONG_THRESHOLD: 2,
  NORTHBOUND_WEAK_THRESHOLD: 0,
  NORTHBOUND_NEGATIVE_THRESHOLD: -1,
  NORTHBOUND_STRONG_BONUS: 2.0,
  NORTHBOUND_WEAK_BONUS: 1.0,
  NORTHBOUND_NEGATIVE_PENALTY: 1.0,

  // 基金持仓
  FUND_POSITION_STRONG_THRESHOLD: 5,
  FUND_POSITION_WEAK_THRESHOLD: 0,
  FUND_POSITION_NEGATIVE_THRESHOLD: -3,
  FUND_POSITION_STRONG_BONUS: 2.0,
  FUND_POSITION_WEAK_BONUS: 1.0,
  FUND_POSITION_NEGATIVE_PENALTY: 1.0,

  // 股东户数变化（负值=集中，正值=分散）
  SHAREHOLDER_CONCENTRATE_STRONG_THRESHOLD: -10,
  SHAREHOLDER_CONCENTRATE_WEAK_THRESHOLD: -5,
  SHAREHOLDER_DISPERSION_THRESHOLD: 10,
  SHAREHOLDER_CONCENTRATE_STRONG_BONUS: 2.0,
  SHAREHOLDER_CONCENTRATE_WEAK_BONUS: 1.0,
  SHAREHOLDER_DISPERSION_PENALTY: 1.0,

  // ============================================================
  // 轮动位置（rotationPosition）
  // ============================================================
  ROTATION_VOLUME_PERCENTILE_VERY_LOW: 20,
  ROTATION_VOLUME_PERCENTILE_LOW: 40,
  ROTATION_VOLUME_PERCENTILE_MEDIUM: 60,
  ROTATION_VOLUME_PERCENTILE_HIGH: 80,

  ROTATION_VOLUME_SCORE_VERY_LOW: 5,
  ROTATION_VOLUME_SCORE_LOW: 4,
  ROTATION_VOLUME_SCORE_MEDIUM: 3,
  ROTATION_VOLUME_SCORE_HIGH: 2,
  ROTATION_VOLUME_SCORE_VERY_HIGH: 1,

  ROTATION_INFLOW_COMBINE_DIVISOR: 2,
  ROTATION_GOLDEN_CROSS_BONUS: 1.5,

  // ============================================================
  // 流动性（liquidity）
  // ============================================================
  // 成交额单位转换（万元 → 亿元）
  LIQUIDITY_AMOUNT_UNIT_CONVERSION: 10000,

  // 日均成交额档位（亿元）与对应分数
  LIQUIDITY_AMOUNT_TIER_1: 5,
  LIQUIDITY_AMOUNT_TIER_2: 3,
  LIQUIDITY_AMOUNT_TIER_3: 1,
  LIQUIDITY_AMOUNT_TIER_4: 0.5,

  LIQUIDITY_AMOUNT_SCORE_TIER_1: 5,
  LIQUIDITY_AMOUNT_SCORE_TIER_2: 4,
  LIQUIDITY_AMOUNT_SCORE_TIER_3: 3,
  LIQUIDITY_AMOUNT_SCORE_TIER_4: 2,
  LIQUIDITY_AMOUNT_SCORE_TIER_5: 1,

  // 换手率调整
  TURNOVER_OPTIMAL_MIN: 1,
  TURNOVER_OPTIMAL_MAX: 3,
  TURNOVER_OPTIMAL_BONUS: 1.0,
  TURNOVER_OVERHEAT_THRESHOLD: 10,
  TURNOVER_OVERHEAT_PENALTY: 1.0,
  TURNOVER_LOW_THRESHOLD: 0.3,
  TURNOVER_LOW_PENALTY: 0.5,

  // 市值调整
  MARKET_CAP_LARGE_THRESHOLD: 500,
  MARKET_CAP_LARGE_BONUS: 0.5,
  MARKET_CAP_SMALL_THRESHOLD: 30,
  MARKET_CAP_SMALL_PENALTY: 0.5,

  // ============================================================
  // 综合评分 action 阈值
  // ============================================================
  ACTION_IMMEDIATE_THRESHOLD: 4.0,
  ACTION_PROBE_THRESHOLD: 3.5,
  ACTION_WAIT_THRESHOLD: 3.0,

  // ============================================================
  // 数据获取与默认值
  // ============================================================
  // V6 因子缺失时的默认分
  DEFAULT_FACTOR_SCORE: 2.5,

  // 估值默认值
  DEFAULT_PE_PERCENTILE: 50,
  DEFAULT_PB_PERCENTILE: 50,
  DEFAULT_DIVIDEND_YIELD: 1.5,
  DEFAULT_PEG: 1.0,

  // 轮动默认值
  DEFAULT_SECTOR_VOLUME_PERCENTILE: 50,
  DEFAULT_CAPITAL_INFLOW_STRENGTH: 2.5,

  // 流动性默认值
  DEFAULT_TURNOVER_RATE: 1.5,
  DEFAULT_MARKET_CAP_BILLION: 0,

  // 缺失数据回退
  DEFAULT_PRICE_FALLBACK: 0,
  DEFAULT_MARKET_CAP_FALLBACK: 0,
  DEFAULT_V6_SCORE_FALLBACK: 0,

  // 字符串常量
  DEFAULT_UNKNOWN_SECTOR_NAME: '未知板块',

  // 数据版本
  VALUE_PIT_DATA_VERSION: 1,

  // ============================================================
  // 数据源计算参数
  // ============================================================
  MIN_QUOTE_HISTORY_DAYS: 20,
  MA_SHORT_PERIOD: 20,
  MA_LONG_PERIOD: 60,
  MIN_VOLUME_SAMPLES: 5,
  MIN_AMOUNT_SAMPLES: 5,

  // 板块成交量分位估算参数
  SECTOR_VOLUME_PERCENTILE_BASE: 50,
  SECTOR_VOLUME_PERCENTILE_MULTIPLIER: 10,

  // 估值归一化参数
  PE_NORMALIZATION_MAX: 30,
  PB_NORMALIZATION_MAX: 5,

  // 百分位 clamp 边界
  PERCENTILE_MIN: 0,
  PERCENTILE_MAX: 100,

  // 股息率从 V6 估值因子映射参数
  DIVIDEND_YIELD_SCORE_BASE: 5,
  DIVIDEND_YIELD_SCORE_MULTIPLIER: 0.8,

  // 市值单位转换（元 → 亿元）
  MARKET_CAP_UNIT_CONVERSION: 1e8,

  // 换手率计算乘数
  TURNOVER_RATE_MULTIPLIER: 100,
} as const

/**
 * ValuePit 阈值集合类型。
 */
export type ValuePitThresholds = typeof VALUE_PIT_THRESHOLDS
