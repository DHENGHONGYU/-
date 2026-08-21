/**
 * @fileoverview MonthlyBudgetGuard 单元测试
 *
 * 覆盖：月度预算推导、计划/加权预估、四级状态判定（含 Skill 触发条件 7 口径）、
 * sanityCheck 自检。对应 collection-pipeline-governance Skill 交付物 #9。
 */

import { describe, it, expect } from 'vitest'
import {
  MonthlyBudgetGuard,
  BUDGET_PRIORITY_WEIGHTS,
  monthlyBudgetGuard,
} from './MonthlyBudgetGuard'
import { GLOBAL_LIMITS, DEFAULT_DIMENSIONS } from '@/config/collectConfig'
import type { DimensionConfig } from '@/types/modules/collection.types'

const guard = new MonthlyBudgetGuard()

/** 构造一个最小维度配置 */
function makeDim(overrides: Partial<DimensionConfig>): DimensionConfig {
  return {
    code: '99',
    name: '测试维度',
    enabled: true,
    frequency: 'daily',
    batchSize: 10,
    sources: ['akshare'],
    cacheTtl: 1440,
    storageType: 'full',
    fields: [],
    importance: 'medium',
    ...overrides,
  }
}

describe('MonthlyBudgetGuard · 预算推导', () => {
  it('月度预算 = 每日限流 × 当月天数', () => {
    const now = new Date(2026, 0, 15) // 2026-01 有 31 天
    expect(guard.getMonthlyBudget(now)).toBe(GLOBAL_LIMITS.rateLimitPerDay * 31)
  })

  it('daysInMonth 覆盖 2 月闰年/平年', () => {
    expect(MonthlyBudgetGuard.daysInMonth(new Date(2026, 1, 10))).toBe(28) // 2026 平年
    expect(MonthlyBudgetGuard.daysInMonth(new Date(2028, 1, 10))).toBe(29) // 2028 闰年
  })

  it('daysLeftInMonth 含今天且月末当天为 1', () => {
    expect(MonthlyBudgetGuard.daysLeftInMonth(new Date(2026, 0, 15))).toBe(17)
    expect(MonthlyBudgetGuard.daysLeftInMonth(new Date(2026, 0, 31))).toBe(1)
  })

  it('getRemainingBudget 不为负', () => {
    expect(guard.getRemainingBudget(0, new Date(2026, 0, 15))).toBe(GLOBAL_LIMITS.rateLimitPerDay * 31)
    expect(guard.getRemainingBudget(999999, new Date(2026, 0, 15))).toBe(0)
  })
})

describe('MonthlyBudgetGuard · 计划预估', () => {
  it('禁用维度与 manual 频率不计入计划', () => {
    const dims = [
      makeDim({ code: '98', enabled: false }),
      makeDim({ code: '97', frequency: 'manual' }),
    ]
    expect(guard.estimatePlanned(dims, 100)).toBe(0)
    expect(guard.estimateWeightedPlanned(dims, 100)).toBe(0)
  })

  it('加权计划 ≤ 未加权计划（权重 ≤ 1）', () => {
    const planned = guard.estimatePlanned(DEFAULT_DIMENSIONS, 40)
    const weighted = guard.estimateWeightedPlanned(DEFAULT_DIMENSIONS, 40)
    expect(planned).toBeGreaterThan(0)
    expect(weighted).toBeGreaterThan(0)
    expect(weighted).toBeLessThanOrEqual(planned)
  })

  it('estimateDailyCalls = 月计划 / 当月天数（向上取整）', () => {
    const now = new Date(2026, 0, 15)
    const planned = guard.estimatePlanned(DEFAULT_DIMENSIONS, 40)
    expect(guard.estimateDailyCalls(DEFAULT_DIMENSIONS, 40, now)).toBe(Math.ceil(planned / 31))
  })
})

describe('MonthlyBudgetGuard · 状态判定', () => {
  const now = new Date(2026, 0, 5) // 月初，距月末 27 天
  const dims = [makeDim({})]
  const budget = guard.getMonthlyBudget(now)

  it('零消耗 → ok', () => {
    const result = guard.evaluate([], 40, 0, now)
    expect(result.status).toBe('ok')
    expect(result.reasons).toHaveLength(0)
  })

  it('消耗超预算 → exceeded', () => {
    const result = guard.evaluate(dims, 10, budget + 1, now)
    expect(result.status).toBe('exceeded')
  })

  it('消耗占比 ≥ 85% → warning', () => {
    // 用月末日期（距月末 7 天 ≤ 10）隔离 critical 分支，单独验证 85% 阈值 → warning
    // （月初 90% 消耗的 critical 优先级口径由下一个用例覆盖）
    const lateMonth = new Date(2026, 0, 25)
    const result = guard.evaluate(dims, 10, Math.ceil(budget * 0.9), lateMonth)
    expect(result.status).toBe('warning')
  })

  it('距月末 > 10 天且余额 < 15% → critical（Skill 触发条件 7 口径）', () => {
    // 月初消耗 90%：usageRatio 高但同时 remainingRatio = 10% < 15%，critical 优先于 warning
    const result = guard.evaluate([], 40, Math.floor(budget * 0.9), now)
    expect(result.status).toBe('critical')
  })

  it('月末最后 5 天余额 10% → warning（不触发 critical 的天数条件）', () => {
    const monthEnd = new Date(2026, 0, 27) // 距月末 5 天
    const result = guard.evaluate([], 40, Math.floor(budget * 0.9), monthEnd)
    expect(result.status).toBe('warning')
  })

  it('计划调用 > 剩余额度 → 至少 warning 且含降频建议', () => {
    // 消耗 50%，剩余 31000；用一个超高频维度把计划顶上去
    const hungry = [makeDim({ frequency: 'realtime', batchSize: 1, importance: 'critical' })]
    const result = guard.evaluate(hungry, 500, Math.floor(budget * 0.5), now)
    expect(['warning', 'critical', 'exceeded']).toContain(result.status)
    expect(result.reasons.some((r) => r.includes('降频'))).toBe(true)
  })
})

describe('MonthlyBudgetGuard · sanityCheck', () => {
  it('默认配置自检通过', () => {
    const result = guard.sanityCheck()
    expect(result.ok).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('单例与权重表导出可用', () => {
    expect(monthlyBudgetGuard).toBeInstanceOf(MonthlyBudgetGuard)
    expect(BUDGET_PRIORITY_WEIGHTS.critical).toBe(1.0)
  })
})
