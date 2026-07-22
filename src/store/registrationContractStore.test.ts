/**
 * @test_id V9-TEST-ST-REG-CONTRACT
 * @fileoverview registrationContractStore 单元测试
 *
 * 覆盖场景：
 * 1. 初始状态验证
 * 2. queryStatus 成功 —— 更新 result / lastInput
 * 3. queryStatus 异常 —— 设置 error
 * 4. clearResult —— 清空 result 和 lastInput
 * 5. reset —— 恢复初始状态
 * @covers_docs [V9-DOC-DATA-031, V9-DOC-DATA-032, V9-DOC-DATA-076]
*/

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================
// vi.hoisted mocks
// ============================================================

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ getLogger: () => mockLogger }))

const mockQueryStatusService = vi.hoisted(() => vi.fn())
vi.mock('@/services/analysis/registrationContractService', () => ({
  queryStatusService: mockQueryStatusService,
}))

// ============================================================
// Imports（mock 之后）
// ============================================================

import { useRegistrationContractStore } from './registrationContractStore'
import type { StatusQueryInput, StatusQueryResult } from '@/types/modules/registration-contract.types'

// ============================================================
// Helpers
// ============================================================

function buildTestResult(): StatusQueryResult {
  return {
    queriedAt: '2026-07-22T10:00:00Z',
    registration: {
      userId: 'user-001',
      phase: 'active',
      registeredAt: '2026-01-01T00:00:00Z',
      activatedAt: '2026-01-02T00:00:00Z',
      channel: 'web',
      verified: true,
      anomalies: [],
    },
    contracts: [
      {
        contractId: 'contract-001',
        name: '标准服务契约',
        signedAt: '2026-01-05T00:00:00Z',
        effectiveAt: '2026-01-05T00:00:00Z',
        expiresAt: '2027-01-05T00:00:00Z',
        phase: 'active',
        progress: 60,
        milestones: [],
        breachRecords: [],
        anomalies: [],
      },
    ],
    summary: {
      totalAnomalies: 0,
      registrationAnomalies: 0,
      contractAnomalies: 0,
      activeContracts: 1,
      breachedContracts: 0,
      healthScore: 95,
    },
  }
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  useRegistrationContractStore.setState({
    result: null,
    loading: false,
    error: null,
    lastInput: null,
  }, false)

  vi.clearAllMocks()
  mockQueryStatusService.mockReset()
})

// ============================================================
// Tests
// ============================================================

describe('useRegistrationContractStore', () => {
  describe('初始状态', () => {
    it('应具有正确的初始状态', () => {
      const state = useRegistrationContractStore.getState()
      expect(state.result).toBeNull()
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.lastInput).toBeNull()
    })
  })

  describe('queryStatus', () => {
    it('成功：应更新 result 和 lastInput，loading 过程正确', async () => {
      const input: StatusQueryInput = { userId: 'user-001' }
      const result = buildTestResult()
      mockQueryStatusService.mockResolvedValue(result)

      // 检查 loading 期间状态
      const loadPromise = useRegistrationContractStore.getState().queryStatus(input)
      expect(useRegistrationContractStore.getState().loading).toBe(true)
      expect(useRegistrationContractStore.getState().error).toBeNull()
      await loadPromise

      const state = useRegistrationContractStore.getState()
      expect(state.result).toEqual(result)
      expect(state.loading).toBe(false)
      expect(state.lastInput).toEqual(input)
    })

    it('异常：应设置 error 且 loading 恢复为 false', async () => {
      const input: StatusQueryInput = { userId: 'user-002' }
      mockQueryStatusService.mockRejectedValue(new Error('查询服务不可用'))

      await useRegistrationContractStore.getState().queryStatus(input)

      const state = useRegistrationContractStore.getState()
      expect(state.error).toBe('查询服务不可用')
      expect(state.loading).toBe(false)
      expect(state.lastInput).toEqual(input)
      // result 保持不变（之前为 null）
      expect(state.result).toBeNull()
    })
  })

  describe('clearResult', () => {
    it('应清空 result 和 lastInput', () => {
      const input: StatusQueryInput = { userId: 'user-001' }
      useRegistrationContractStore.setState({
        result: buildTestResult(),
        lastInput: input,
      })

      useRegistrationContractStore.getState().clearResult()

      expect(useRegistrationContractStore.getState().result).toBeNull()
      expect(useRegistrationContractStore.getState().lastInput).toBeNull()
    })
  })

  describe('reset', () => {
    it('应重置所有状态到初始值', () => {
      useRegistrationContractStore.setState({
        result: buildTestResult(),
        loading: true,
        error: 'some error',
        lastInput: { userId: 'user-001' },
      })

      useRegistrationContractStore.getState().reset()

      const state = useRegistrationContractStore.getState()
      expect(state.result).toBeNull()
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.lastInput).toBeNull()
    })
  })
})
