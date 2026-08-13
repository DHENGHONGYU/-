/**
 * 资金管理与交易纪律配置
 *
 * 设计哲学：资金如兵力——资源总是相对有限的，不能平均分散，
 * 必须集中优势兵力在核心赛道。
 *
 * 双轨配置：
 * - 耐心资本（patientCapital，默认 30%）：铆住核心稀缺，2-3 年目标 100%-200%
 * - 博收益（betaYield，默认 70%）：纪律至上，年化 15% 合格 / 25% 优秀
 *
 * @doc 资金管理与交易纪律框架（见 docs/specs/02-functional-specs.md §2.4.18-2.4.19）
 */

/** 资金池标识 */
export type CapitalPoolId = 'patient-capital' | 'beta-yield'

/** 策略分类到资金池的映射 */
export const STRATEGY_TIER_TO_CAPITAL_POOL: Record<string, CapitalPoolId> = {
  'core-scarce': 'patient-capital',
  'value-bargain': 'beta-yield',
  'hot-momentum': 'beta-yield',
  watch: 'beta-yield',
  excluded: 'beta-yield',
}

/** 博收益 KPI 指标阈值 */
export interface BetaYieldKpiThresholds {
  /** 年化收益率合格线 */
  annualReturnMin: number
  /** 年化收益率优秀线 */
  annualReturnExcellent: number
  /** 季度收益率合格线 */
  quarterlyReturnMin: number
  /** 季度收益率优秀线 */
  quarterlyReturnExcellent: number
  /** 月度胜率合格线 */
  monthlyWinRateMin: number
  /** 月度胜率优秀线 */
  monthlyWinRateExcellent: number
  /** 单笔止盈比例 */
  singleTakeProfit: number
  /** 单笔止损比例（负数） */
  singleStopLoss: number
  /** 纪律执行率合格线 */
  disciplineRateMin: number
  /** 纪律执行率优秀线 */
  disciplineRateExcellent: number
}

/** 大跌应对触发阈值 */
export interface DrawdownDisciplineThresholds {
  /** 个股小跌幅阈值（触发博收益止损） */
  individualMildDrawdown: number
  /** 个股中跌幅阈值（触发耐心资本分批加仓） */
  individualModerateDrawdown: number
  /** 个股大跌幅阈值（触发耐心资本继续加仓） */
  individualSevereDrawdown: number
  /** 大盘系统性大跌阈值（触发博收益降仓） */
  marketSystemicDrawdown: number
  /** 大盘暴跌阈值（触发博收益清仓） */
  marketCrashDrawdown: number
  /** 博收益降仓目标比例（系统性大跌时） */
  betaYieldReducePositionTo: number
}

/** 双因子评估权重 */
export interface DualFactorWeights {
  /** 个股技术信号权重 */
  technicalSignalWeight: number
  /** 行业景气度评分权重 */
  industryScoreWeight: number
  /** 行业强评级阈值（≥ 此值视为强） */
  industryStrongThreshold: number
  /** 行业弱评级阈值（< 此值视为弱） */
  industryWeakThreshold: number
}

/** 资金管理配置 */
export interface CapitalAllocationConfig {
  /** 耐心资本占比（0-1） */
  patientCapitalPct: number
  /** 博收益占比（0-1） */
  betaYieldPct: number
  /** 耐心资本投资周期（年） */
  patientCapitalHorizonYears: number
  /** 耐心资本目标收益下限（倍数，如 2.0 = 100%） */
  patientCapitalTargetReturnMin: number
  /** 耐心资本目标收益上限（倍数，如 3.0 = 200%） */
  patientCapitalTargetReturnMax: number
  /** 博收益 KPI 阈值 */
  betaYieldKpi: BetaYieldKpiThresholds
  /** 大跌应对阈值 */
  drawdownDiscipline: DrawdownDisciplineThresholds
  /** 双因子评估权重 */
  dualFactorWeights: DualFactorWeights
}

/** 默认资金管理配置（30/70 双轨） */
export const DEFAULT_CAPITAL_ALLOCATION_CONFIG: CapitalAllocationConfig = {
  patientCapitalPct: 0.3,
  betaYieldPct: 0.7,
  patientCapitalHorizonYears: 3,
  patientCapitalTargetReturnMin: 2.0,
  patientCapitalTargetReturnMax: 3.0,
  betaYieldKpi: {
    annualReturnMin: 0.15,
    annualReturnExcellent: 0.25,
    quarterlyReturnMin: 0.1,
    quarterlyReturnExcellent: 0.2,
    monthlyWinRateMin: 0.55,
    monthlyWinRateExcellent: 0.65,
    singleTakeProfit: 0.1,
    singleStopLoss: -0.05,
    disciplineRateMin: 0.8,
    disciplineRateExcellent: 0.9,
  },
  drawdownDiscipline: {
    individualMildDrawdown: -0.05,
    individualModerateDrawdown: -0.1,
    individualSevereDrawdown: -0.15,
    marketSystemicDrawdown: -0.03,
    marketCrashDrawdown: -0.05,
    betaYieldReducePositionTo: 0.5,
  },
  dualFactorWeights: {
    technicalSignalWeight: 0.5,
    industryScoreWeight: 0.5,
    industryStrongThreshold: 3.5,
    industryWeakThreshold: 3.0,
  },
}

/** 获取默认资金管理配置（支持运行时覆盖） */
export function getDefaultCapitalAllocationConfig(): CapitalAllocationConfig {
  return { ...DEFAULT_CAPITAL_ALLOCATION_CONFIG }
}

/** 校验资金占比之和是否为 1 */
export function validateCapitalAllocation(config: CapitalAllocationConfig): boolean {
  const sum = config.patientCapitalPct + config.betaYieldPct
  return Math.abs(sum - 1) < 0.001
}
