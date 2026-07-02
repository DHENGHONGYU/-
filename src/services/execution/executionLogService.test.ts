/**
 * @module executionLogService.test
 * @description 执行日志服务单元测试（E-2-6）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/data/dataLayer', () => ({
  executionLogStore: {
    save: vi.fn(),
    listByPlan: vi.fn(),
    listBySymbol: vi.fn(),
    list: vi.fn(),
  },
}))

vi.mock('@/services/analysis/dataFreshnessGuard', () => ({
  checkExecutionLogFreshness: vi.fn(() => ({ valid: true })),
}))

import { executionLogStore } from '@/data/dataLayer'
import { writeLog, listByPlan, listBySymbol, listFailed } from '@/services/execution/executionLogService'
import { EXECUTION_PHASE, EXECUTION_LOG_ACTION } from '@/constants/execution.constants'
import type { ExecutionPlan } from '@/data/types'

const mockPlan = (overrides: Partial<ExecutionPlan> = {}): ExecutionPlan => ({
  id: 'plan_001',
  signalId: 'sig_001',
  symbol: '600000',
  direction: 'buy',
  phase: EXECUTION_PHASE.PLAN,
  confidence: 0.8,
  accountType: 'paper',
  createdAt: 2_000,
  ...overrides,
})

describe('executionLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('writeLog', () => {
    it('writes a log entry with correct action', async () => {
      vi.mocked(executionLogStore.save).mockResolvedValue({ success: true, data: {} as any } as any)
      const log = await writeLog(mockPlan(), EXECUTION_LOG_ACTION.CREATE, { now: 3_000, actor: 'user' })
      expect(log).toBeDefined()
      expect(log!.action).toBe(EXECUTION_LOG_ACTION.CREATE)
      expect(log!.actor).toBe('user')
      expect(executionLogStore.save).toHaveBeenCalledTimes(1)
    })

    it('returns undefined when save fails', async () => {
      vi.mocked(executionLogStore.save).mockResolvedValue({ success: false, error: 'db_error' } as any)
      const log = await writeLog(mockPlan(), EXECUTION_LOG_ACTION.EXECUTE)
      expect(log).toBeUndefined()
    })
  })

  describe('listByPlan', () => {
    it('returns logs sorted by timestamp ascending', async () => {
      const logs = [
        { id: 2, planId: 'plan_001', symbol: '600000', phase: 'plan', action: 'create', actor: 'system', timestamp: 3_000, success: true },
        { id: 1, planId: 'plan_001', symbol: '600000', phase: 'plan', action: 'create', actor: 'system', timestamp: 2_000, success: true },
      ]
      vi.mocked(executionLogStore.listByPlan).mockResolvedValue(logs as any)
      const result = await listByPlan('plan_001')
      expect(result).toHaveLength(2)
      expect(result[0]!.timestamp).toBe(2_000)
      expect(result[1]!.timestamp).toBe(3_000)
    })
  })

  describe('listBySymbol', () => {
    it('returns logs for a symbol', async () => {
      vi.mocked(executionLogStore.listBySymbol).mockResolvedValue([
        { id: 1, planId: 'plan_001', symbol: '600000', phase: 'plan', action: 'create', actor: 'system', timestamp: 2_000, success: true },
      ] as any)
      const result = await listBySymbol('600000')
      expect(result).toHaveLength(1)
    })
  })

  describe('listFailed', () => {
    it('returns only failed logs', async () => {
      vi.mocked(executionLogStore.list).mockResolvedValue([
        { id: 1, planId: 'plan_001', symbol: '600000', phase: 'plan', action: 'create', actor: 'system', timestamp: 2_000, success: true },
        { id: 2, planId: 'plan_002', symbol: '600001', phase: 'execute', action: 'execute', actor: 'system', timestamp: 3_000, success: false },
      ] as any)
      const result = await listFailed()
      expect(result).toHaveLength(1)
      expect(result[0]!.success).toBe(false)
    })
  })
})
