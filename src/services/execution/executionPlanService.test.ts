/**
 * @module executionPlanService.test
 * @description 执行计划服务单元测试（E-2-6）
 */

 
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dataLayer
vi.mock('@/data/dataLayer', () => ({
  executionPlanStore: {
    list: vi.fn(),
    getAll: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
  },
  executionLogStore: {
    save: vi.fn(),
    listByPlan: vi.fn(),
    listBySymbol: vi.fn(),
    list: vi.fn(),
  },
}))

// Mock dataFreshnessGuard（避免 logger 噪音）
vi.mock('@/services/analysis/dataFreshnessGuard', () => ({
  checkExecutionPlanFreshness: vi.fn(() => ({ valid: true })),
  checkExecutionLogFreshness: vi.fn(() => ({ valid: true })),
}))

import { executionPlanStore, executionLogStore } from '@/data/dataLayer'
import {
  createPlan,
  listPlans,
  updatePhase,
  cancelPlan,
  getOrphanPlans,
} from '@/services/execution/executionPlanService'
import { EXECUTION_PHASE } from '@/constants/execution.constants'
import type { Signal, ExecutionPlan } from '@/data/types'

const mockSignal = (overrides: Partial<Signal> = {}): Signal => ({
  id: 'sig_001',
  symbol: '600000',
  action: 'buy',
  confidence: 0.8,
  createdAt: 1_000,
  ...overrides,
} as Signal)

const mockPlan = (overrides: Partial<ExecutionPlan> = {}): ExecutionPlan => ({
  id: 'plan_001',
  signalId: 'sig_001',
  symbol: '600000',
  name: '测试股票',
  direction: 'buy',
  phase: EXECUTION_PHASE.PLAN,
  quantity: 100,
  targetPrice: 10.0,
  rationale: '测试理由',
  confidence: 0.8,
  riskChecks: [],
  accountType: 'paper',
  createdAt: 2_000,
  ...overrides,
})

describe('executionPlanService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(executionLogStore.save).mockResolvedValue({ success: true, data: {} as any })
  })

  describe('createPlan', () => {
    it('creates a plan when signal confidence exceeds threshold', async () => {
      vi.mocked(executionPlanStore.save).mockResolvedValue({ success: true, data: {} as any })
      const plan = await createPlan(mockSignal({ confidence: 0.8 }), { now: 2_000 })
      expect(plan).toBeDefined()
      expect(plan!.symbol).toBe('600000')
      expect(plan!.phase).toBe(EXECUTION_PHASE.PLAN)
      expect(executionPlanStore.save).toHaveBeenCalledTimes(1)
    })

    it('returns undefined when signal confidence below threshold', async () => {
      const plan = await createPlan(mockSignal({ confidence: 0.3 }), { now: 2_000 })
      expect(plan).toBeUndefined()
      expect(executionPlanStore.save).not.toHaveBeenCalled()
    })

    it('returns undefined when save fails', async () => {
      vi.mocked(executionPlanStore.save).mockResolvedValue({ success: false, error: 'db_error' })
      const plan = await createPlan(mockSignal(), { now: 2_000 })
      expect(plan).toBeUndefined()
    })

    it('writes a creation log after plan is saved', async () => {
      vi.mocked(executionPlanStore.save).mockResolvedValue({ success: true, data: {} as any })
      await createPlan(mockSignal(), { now: 2_000 })
      expect(executionLogStore.save).toHaveBeenCalledTimes(1)
    })
  })

  describe('listPlans', () => {
    it('returns all plans when no symbol provided', async () => {
      const plans = [mockPlan(), mockPlan({ id: 'plan_002', symbol: '600001' })]
      vi.mocked(executionPlanStore.getAll).mockResolvedValue(plans)
      const result = await listPlans()
      expect(result).toHaveLength(2)
    })

    it('filters plans by symbol', async () => {
      const plans = [mockPlan(), mockPlan({ id: 'plan_002', symbol: '600001' })]
      vi.mocked(executionPlanStore.getAll).mockResolvedValue(plans)
      const result = await listPlans('600000')
      expect(result).toHaveLength(1)
      expect(result[0]!.symbol).toBe('600000')
    })
  })

  describe('updatePhase', () => {
    it('advances phase when transition is allowed', async () => {
      vi.mocked(executionPlanStore.get).mockResolvedValue(mockPlan())
      vi.mocked(executionPlanStore.update).mockResolvedValue({ success: true, data: {} as any })
      const updated = await updatePhase('plan_001', EXECUTION_PHASE.CONFIRMED, { now: 3_000 })
      expect(updated).toBeDefined()
      expect(updated!.phase).toBe(EXECUTION_PHASE.CONFIRMED)
      expect(updated!.confirmedAt).toBe(3_000)
    })

    it('rejects invalid phase transition', async () => {
      vi.mocked(executionPlanStore.get).mockResolvedValue(mockPlan({ phase: EXECUTION_PHASE.EXECUTED }))
      const updated = await updatePhase('plan_001', EXECUTION_PHASE.CONFIRMED)
      expect(updated).toBeUndefined()
      expect(executionPlanStore.update).not.toHaveBeenCalled()
    })

    it('returns undefined when plan not found', async () => {
      vi.mocked(executionPlanStore.get).mockResolvedValue(undefined)
      const updated = await updatePhase('plan_999', EXECUTION_PHASE.CONFIRMED)
      expect(updated).toBeUndefined()
    })
  })

  describe('cancelPlan', () => {
    it('cancels a plan in plan phase', async () => {
      vi.mocked(executionPlanStore.get).mockResolvedValue(mockPlan())
      vi.mocked(executionPlanStore.update).mockResolvedValue({ success: true, data: {} as any })
      const cancelled = await cancelPlan('plan_001', { now: 5_000 })
      expect(cancelled).toBeDefined()
      expect(cancelled!.phase).toBe(EXECUTION_PHASE.CANCELLED)
    })

    it('rejects cancel when phase does not allow it', async () => {
      vi.mocked(executionPlanStore.get).mockResolvedValue(mockPlan({ phase: EXECUTION_PHASE.REVIEWED }))
      const cancelled = await cancelPlan('plan_001')
      expect(cancelled).toBeUndefined()
    })
  })

  describe('getOrphanPlans', () => {
    it('returns non-terminal plans', async () => {
      vi.mocked(executionPlanStore.getAll).mockResolvedValue([
        mockPlan({ phase: EXECUTION_PHASE.PLAN }),
        mockPlan({ id: 'plan_002', phase: EXECUTION_PHASE.EXECUTED }),
        mockPlan({ id: 'plan_003', phase: EXECUTION_PHASE.CONFIRMED }),
      ])
      const orphans = await getOrphanPlans()
      expect(orphans).toHaveLength(2)
    })
  })
})
