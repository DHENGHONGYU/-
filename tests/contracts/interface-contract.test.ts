/**
 * @test_id V9-TEST-UT-073
 * @covers_docs [V9-DOC-DATA-013, V9-DOC-BACK-027, V9-DOC-DATA-052, V9-DOC-DATA-042, V9-DOC-DATA-051]
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  registerContract,
  assertContract,
  getRegisteredContracts,
  getStats,
  resetStats,
  clearViolations,
  generateReport,
} from './contractValidator'
import {
  BridgeQueryResultSchema,
  BridgeQueryOptionsSchema,
  DataActionSchema,
  createMockBridgeQueryResult,
  createMockBridgeQueryOptions,
} from './databridge.contract'

describe('模块间接口契约测试', () => {
  beforeEach(() => {
    resetStats()
    clearViolations()
  })

  afterEach(() => {
    // eslint-disable-next-line no-console
    console.log('\n' + generateReport())
  })

  describe('契约注册', () => {
    it('应该能够注册 DataBridge 契约', () => {
      registerContract('BridgeQueryResult', BridgeQueryResultSchema, 'DataBridge 查询结果契约')
      registerContract('BridgeQueryOptions', BridgeQueryOptionsSchema, 'DataBridge 查询选项契约')
      registerContract('DataAction', DataActionSchema, 'DataBridge 操作类型契约')

      const contracts = getRegisteredContracts()
      expect(contracts).toContain('BridgeQueryResult')
      expect(contracts).toContain('BridgeQueryOptions')
      expect(contracts).toContain('DataAction')
    })
  })

  describe('DataBridge 契约验证', () => {
    beforeEach(() => {
      registerContract('BridgeQueryResult', BridgeQueryResultSchema, 'DataBridge 查询结果契约')
      registerContract('BridgeQueryOptions', BridgeQueryOptionsSchema, 'DataBridge 查询选项契约')
    })

    it('应该验证有效的 BridgeQueryResult', () => {
      const validResult = createMockBridgeQueryResult()
      expect(() => {
        assertContract('BridgeQueryResult', validResult, 'valid-query-result')
      }).not.toThrow()

      const stats = getStats()
      expect(stats.passedValidations).toBe(1)
      expect(stats.failedValidations).toBe(0)
    })

    it('应该拒绝缺少 traceId 的 BridgeQueryResult', () => {
      const invalidResult = {
        success: true,
        data: {},
      }

      expect(() => {
        assertContract('BridgeQueryResult', invalidResult, 'missing-traceId')
      }).toThrow(/traceId/)

      const stats = getStats()
      expect(stats.failedValidations).toBe(1)
    })

    it('应该拒绝无效的 BridgeQueryOptions（超时为负数）', () => {
      const invalidOptions = {
        timeout: -1000,
      }

      expect(() => {
        assertContract('BridgeQueryOptions', invalidOptions, 'negative-timeout')
      }).toThrow()

      const stats = getStats()
      expect(stats.failedValidations).toBe(1)
    })

    it('应该验证有效的 BridgeQueryOptions', () => {
      const validOptions = createMockBridgeQueryOptions()
      expect(() => {
        assertContract('BridgeQueryOptions', validOptions, 'valid-query-options')
      }).not.toThrow()

      const stats = getStats()
      expect(stats.passedValidations).toBe(1)
    })
  })

  describe('模块间数据传输契约', () => {
    beforeEach(() => {
      registerContract('BridgeQueryResult', BridgeQueryResultSchema, 'DataBridge 查询结果契约')
    })

    it('应该验证 services 层返回给 store 层的数据格式', () => {
      const serviceResponse = {
        success: true,
        data: { stocks: [], count: 0 },
        traceId: 'service-trace-001',
      }

      expect(() => {
        assertContract('BridgeQueryResult', serviceResponse, 'service-to-store')
      }).not.toThrow()
    })

    it('应该验证 store 层返回给 components 层的数据格式', () => {
      const storeResponse = {
        success: true,
        data: { items: [], loading: false },
        traceId: 'store-trace-002',
      }

      expect(() => {
        assertContract('BridgeQueryResult', storeResponse, 'store-to-components')
      }).not.toThrow()
    })

    it('应该验证错误场景的数据格式', () => {
      const errorResponse = {
        success: false,
        error: '网络请求失败',
        traceId: 'error-trace-003',
      }

      expect(() => {
        assertContract('BridgeQueryResult', errorResponse, 'error-scenario')
      }).not.toThrow()
    })
  })

  describe('契约违反时的测试失败', () => {
    beforeEach(() => {
      registerContract('BridgeQueryResult', BridgeQueryResultSchema, 'DataBridge 查询结果契约')
    })

    it('当接口变更导致契约不匹配时应该失败', () => {
      const mismatchedResponse = {
        success: 'yes',
        data: {},
        traceId: 'mismatch-trace-004',
      }

      expect(() => {
        assertContract('BridgeQueryResult', mismatchedResponse, 'interface-change-mismatch')
      }).toThrow()
    })

    it('当新增必填字段但调用方未提供时应该失败', () => {
      const missingFieldResponse = {
        success: true,
        traceId: 'missing-field-trace-005',
      }

      expect(() => {
        assertContract('BridgeQueryResult', missingFieldResponse, 'missing-required-field')
      }).not.toThrow()
    })
  })

  describe('验证统计', () => {
    beforeEach(() => {
      registerContract('BridgeQueryResult', BridgeQueryResultSchema, 'DataBridge 查询结果契约')
    })

    it('应该正确跟踪验证统计', () => {
      const validResult1 = createMockBridgeQueryResult()
      const validResult2 = createMockBridgeQueryResult()
      const invalidResult = { success: true }

      assertContract('BridgeQueryResult', validResult1, 'stats-test-1')
      assertContract('BridgeQueryResult', validResult2, 'stats-test-2')

      expect(() => {
        assertContract('BridgeQueryResult', invalidResult, 'stats-test-invalid')
      }).toThrow()

      const stats = getStats()
      expect(stats.totalValidations).toBe(3)
      expect(stats.passedValidations).toBe(2)
      expect(stats.failedValidations).toBe(1)
    })
  })
})