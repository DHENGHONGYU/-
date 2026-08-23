/**
 * @file adaptiveSourceOrchestrator.ts — 质量×效率自适应源编排模块
 *
 * 为 dataSourceOrchestrator 静态降级链提供自适应能力：令牌桶限流（按源隔离）、
 * 熔断器（closed/open/half-open）、EWMA 源健康指标、质量×效率综合评分链重排、
 * 指数退避+全抖动重试延迟（自包含，不依赖 fetcherInterceptor）。
 * 分层约束：仅依赖 @/lib/logger，禁止依赖 store/pages/components/data 层。
 */

import { getLogger } from '@/lib/logger'
import type { RetryPolicy } from '@/types/modules/collection.types'

const logger = getLogger()

// ─── 常量（魔法数字提取） ────────────────────────────────────

const QUALITY_W_REAL_SUCCESS = 0.4
const QUALITY_W_COMPLETENESS = 0.3
const QUALITY_W_NON_MOCK = 0.3
/** EWMA 延迟对数衰减缩放基数（毫秒） */
const LATENCY_LOG_SCALE_MS = 1000
const TOKEN_COST = 1

// ─── 类型定义 ────────────────────────────────────────────────

/** 熔断器三态 */
export type CircuitState = 'closed' | 'open' | 'half-open'

/** 源健康指标快照（由 recordSourceResult 维护，供评分与排序消费） */
export interface SourceHealthMetrics {
  ewmaLatencyMs: number // EWMA 平滑平均延迟（毫秒）
  successRate: number // EWMA 成功率（含 mock 结果）
  realSuccessRate: number // EWMA 真实成功率（mock 结果不计入成功）
  completenessRate: number // EWMA 数据完整度 0-1
  mockRatio: number // mock 结果占比（EWMA，质量分公式用）
  consecutiveFailures: number // 当前连续失败次数
  circuitState: CircuitState
  lastFailureAt: number // 最近失败时间戳（Date.now()），无失败为 0
  qualityScore: number
  efficiencyScore: number
  combinedScore: number // 综合分 0-1，熔断 open 时恒为 0
}

/** 自适应编排配置 */
export interface AdaptiveSourceConfig {
  tokenBucket: { capacity: number; refillPerSec: number } // capacity 突发上限 / refillPerSec 每秒补令牌数
  // failureThreshold 连续失败熔断阈值 / resetTimeoutMs open 持续毫秒数 / halfOpenProbeCount 恢复所需探测成功数
  circuitBreaker: { failureThreshold: number; resetTimeoutMs: number; halfOpenProbeCount: number }
  retry: { baseDelayMs: number; maxDelayMs: number; factor: number; jitterRatio: number } // jitterRatio 1=全抖动 [0,cap]，0=无抖动
  scoring: { qualityWeight: number; efficiencyWeight: number } // 评分权重，建议归一化为 1
  ewmaAlpha: number // EWMA 平滑系数 0-1，越大越敏感
}

/** 单次采集结果输入 */
export interface SourceResultInput {
  success: boolean
  isMock: boolean
  latencyMs: number
  /** 数据完整度 0-1（如必填字段非空率） */
  completeness: number
}

/** 默认自适应配置 */
export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveSourceConfig = {
  tokenBucket: { capacity: 5, refillPerSec: 2 },
  circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 30_000, halfOpenProbeCount: 2 },
  retry: { baseDelayMs: 500, maxDelayMs: 10_000, factor: 2, jitterRatio: 1 },
  scoring: { qualityWeight: 0.6, efficiencyWeight: 0.4 },
  ewmaAlpha: 0.3,
}

// ─── 工具函数 ────────────────────────────────────────────────

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── 令牌桶限流器 ────────────────────────────────────────────

interface BucketState {
  tokens: number
  lastRefillAt: number
}

/**
 * 令牌桶限流器（按源 id 隔离，浏览器安全，不依赖 Node API）
 * @example
 * const limiter = new TokenBucketLimiter(5, 2)
 * if (limiter.tryAcquire('tushare')) { ... } // 立即取令牌
 * await limiter.acquire('tushare')           // 阻塞直到有令牌
 */
export class TokenBucketLimiter {
  private readonly buckets = new Map<string, BucketState>()

  constructor(private readonly capacity: number, private readonly refillPerSec: number) {}

  /** 立即尝试获取一个令牌；成功 true，桶空 false */
  tryAcquire(sourceId: string): boolean {
    const bucket = this.refill(sourceId)
    if (bucket.tokens >= TOKEN_COST) {
      bucket.tokens -= TOKEN_COST
      return true
    }
    return false
  }

  /** 等待语义获取令牌（按补充速率休眠重试直到成功） */
  async acquire(sourceId: string): Promise<void> {
    while (!this.tryAcquire(sourceId)) {
      await sleep(Math.ceil(1000 / this.refillPerSec))
    }
  }

  /** 令牌可用率（当前令牌/容量，0-1），供效率分计算 */
  getAvailabilityRatio(sourceId: string): number {
    return clamp01(this.refill(sourceId).tokens / this.capacity)
  }

  /** 清空全部桶状态（测试/重置用） */
  reset(): void {
    this.buckets.clear()
  }

  /** 惰性建桶并按 elapsed 时间补充令牌（不超容量） */
  private refill(sourceId: string): BucketState {
    const now = Date.now()
    let bucket = this.buckets.get(sourceId)
    if (!bucket) {
      bucket = { tokens: this.capacity, lastRefillAt: now }
      this.buckets.set(sourceId, bucket)
      return bucket
    }
    const elapsedSec = (now - bucket.lastRefillAt) / 1000
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSec * this.refillPerSec)
    bucket.lastRefillAt = now
    return bucket
  }
}

// ─── 熔断器 ──────────────────────────────────────────────────

interface BreakerState {
  state: CircuitState
  consecutiveFailures: number
  openedAt: number
  halfOpenSuccesses: number
}

/**
 * 源熔断器（closed → open → half-open → closed 状态机）
 * @example
 * const breaker = new SourceCircuitBreaker(3, 30_000, 2)
 * if (breaker.canExecute('sina')) { ...; breaker.onSuccess('sina') }
 */
export class SourceCircuitBreaker {
  private readonly states = new Map<string, BreakerState>()

  constructor(
    private readonly failureThreshold: number,
    private readonly resetTimeoutMs: number,
    private readonly halfOpenProbeCount: number,
  ) {}

  /** 是否允许执行请求；open 超时后自动转 half-open 并放行探测 */
  canExecute(sourceId: string): boolean {
    return this.syncState(sourceId).state !== 'open'
  }

  /** 记录成功；half-open 下累计探测成功，达标恢复 closed */
  onSuccess(sourceId: string): void {
    const s = this.syncState(sourceId)
    s.consecutiveFailures = 0
    if (s.state === 'half-open') {
      s.halfOpenSuccesses += 1
      if (s.halfOpenSuccesses >= this.halfOpenProbeCount) {
        this.transition(s, sourceId, 'closed')
      }
    }
  }

  /** 记录失败；half-open 下任何失败立即回到 open */
  onFailure(sourceId: string): void {
    const s = this.syncState(sourceId)
    s.consecutiveFailures += 1
    if (s.state === 'half-open' || s.consecutiveFailures >= this.failureThreshold) {
      s.openedAt = Date.now()
      this.transition(s, sourceId, 'open')
    }
  }

  /** 查询熔断状态（含 open→half-open 超时跃迁） */
  getCircuitState(sourceId: string): CircuitState {
    return this.syncState(sourceId).state
  }

  /** 当前连续失败次数 */
  getConsecutiveFailures(sourceId: string): number {
    return this.syncState(sourceId).consecutiveFailures
  }

  /** 清空全部状态（测试/重置用） */
  reset(): void {
    this.states.clear()
  }

  private getOrCreate(sourceId: string): BreakerState {
    const existing = this.states.get(sourceId)
    if (existing) return existing
    const s: BreakerState = { state: 'closed', consecutiveFailures: 0, openedAt: 0, halfOpenSuccesses: 0 }
    this.states.set(sourceId, s)
    return s
  }

  /** 同步超时跃迁：open 超 resetTimeoutMs 后进入 half-open */
  private syncState(sourceId: string): BreakerState {
    const s = this.getOrCreate(sourceId)
    if (s.state === 'open' && Date.now() - s.openedAt >= this.resetTimeoutMs) {
      s.halfOpenSuccesses = 0
      this.transition(s, sourceId, 'half-open')
    }
    return s
  }

  private transition(s: BreakerState, sourceId: string, next: CircuitState): void {
    if (s.state === next) return
    logger.info(`[AdaptiveOrchestrator] 熔断状态跃迁: ${sourceId} ${s.state} -> ${next}`)
    s.state = next
  }
}

// ─── 综合评分 ────────────────────────────────────────────────

/**
 * 计算质量×效率综合分
 *
 * qualityScore    = 0.4×realSuccessRate + 0.3×completenessRate + 0.3×(1 − mockRatio)
 * efficiencyScore = 1/(1+ln(1+ewmaLatencyMs/1000)) × bucketAvailability
 * combinedScore   = qualityWeight×quality + efficiencyWeight×efficiency
 * 熔断 open 的源 combinedScore 恒为 0（排序沉底）。
 *
 * @param metrics 源健康指标
 * @param config 自适应配置（使用 scoring 权重）
 * @param bucketAvailability 令牌桶可用率 0-1，缺省 1
 * @returns 综合分 0-1
 * @example computeCombinedScore(getSourceMetrics('tushare'), DEFAULT_ADAPTIVE_CONFIG, 0.8)
 */
export function computeCombinedScore(
  metrics: SourceHealthMetrics,
  config: AdaptiveSourceConfig,
  bucketAvailability = 1,
): number {
  if (metrics.circuitState === 'open') return 0
  const quality =
    QUALITY_W_REAL_SUCCESS * metrics.realSuccessRate +
    QUALITY_W_COMPLETENESS * metrics.completenessRate +
    QUALITY_W_NON_MOCK * (1 - metrics.mockRatio)
  const latencyFactor = 1 / (1 + Math.log(1 + metrics.ewmaLatencyMs / LATENCY_LOG_SCALE_MS))
  const efficiency = latencyFactor * clamp01(bucketAvailability)
  return clamp01(
    config.scoring.qualityWeight * quality + config.scoring.efficiencyWeight * efficiency,
  )
}

// ─── EWMA 指标记录（模块级注册表） ───────────────────────────

/** 新源乐观初始指标：未观测源视为健康，参与公平竞争 */
function createInitialMetrics(): SourceHealthMetrics {
  return {
    ewmaLatencyMs: 0, successRate: 1, realSuccessRate: 1, completenessRate: 1, mockRatio: 0,
    consecutiveFailures: 0, circuitState: 'closed', lastFailureAt: 0,
    qualityScore: 1, efficiencyScore: 1, combinedScore: 1,
  }
}

const metricsRegistry = new Map<string, SourceHealthMetrics>()
const defaultLimiter = new TokenBucketLimiter(
  DEFAULT_ADAPTIVE_CONFIG.tokenBucket.capacity,
  DEFAULT_ADAPTIVE_CONFIG.tokenBucket.refillPerSec,
)
const defaultBreaker = new SourceCircuitBreaker(
  DEFAULT_ADAPTIVE_CONFIG.circuitBreaker.failureThreshold,
  DEFAULT_ADAPTIVE_CONFIG.circuitBreaker.resetTimeoutMs,
  DEFAULT_ADAPTIVE_CONFIG.circuitBreaker.halfOpenProbeCount,
)

function ewma(prev: number, sample: number, alpha: number): number {
  return alpha * sample + (1 - alpha) * prev
}

/**
 * 记录一次源采集结果：更新 EWMA 延迟/成功率/完整度、熔断状态与三档评分
 * @param sourceId 数据源 id（如 'tushare'）
 * @param result 采集结果（成功标志 / 是否 mock / 延迟 / 完整度）
 * @param config 自适应配置，缺省 DEFAULT_ADAPTIVE_CONFIG
 * @example
 * recordSourceResult('tushare', { success: true, isMock: false, latencyMs: 320, completeness: 1 })
 */
export function recordSourceResult(
  sourceId: string,
  result: SourceResultInput,
  config: AdaptiveSourceConfig = DEFAULT_ADAPTIVE_CONFIG,
): void {
  const m = metricsRegistry.get(sourceId) ?? createInitialMetrics()
  const alpha = config.ewmaAlpha

  m.ewmaLatencyMs = ewma(m.ewmaLatencyMs, result.latencyMs, alpha)
  m.successRate = ewma(m.successRate, result.success ? 1 : 0, alpha)
  m.realSuccessRate = ewma(m.realSuccessRate, result.success && !result.isMock ? 1 : 0, alpha)
  m.completenessRate = ewma(m.completenessRate, clamp01(result.completeness), alpha)
  m.mockRatio = ewma(m.mockRatio, result.isMock ? 1 : 0, alpha)

  if (result.success) {
    defaultBreaker.onSuccess(sourceId)
  } else {
    defaultBreaker.onFailure(sourceId)
    m.lastFailureAt = Date.now()
  }
  m.consecutiveFailures = defaultBreaker.getConsecutiveFailures(sourceId)
  m.circuitState = defaultBreaker.getCircuitState(sourceId)

  m.qualityScore = clamp01(
    QUALITY_W_REAL_SUCCESS * m.realSuccessRate +
      QUALITY_W_COMPLETENESS * m.completenessRate +
      QUALITY_W_NON_MOCK * (1 - m.mockRatio),
  )
  const availability = defaultLimiter.getAvailabilityRatio(sourceId)
  m.efficiencyScore = (1 / (1 + Math.log(1 + m.ewmaLatencyMs / LATENCY_LOG_SCALE_MS))) * availability
  m.combinedScore = computeCombinedScore(m, config, availability)

  metricsRegistry.set(sourceId, m)
}

/** 读取源健康指标；未观测源返回乐观初始值 */
export function getSourceMetrics(sourceId: string): SourceHealthMetrics {
  const m = metricsRegistry.get(sourceId)
  return m ? { ...m } : createInitialMetrics()
}

/**
 * 查询源是否允许执行请求（熔断器门禁）。
 * 委托至模块级 defaultBreaker，供 multiSourceFetcher / dataSourceOrchestrator / collectionPipeline 调用。
 * open 状态的源返回 false，调用方应跳过该源不发网络请求。
 * @param sourceId 数据源 id（如 'tushare'、'crawler'）
 * @returns 允许执行返回 true，熔断中返回 false
 */
export function canExecute(sourceId: string): boolean {
  return defaultBreaker.canExecute(sourceId)
}

/** 清空指标注册表 / 限流器 / 熔断器（测试用） */
export function resetAdaptiveOrchestrator(): void {
  metricsRegistry.clear()
  defaultLimiter.reset()
  defaultBreaker.reset()
  logger.info('[AdaptiveOrchestrator] 自适应编排状态已重置')
}

// ─── 自适应链排序 ────────────────────────────────────────────

/**
 * 按综合分降序重排降级链（熔断 open 源 combinedScore=0 自然沉底）
 *
 * 纯读取当前指标快照，不修改 dataSourceOrchestrator 现有静态链逻辑；
 * 调用方可在 resolveQuoteChain 之外用本函数获得自适应顺序。
 *
 * @param chain 原始降级链（源 id 数组）
 * @param config 自适应配置，缺省 DEFAULT_ADAPTIVE_CONFIG
 * @returns 重排后的新数组（不改入参；同分保持原相对顺序，冷启动全源同分 → 退化为原顺序）
 * @example orderChainAdaptive(['tushare', 'tencent', 'mock']) // 按实时健康分降序
 */
export function orderChainAdaptive<T extends string>(
  chain: readonly T[],
  config: AdaptiveSourceConfig = DEFAULT_ADAPTIVE_CONFIG,
): T[] {
  return chain
    .map((id) => {
      const m = metricsRegistry.get(id) ?? createInitialMetrics()
      m.circuitState = defaultBreaker.getCircuitState(id)
      return { id, score: computeCombinedScore(m, config, defaultLimiter.getAvailabilityRatio(id)) }
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.id)
}

// ─── 退避工具 ────────────────────────────────────────────────

/**
 * 计算第 attempt 次重试的退避延迟：指数退避 + 抖动（自包含实现）
 *
 * capped = min(baseDelayMs × factor^attempt, maxDelayMs)
 * delay  = floor(capped × (1 − jitterRatio + random × jitterRatio))
 * jitterRatio=1 全抖动 [0, capped]；jitterRatio=0 退化为固定 capped。
 *
 * @param attempt 重试序号（从 0 开始）
 * @param config 自适应配置（使用 retry 段）
 * @returns 延迟毫秒数，恒满足 0 ≤ delay ≤ capped ≤ maxDelayMs
 * @example await sleep(computeRetryDelayMs(2, DEFAULT_ADAPTIVE_CONFIG))
 */
export function computeRetryDelayMs(
  attempt: number,
  config: AdaptiveSourceConfig = DEFAULT_ADAPTIVE_CONFIG,
): number {
  const { baseDelayMs, maxDelayMs, factor, jitterRatio } = config.retry
  const capped = Math.min(baseDelayMs * Math.pow(factor, Math.max(0, attempt)), maxDelayMs)
  const jitterFactor = 1 - clamp01(jitterRatio) + Math.random() * clamp01(jitterRatio)
  return Math.floor(capped * jitterFactor)
}

/**
 * 将采集配置 `RetryPolicy` 适配为统一退避延迟（退避逻辑唯一入口）。
 *
 * 字段映射：initialDelayMs→baseDelayMs、backoffMultiplier→factor；
 * 上限沿用 DEFAULT_ADAPTIVE_CONFIG.retry.maxDelayMs，全抖动 [0, capped]。
 * dataSourceOrchestrator 的行情/K 线重试循环应调用本函数，禁止另写退避实现。
 *
 * @param policy 采集配置重试策略（retryPolicy ?? DEFAULT_RETRY_POLICY）
 * @param attempt 重试序号（从 0 开始）
 */
export function computePolicyBackoffMs(policy: RetryPolicy, attempt: number): number {
  const adapted: AdaptiveSourceConfig = {
    ...DEFAULT_ADAPTIVE_CONFIG,
    retry: {
      baseDelayMs: Math.max(1, policy.initialDelayMs),
      maxDelayMs: DEFAULT_ADAPTIVE_CONFIG.retry.maxDelayMs,
      factor: Math.max(1, policy.backoffMultiplier),
      jitterRatio: DEFAULT_ADAPTIVE_CONFIG.retry.jitterRatio,
    },
  }
  return computeRetryDelayMs(attempt, adapted)
}
