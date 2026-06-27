/**
 * V9 统一阈值配置中心
 *
 * 整合筛选、评分、交易、风控等各类阈值参数，提供统一访问接口。
 * 本文件位于 src/config/，禁止依赖 services/、apps/、pages/、components/、core/（除类型外）。
 *
 * 变更记录：
 * - v1.0.0 (2026-06-27): 初始版本，整合 screeningConfig 和 tradingConfig 阈值
 */

import { getDefaultScreeningConfig, type ScreeningThresholds } from './screeningConfig'
import { getDefaultTradingConfig, type SignalThresholds, type KellyConfig, type RiskConfig } from './tradingConfig'

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