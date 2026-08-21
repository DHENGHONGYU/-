/**
 * @module MonthlyBudgetGuard
 * @description 采集管线月度 API 预算守卫（GAP-4 治理工具链补实现，2026-08-22）。
 *
 * 职责：
 * - 基于 GLOBAL_LIMITS.rateLimitPerDay 推导月度总额度
 * - 基于维度配置（enabled × frequency × batchSize × symbolCount）预估计划调用量
 * - 按维度重要性加权（budgetPriorityWeights）评估预算压力
 * - 输出 ok / warning / critical / exceeded 四级状态与原因列表
 *
 * 设计说明：
 * - 纯函数式实现，不持久化、不发网络请求；消耗量由调用方注入
 *   （生产环境来自 qualityMetricsCollector / trace_records 统计）。
 * - 阈值常量含义与 collection-pipeline-governance Skill 对齐：
 *   距月末 > 10 天且余额 < 15% 触发 critical（Skill 触发条件 7）。
 *
 * @doc [V9-DOC-DATA-047, V9-DOC-DATA-068]
 */

import {
  GLOBAL_LIMITS,
  estimateTotalMonthlyCalls,
  estimateMonthlyCalls,
} from '@/config/collectConfig'
import type {
  DimensionConfig,
  DimensionImportance,
} from '@/types/modules/collection.types'

// ============================================================
// 类型
// ============================================================

/** 预算健康度四级状态 */
export type BudgetStatus = 'ok' | 'warning' | 'critical' | 'exceeded'

/** 预算评估结果快照 */
export interface BudgetEvaluation {
  /** 月度总额度（次/月） */
  budget: number
  /** 当前配置的计划调用量（次/月，未加权） */
  planned: number
  /** 按维度重要性加权后的计划调用量（次/月） */
  weightedPlanned: number
  /** 本月已消耗调用量（次，调用方注入） */
  consumed: number
  /** 剩余额度（次） */
  remaining: number
  /** 距月末天数 */
  daysLeft: number
  /** 剩余天数的日均可用额度（次/天） */
  dailyAllowance: number
  /** 已消耗占预算比例 [0, +∞) */
  usageRatio: number
  /** 四级状态 */
  status: BudgetStatus
  /** 触发 warning/critical/exceeded 的原因列表（ok 时为空） */
  reasons: string[]
}

/** sanityCheck 自检结果 */
export interface BudgetSanityResult {
  ok: boolean
  issues: string[]
}

// ============================================================
// 优先级权重表（Scenario D 调整时必须与阈值成对评审）
// ============================================================

/**
 * 维度重要性 → 预算权重。
 * critical 维度全额计入预算压力；low 维度按 0.3 折算。
 * 2026-08-22 v1.0.0 初版：与 IMPORTANCE_LABELS 四档对齐。
 */
export const BUDGET_PRIORITY_WEIGHTS: Readonly<Record<DimensionImportance, number>> = {
  critical: 1.0,
  high: 0.8,
  medium: 0.5,
  low: 0.3,
}

// ============================================================
// MonthlyBudgetGuard
// ============================================================

export class MonthlyBudgetGuard {
  /** 消耗占比达到该值进入 warning */
  static readonly WARNING_USAGE_RATIO = 0.85
  /** 距月末天数大于该值且余额占比低于 CRITICAL_REMAINING_RATIO 时进入 critical */
  static readonly CRITICAL_DAYS_LEFT = 10
  /** 余额占比低于该值（且距月末较远）进入 critical */
  static readonly CRITICAL_REMAINING_RATIO = 0.15

  /**
   * 当月天数（28-31）。
   * @param now 参考日期
   */
  static daysInMonth(now: Date): number {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  }

  /**
   * 距月末天数（含今天，最小 1）。
   * @param now 参考日期
   */
  static daysLeftInMonth(now: Date): number {
    return Math.max(1, MonthlyBudgetGuard.daysInMonth(now) - now.getDate() + 1)
  }

  /**
   * 月度总额度（次/月）= 每日限流 × 当月天数。
   * @param now 参考日期
   */
  getMonthlyBudget(now: Date = new Date()): number {
    return GLOBAL_LIMITS.rateLimitPerDay * MonthlyBudgetGuard.daysInMonth(now)
  }

  /**
   * 预估当前配置的月计划调用量（未加权）。
   * @param dimensions 维度配置数组
   * @param symbolCount 标的数
   */
  estimatePlanned(dimensions: DimensionConfig[], symbolCount: number): number {
    return estimateTotalMonthlyCalls(dimensions, symbolCount)
  }

  /**
   * 预估按维度重要性加权后的月计划调用量。
   * @param dimensions 维度配置数组
   * @param symbolCount 标的数
   */
  estimateWeightedPlanned(dimensions: DimensionConfig[], symbolCount: number): number {
    return dimensions.reduce((total, dim) => {
      const calls = estimateMonthlyCalls(dim, symbolCount)
      const weight = BUDGET_PRIORITY_WEIGHTS[dim.importance] ?? 1
      return total + Math.ceil(calls * weight)
    }, 0)
  }

  /**
   * 预估日均调用量（次/天）。
   * @param dimensions 维度配置数组
   * @param symbolCount 标的数
   * @param now 参考日期
   */
  estimateDailyCalls(dimensions: DimensionConfig[], symbolCount: number, now: Date = new Date()): number {
    return Math.ceil(this.estimatePlanned(dimensions, symbolCount) / MonthlyBudgetGuard.daysInMonth(now))
  }

  /**
   * 剩余额度（次）。
   * @param consumed 本月已消耗
   * @param now 参考日期
   */
  getRemainingBudget(consumed: number = 0, now: Date = new Date()): number {
    return Math.max(0, this.getMonthlyBudget(now) - consumed)
  }

  /**
   * 综合评估预算健康度。
   *
   * 判定顺序（先严重后轻微）：
   * 1. consumed > budget → exceeded
   * 2. daysLeft > 10 且 remainingRatio < 15% → critical（Skill 触发条件 7 同口径）
   * 3. usageRatio ≥ 85% 或 planned > remaining → warning
   * 4. 否则 ok
   *
   * @param dimensions 维度配置数组
   * @param symbolCount 标的数
   * @param consumed 本月已消耗调用量
   * @param now 参考日期
   */
  evaluate(
    dimensions: DimensionConfig[],
    symbolCount: number,
    consumed: number = 0,
    now: Date = new Date(),
  ): BudgetEvaluation {
    const budget = this.getMonthlyBudget(now)
    const planned = this.estimatePlanned(dimensions, symbolCount)
    const weightedPlanned = this.estimateWeightedPlanned(dimensions, symbolCount)
    const remaining = Math.max(0, budget - consumed)
    const daysLeft = MonthlyBudgetGuard.daysLeftInMonth(now)
    const dailyAllowance = Math.floor(remaining / daysLeft)
    const usageRatio = budget > 0 ? consumed / budget : 1
    const remainingRatio = budget > 0 ? remaining / budget : 0

    const reasons: string[] = []
    let status: BudgetStatus = 'ok'

    if (consumed > budget) {
      status = 'exceeded'
      reasons.push(`已消耗 ${consumed} 次，超出月度预算 ${budget} 次`)
    } else if (
      daysLeft > MonthlyBudgetGuard.CRITICAL_DAYS_LEFT &&
      remainingRatio < MonthlyBudgetGuard.CRITICAL_REMAINING_RATIO
    ) {
      status = 'critical'
      reasons.push(
        `距月末 ${daysLeft} 天但余额占比仅 ${(remainingRatio * 100).toFixed(1)}%（< 15%），存在提前耗尽风险`,
      )
    } else if (usageRatio >= MonthlyBudgetGuard.WARNING_USAGE_RATIO) {
      status = 'warning'
      reasons.push(`消耗占比 ${(usageRatio * 100).toFixed(1)}% ≥ 85%`)
    }

    if (planned > remaining) {
      if (status === 'ok') status = 'warning'
      reasons.push(`计划月调用 ${planned} 次 > 剩余额度 ${remaining} 次，需降频或缩减维度`)
    }

    return {
      budget, planned, weightedPlanned, consumed, remaining,
      daysLeft, dailyAllowance, usageRatio, status, reasons,
    }
  }

  /**
   * 自检：额度为正、权重表合法（取值 (0,1] 且 critical=1.0）。
   * 供单元测试与 CI 门禁调用。
   */
  sanityCheck(): BudgetSanityResult {
    const issues: string[] = []

    if (this.getMonthlyBudget() <= 0) {
      issues.push('月度预算 ≤ 0：GLOBAL_LIMITS.rateLimitPerDay 配置异常')
    }

    for (const [level, weight] of Object.entries(BUDGET_PRIORITY_WEIGHTS)) {
      if (!(weight > 0 && weight <= 1)) {
        issues.push(`权重 ${level}=${weight} 越界（合法区间 (0,1]）`)
      }
    }
    if (BUDGET_PRIORITY_WEIGHTS.critical !== 1.0) {
      issues.push('critical 权重必须为 1.0（核心维度全额计入预算）')
    }

    return { ok: issues.length === 0, issues }
  }
}

/** 全局单例 */
export const monthlyBudgetGuard = new MonthlyBudgetGuard()
