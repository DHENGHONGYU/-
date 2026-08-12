/**
 * 交易引擎配置
 *
 * 所有信号阈值、仓位参数、风控阈值集中在此，禁止引擎层硬编码。
 * 本文件位于 src/config/，禁止依赖 services/、apps/、pages/、components/、core/（除类型外）。
 *
 * ## 运行时覆盖机制（v1.1.0 新增，阶段 A-1）
 * - 旧 `getDefaultTradingConfig()` 仍返回编译期常量（向后兼容）。
 * - 新增 `getEffectiveTradingConfig()` 返回"默认值 ∪ 运行时覆盖"。
 *   运行时覆盖经 `src/config/thresholds.ts` 的 `updateThresholds({ risk, kelly, signal })` 注入。
 * - ConfigApp 提交时调用 `updateThresholds()`，下游服务消费 `getEffectiveTradingConfig()` 即生效。
 * - 测试代码可继续 `vi.mock('@/config/tradingConfig', () => ({ getDefaultTradingConfig: ... }))`，
 *   新增的 `getEffectiveTradingConfig` 同样可以 mock，且 mock 优先级最高（覆盖层之上）。
  * @doc [V9-DOC-BACK-008, V9-DOC-BACK-013, V9-DOC-ARCH-008, V9-DOC-BACK-005, V9-DOC-FRONT-020]
*/

export type SignalDirection = 'buy' | 'sell' | 'hold' | 'watch'

export interface SignalThresholds {
  /** PE 绝对值上限（PE < 此值视为估值安全） */
  peMax: number
  /** PB 绝对值上限（PB < 此值视为估值安全） */
  pbMax: number
  dipToMA20Pct: number
  dipRsi14Max: number
  pivotVolumeRatioMin: number
  profitTakingToMA20Pct: number
  profitTakingRsi14Min: number
  fixedStopLossPct: number
  trailingStopDrawdownPct: number
}

export interface KellyConfig {
  fraction: number
  defaultWinRate: number
  defaultProfitLossRatio: number
  minPositionPct: number
  maxPositionPct: number
  roundLot: number
}

export interface RiskConfig {
  maxSinglePositionPct: number
  maxTotalPositionPct: number
  maxTradesPerDay: number
  sameSymbolCooldownHours: number
  dataFreshnessHours: number
  portfolioValue: number
}

export interface TradingConfig {
  version: string
  signalThresholds: SignalThresholds
  kelly: KellyConfig
  risk: RiskConfig
}

export function getDefaultTradingConfig(): TradingConfig {
  return {
    version: '0.9.3',
    signalThresholds: {
      peMax: 25,
      pbMax: 20,
      dipToMA20Pct: 8,
      dipRsi14Max: 30,
      pivotVolumeRatioMin: 1.5,
      profitTakingToMA20Pct: 15,
      profitTakingRsi14Min: 70,
      fixedStopLossPct: 7,
      trailingStopDrawdownPct: 10,
    },
    kelly: {
      fraction: 0.25,
      defaultWinRate: 0.55,
      defaultProfitLossRatio: 1.5,
      minPositionPct: 3,
      maxPositionPct: 15,
      roundLot: 100,
    },
    risk: {
      maxSinglePositionPct: 25,
      maxTotalPositionPct: 80,
      maxTradesPerDay: 5,
      sameSymbolCooldownHours: 24,
      dataFreshnessHours: 48,
      portfolioValue: 1_000_000,
    },
  }
}

// ============================================================
// 运行时覆盖层（v1.1.0，阶段 A-1）
// ============================================================

/** 运行时覆盖（部分字段可空，null=使用默认值） */
export interface TradingConfigOverride {
  signalThresholds?: Partial<SignalThresholds>
  kelly?: Partial<KellyConfig>
  risk?: Partial<RiskConfig>
}

/** 内部缓存：应用运行时覆盖后合并出的最终配置 */
let runtimeOverride: TradingConfigOverride = {}

/** 应用运行时覆盖（ConfigApp 等 UI 提交时调用） */
export function setTradingConfigOverride(override: TradingConfigOverride): void {
  runtimeOverride = {
    signalThresholds: { ...(runtimeOverride.signalThresholds ?? {}), ...(override.signalThresholds ?? {}) },
    kelly: { ...(runtimeOverride.kelly ?? {}), ...(override.kelly ?? {}) },
    risk: { ...(runtimeOverride.risk ?? {}), ...(override.risk ?? {}) },
  }
}

/** 重置覆盖（回到默认常量） */
export function resetTradingConfigOverride(): void {
  runtimeOverride = {}
}

/**
 * 获取当前生效的交易配置（默认值 ∪ 运行时覆盖）。
 *
 * 设计要点：
 * - 始终从 `getDefaultTradingConfig()` 派生，保证 0 覆盖时行为不变。
 * - 浅合并各子对象，覆盖字段按字段粒度。
 * - 供 7 个高频消费文件（positionSizer / portfolioBuilder / riskEngine /
 *   signalGenerator / tradingService / createExecutionPlan / thresholds）使用。
 */
export function getEffectiveTradingConfig(): TradingConfig {
  const base = getDefaultTradingConfig()
  const ov = runtimeOverride
  return {
    version: base.version,
    signalThresholds: { ...base.signalThresholds, ...(ov.signalThresholds ?? {}) },
    kelly: { ...base.kelly, ...(ov.kelly ?? {}) },
    risk: { ...base.risk, ...(ov.risk ?? {}) },
  }
}
