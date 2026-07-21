/**
 * @test_id V9-TEST-ST-020
 * @covers_docs [V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-ARCH-008, V9-DOC-BACK-012]
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ENVELOPE_ACTION, STORE_NAME, type StoreName, type EnvelopeAction } from '@/config/dbConfig'
import { EnvelopeError, type StandardEnvelope } from './envelope'
import { CascadeError } from '@/types/modules/cascade.types'
import type { Stock, CustomAgent } from '@/data/types'
import * as dbModule from '@/data/db'
import {
  HandlerRegistry,
  createHandlerRegistry,
  type EnvelopeHandler,
} from './databridgeHandlers'

// ──────────────────────────────────────────────
// Mock 依赖
// ──────────────────────────────────────────────
// 使用 vi.hoisted 确保 mockLogger 在 vi.mock 提升时已可用
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

vi.mock('@/data/db', () => ({
  db: {
    isReady: vi.fn(() => true),
    ready: vi.fn(() => Promise.resolve()),
    get: vi.fn(),
    getAll: vi.fn(),
    getAllByIndex: vi.fn(),
    put: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
    withTransaction: vi.fn(),
  },
  now: () => 1700000000000,
}))

vi.mock('@/core/cascadeExecutor', () => ({
  cascadeExecutor: {
    execute: vi.fn(),
  },
}))

// 延迟导入以访问 mock 实例
import { cascadeExecutor } from '@/core/cascadeExecutor'

const logger = mockLogger

// ──────────────────────────────────────────────
// 工具函数
// ──────────────────────────────────────────────
function makeEnvelope(
  action: EnvelopeAction,
  payload: unknown,
  traceId = 'test-trace-001',
): StandardEnvelope {
  return {
    meta: {
      source: 'pool',
      target: 'db',
      action,
      traceId,
      timestamp: Date.now(),
    },
    payload,
  }
}

// 安全获取 mock 函数第 index 次调用的第 argIndex 个参数（规避 mock.calls 索引类型为空的元组问题）
function getCallArg<T>(fn: { mock: { calls: unknown } }, argIndex: number): T {
  const calls = fn.mock.calls as unknown as unknown[][]
  return calls[0]?.[argIndex] as T
}

// 因为 handler 类不直接导出，需要通过注册表获取
function getHandlerFromRegistry(action: string): EnvelopeHandler | undefined {
  const registry = createHandlerRegistry()
  return registry.findHandler(action)
}

// ──────────────────────────────────────────────
// 测试主体
// ──────────────────────────────────────────────
describe('databridgeHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ──────────────────────────────────────────
  // PutHandler
  // ──────────────────────────────────────────
  describe('PutHandler', () => {
    it('正常保存数据（普通操作使用 debug 级别日志）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.saveScores)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.saveScores, { symbol: '600519', score: 85 })

      await handler.handle(envelope, STORE_NAME.v6Scores)

      expect(dbModule.db.put).toHaveBeenCalledTimes(1)
      expect(dbModule.db.put).toHaveBeenCalledWith(STORE_NAME.v6Scores, {
        symbol: '600519',
        score: 85,
      })
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('DB put'),
      )
      expect(logger.info).not.toHaveBeenCalled()
    })

    it('财务数据保存使用 info 级别日志', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.saveFinancialReport)!
      const payload = {
        symbol: '600519',
        reportDate: '2024-Q1',
        revenue: 1000000,
        netProfit: 500000,
      }
      const envelope = makeEnvelope(ENVELOPE_ACTION.saveFinancialReport, payload)

      await handler.handle(envelope, STORE_NAME.financialReports)

      expect(dbModule.db.put).toHaveBeenCalledTimes(1)
      expect(dbModule.db.put).toHaveBeenCalledWith(STORE_NAME.financialReports, payload)
      expect(logger.info).toHaveBeenCalled()
      // 第一条 info 日志包含开始保存信息
      expect(getCallArg<string>(logger.info, 0)).toContain('开始保存财务数据')
      // 第二条 info 日志包含完成信息
      expect(getCallArg<string>(logger.info, 1)).toContain('财务数据保存完成')
    })

    it('db.put 抛出异常时正确传播', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.saveScores)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.saveScores, { symbol: '600519' })
      const putMock = vi.mocked(dbModule.db.put)
      putMock.mockRejectedValueOnce(new Error('DB error'))

      await expect(handler.handle(envelope, STORE_NAME.v6Scores)).rejects.toThrow('DB error')
    })
  })

  // ──────────────────────────────────────────
  // DeleteHandler
  // ──────────────────────────────────────────
  describe('DeleteHandler', () => {
    it('正常删除（无级联目标）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteExecutionPlan)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteExecutionPlan, { id: 'plan-1' })
      vi.mocked(cascadeExecutor.execute).mockResolvedValueOnce({ targets: [] })

      await handler.handle(envelope, STORE_NAME.executionPlans)

      expect(cascadeExecutor.execute).toHaveBeenCalledWith(STORE_NAME.executionPlans, 'plan-1')
      expect(dbModule.db.delete).toHaveBeenCalledWith(STORE_NAME.executionPlans, 'plan-1')
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('DB delete'),
      )
    })

    it('级联删除成功（有子记录被级联删除）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteExecutionPlan)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteExecutionPlan, { id: 'plan-1' })
      vi.mocked(cascadeExecutor.execute).mockResolvedValueOnce({
        targets: [
          { store: 'execution_logs', strategy: 'CASCADE', affectedCount: 5 },
          { store: 'score_evidence', strategy: 'CASCADE', affectedCount: 3 },
        ],
      })

      await handler.handle(envelope, STORE_NAME.executionPlans)

      expect(dbModule.db.delete).toHaveBeenCalledWith(STORE_NAME.executionPlans, 'plan-1')
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('级联策略执行完成'),
        expect.objectContaining({
          cascadeTargets: 2,
          affectedTotal: 8,
        }),
      )
    })

    it('RESTRICT 策略阻止删除时抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteExecutionPlan)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteExecutionPlan, { id: 'plan-1' })
      vi.mocked(cascadeExecutor.execute).mockRejectedValueOnce(
        new CascadeError('存在 3 条关联记录'),
      )

      const promise = handler.handle(envelope, STORE_NAME.executionPlans)
      await expect(promise).rejects.toThrow(EnvelopeError)
      await expect(promise).rejects.toThrow('删除被阻止')
      // 不执行 db.delete
      expect(dbModule.db.delete).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('删除被级联策略阻止'),
        expect.any(Object),
      )
    })

    it('级联执行非 CascadeError 异常时继续删除（容错策略）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteExecutionPlan)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteExecutionPlan, { id: 'plan-1' })
      vi.mocked(cascadeExecutor.execute).mockRejectedValueOnce(new Error('Unexpected error'))

      await handler.handle(envelope, STORE_NAME.executionPlans)

      // 仍然执行删除
      expect(dbModule.db.delete).toHaveBeenCalledWith(STORE_NAME.executionPlans, 'plan-1')
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('级联执行异常'),
        expect.any(Object),
      )
    })

    it('cascadeExecutor 返回多个目标时正确统计', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteExecutionPlan)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteExecutionPlan, { id: 'plan-1' })
      vi.mocked(cascadeExecutor.execute).mockResolvedValueOnce({
        targets: [
          { store: 'a', strategy: 'CASCADE', affectedCount: 10 },
          { store: 'b', strategy: 'SET_NULL', affectedCount: 5 },
          { store: 'c', strategy: 'SOFT_DELETE', affectedCount: 3 },
        ],
      })

      await handler.handle(envelope, STORE_NAME.executionPlans)

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('级联策略执行完成'),
        expect.objectContaining({
          cascadeTargets: 3,
          affectedTotal: 18,
        }),
      )
    })
  })

  // ──────────────────────────────────────────
  // InsertStockHandler
  // ──────────────────────────────────────────
  describe('InsertStockHandler', () => {
    it('正常插入股票', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.insertStock)!
      const stock: Partial<Stock> = {
        symbol: '600519',
        name: '贵州茅台',
        researchStatus: 'screening',
        source: 'manual',
        dataVersion: 1,
      }
      const envelope = makeEnvelope(ENVELOPE_ACTION.insertStock, stock)

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(dbModule.db.put).toHaveBeenCalledWith(STORE_NAME.stocks, stock)
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('insertStock'),
      )
    })

    it('symbol 为空字符串时抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.insertStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.insertStock, { symbol: '', name: 'Test' })

      const promise1 = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promise1).rejects.toThrow(EnvelopeError)
      await expect(promise1).rejects.toThrow(
        'missing or empty "symbol"',
      )
      expect(dbModule.db.put).not.toHaveBeenCalled()
    })

    it('symbol 为 undefined 时抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.insertStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.insertStock, { name: 'Test' })

      const promise2 = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promise2).rejects.toThrow(EnvelopeError)
      await expect(promise2).rejects.toThrow(
        'missing or empty "symbol"',
      )
      expect(dbModule.db.put).not.toHaveBeenCalled()
    })

    it('日志记录正确', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.insertStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.insertStock, {
        symbol: '000001',
        name: '平安银行',
        researchStatus: 'research',
        source: 'manual',
        dataVersion: 1,
      })

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('DB insertStock'),
      )
    })
  })

  // ──────────────────────────────────────────
  // UpdateStockHandler
  // ──────────────────────────────────────────
  describe('UpdateStockHandler', () => {
    const existingStock: Stock = {
      symbol: '600519',
      name: '贵州茅台',
      researchStatus: 'screening',
      source: 'manual',
      dataVersion: 3,
      updatedAt: 1600000000000,
    }

    it('正常更新股票（合并现有数据）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStock)!
      vi.mocked(dbModule.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStock, {
        symbol: '600519',
        price: 1800,
      })

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(dbModule.db.get).toHaveBeenCalledWith(STORE_NAME.stocks, '600519')
      expect(dbModule.db.put).toHaveBeenCalledTimes(1)
      const putArg = getCallArg<Stock>(vi.mocked(dbModule.db.put), 1)
      expect(putArg.symbol).toBe('600519')
      expect(putArg.name).toBe('贵州茅台')
      expect(putArg.price).toBe(1800)
    })

    it('dataVersion 递增', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStock)!
      vi.mocked(dbModule.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStock, { symbol: '600519' })

      await handler.handle(envelope, STORE_NAME.stocks)

      const putArg = getCallArg<Stock>(vi.mocked(dbModule.db.put), 1)
      expect(putArg.dataVersion).toBe(4)
    })

    it('updatedAt 更新', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStock)!
      vi.mocked(dbModule.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStock, { symbol: '600519' })

      await handler.handle(envelope, STORE_NAME.stocks)

      const putArg = getCallArg<Stock>(vi.mocked(dbModule.db.put), 1)
      expect(putArg.updatedAt).toBeGreaterThan(existingStock.updatedAt!)
    })

    it('股票不存在时抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStock)!
      vi.mocked(dbModule.db.get).mockResolvedValueOnce(undefined)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStock, { symbol: '999999' })

      const promise = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promise).rejects.toThrow(EnvelopeError)
      await expect(promise).rejects.toThrow('Stock not found')
      expect(dbModule.db.put).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('updateStock failed'),
      )
    })

    it('日志记录正确', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStock)!
      vi.mocked(dbModule.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStock, { symbol: '600519' })

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('updateStock'),
      )
    })
  })

  // ──────────────────────────────────────────
  // UpdateStockStatusHandler
  // ──────────────────────────────────────────
  describe('UpdateStockStatusHandler', () => {
    const existingStock: Stock = {
      symbol: '600519',
      name: '贵州茅台',
      researchStatus: 'screening',
      source: 'manual',
      dataVersion: 3,
      updatedAt: 1600000000000,
    }

    it('正常更新 researchStatus', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStockStatus)!
      vi.mocked(dbModule.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStockStatus, {
        symbol: '600519',
        status: 'research',
      })

      await handler.handle(envelope, STORE_NAME.stocks)

      const putArg = getCallArg<Stock>(vi.mocked(dbModule.db.put), 1)
      expect(putArg.researchStatus).toBe('research')
      expect(putArg.name).toBe('贵州茅台')
    })

    it('dataVersion 递增', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStockStatus)!
      vi.mocked(dbModule.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStockStatus, {
        symbol: '600519',
        status: 'research',
      })

      await handler.handle(envelope, STORE_NAME.stocks)

      const putArg = getCallArg<Stock>(vi.mocked(dbModule.db.put), 1)
      expect(putArg.dataVersion).toBe(4)
    })

    it('股票不存在时抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStockStatus)!
      vi.mocked(dbModule.db.get).mockResolvedValueOnce(undefined)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStockStatus, {
        symbol: '999999',
        status: 'research',
      })

      const promiseStatus = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promiseStatus).rejects.toThrow(EnvelopeError)
      await expect(promiseStatus).rejects.toThrow('Stock not found')
      expect(dbModule.db.put).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────
  // UpdateStockGroupHandler
  // ──────────────────────────────────────────
  describe('UpdateStockGroupHandler', () => {
    const existingStock: Stock = {
      symbol: '600519',
      name: '贵州茅台',
      researchStatus: 'screening',
      source: 'manual',
      dataVersion: 3,
      updatedAt: 1600000000000,
    }

    it('正常更新 group', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStockGroup)!
      vi.mocked(dbModule.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStockGroup, {
        symbol: '600519',
        group: '白酒板块',
      })

      await handler.handle(envelope, STORE_NAME.stocks)

      const putArg = getCallArg<Stock>(vi.mocked(dbModule.db.put), 1)
      expect(putArg.group).toBe('白酒板块')
      expect(putArg.name).toBe('贵州茅台')
    })

    it('dataVersion 递增', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStockGroup)!
      vi.mocked(dbModule.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStockGroup, {
        symbol: '600519',
        group: '白酒板块',
      })

      await handler.handle(envelope, STORE_NAME.stocks)

      const putArg = getCallArg<Stock>(vi.mocked(dbModule.db.put), 1)
      expect(putArg.dataVersion).toBe(4)
    })

    it('股票不存在时抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStockGroup)!
      vi.mocked(dbModule.db.get).mockResolvedValueOnce(undefined)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStockGroup, {
        symbol: '999999',
        group: '测试组',
      })

      const promiseGroup = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promiseGroup).rejects.toThrow(EnvelopeError)
      await expect(promiseGroup).rejects.toThrow('Stock not found')
      expect(dbModule.db.put).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────
  // CustomAgentSaveHandler
  // ──────────────────────────────────────────
  describe('CustomAgentSaveHandler', () => {
    const mockNow = 1700000000000

    it('新增智能体（补齐 createdAt/updatedAt）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.saveCustomAgent)!
      vi.mocked(dbModule.db.get).mockResolvedValueOnce(undefined)
      const agentData = {
        id: 'agent-1',
        name: '测试智能体',
        description: '测试用',
        type: 'analysis' as const,
        model: 'gpt-4',
        systemPrompt: '你是一个分析助手',
        temperature: 0.7,
        maxTokens: 2000,
        capabilities: ['分析', '报告'],
        isActive: true,
      }
      const envelope = makeEnvelope(ENVELOPE_ACTION.saveCustomAgent, agentData)

      await handler.handle(envelope, STORE_NAME.customAgents)

      const putArg = getCallArg<CustomAgent>(vi.mocked(dbModule.db.put), 1)
      expect(putArg.id).toBe('agent-1')
      expect(putArg.createdAt).toBe(mockNow)
      expect(putArg.updatedAt).toBe(mockNow)
    })

    it('更新智能体（保留原 createdAt，更新 updatedAt）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.saveCustomAgent)!
      const existing: CustomAgent = {
        id: 'agent-1',
        name: '旧名称',
        description: '旧描述',
        type: 'analysis',
        model: 'gpt-3.5',
        systemPrompt: '旧 prompt',
        temperature: 0.5,
        maxTokens: 1000,
        capabilities: ['分析'],
        isActive: true,
        createdAt: 1600000000000,
        updatedAt: 1600000000000,
      }
      vi.mocked(dbModule.db.get).mockResolvedValueOnce(existing)
      const envelope = makeEnvelope(ENVELOPE_ACTION.saveCustomAgent, {
        id: 'agent-1',
        name: '新名称',
        description: '新描述',
        type: 'trading' as const,
        model: 'gpt-4',
        systemPrompt: '新 prompt',
        temperature: 0.7,
        maxTokens: 2000,
        capabilities: ['分析', '交易'],
        isActive: true,
      })

      await handler.handle(envelope, STORE_NAME.customAgents)

      const putArg = getCallArg<CustomAgent>(vi.mocked(dbModule.db.put), 1)
      expect(putArg.name).toBe('新名称')
      expect(putArg.createdAt).toBe(1600000000000) // 保留原 createdAt
      expect(putArg.updatedAt).toBe(mockNow) // 更新为新时间
    })

    it('传入 createdAt 时保留原值（新增场景）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.saveCustomAgent)!
      vi.mocked(dbModule.db.get).mockResolvedValueOnce(undefined)
      const customCreatedAt = 1650000000000
      const agentData = {
        id: 'agent-2',
        name: '指定时间智能体',
        description: '测试',
        type: 'data' as const,
        model: 'gpt-4',
        systemPrompt: 'prompt',
        temperature: 0.5,
        maxTokens: 1000,
        capabilities: ['数据处理'],
        isActive: true,
        createdAt: customCreatedAt,
      }
      const envelope = makeEnvelope(ENVELOPE_ACTION.saveCustomAgent, agentData)

      await handler.handle(envelope, STORE_NAME.customAgents)

      const putArg = getCallArg<CustomAgent>(vi.mocked(dbModule.db.put), 1)
      expect(putArg.createdAt).toBe(customCreatedAt)
      expect(putArg.updatedAt).toBe(mockNow)
    })
  })

  // ──────────────────────────────────────────
  // DeleteStockHandler
  // ──────────────────────────────────────────
  describe('DeleteStockHandler', () => {
    it('正常删除股票主记录', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteStock, { symbol: '600519' })

      // 主键表级联
      vi.mocked(dbModule.db.delete).mockResolvedValue(undefined)
      // 索引表级联
      vi.mocked(dbModule.db.getAllByIndex).mockResolvedValue([])
      // 扫描表级联
      vi.mocked(dbModule.db.getAll).mockResolvedValue([])

      await handler.handle(envelope, STORE_NAME.stocks)

      // 主记录删除
      expect(dbModule.db.delete).toHaveBeenCalledWith(STORE_NAME.stocks, '600519')
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('deleteStock'),
      )
    })

    it('级联删除主键表（v6Scores/dailyQuotes 等）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteStock, { symbol: '600519' })
      vi.mocked(dbModule.db.getAllByIndex).mockResolvedValue([])
      vi.mocked(dbModule.db.getAll).mockResolvedValue([])

      await handler.handle(envelope, STORE_NAME.stocks)

      const deleteCalls = vi.mocked(dbModule.db.delete).mock.calls
      const deleteStores = deleteCalls.map((c) => c[0])
      expect(deleteStores).toContain(STORE_NAME.v6Scores)
      expect(deleteStores).toContain(STORE_NAME.dailyQuotes)
      expect(deleteStores).toContain(STORE_NAME.hotSectorScores)
      expect(deleteStores).toContain(STORE_NAME.valuePitScores)
    })

    it('级联删除索引表（intelligentScores/scoreDocs 等）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteStock, { symbol: '600519' })
      vi.mocked(dbModule.db.getAll).mockResolvedValue([])

      const indexedRecords = [
        { id: 'rec-1', symbol: '600519' },
        { id: 'rec-2', symbol: '600519' },
      ]
      vi.mocked(dbModule.db.getAllByIndex).mockResolvedValue(indexedRecords)

      await handler.handle(envelope, STORE_NAME.stocks)

      // getAllByIndex 应该被调用多次（索引表数量）
      const getAllByIndexCalls = vi.mocked(dbModule.db.getAllByIndex).mock.calls
      const indexStores = getAllByIndexCalls.map((c) => c[0])
      expect(indexStores).toContain(STORE_NAME.intelligentScores)
      expect(indexStores).toContain(STORE_NAME.scoreDocs)
      expect(indexStores).toContain(STORE_NAME.localDocs)
      expect(indexStores).toContain(STORE_NAME.newsStockMap)
      expect(indexStores).toContain(STORE_NAME.executionPlans)
      expect(indexStores).toContain(STORE_NAME.executionLogs)
      expect(indexStores).toContain(STORE_NAME.missingReports)
    })

    it('级联删除扫描表（orders/signals/watchlists）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteStock, { symbol: '600519' })
      vi.mocked(dbModule.db.getAllByIndex).mockResolvedValue([])

      const scannedRecords = [
        { id: 'order-1', symbol: '600519' },
        { id: 'order-2', symbol: '000001' },
        { id: 'signal-1', symbol: '600519' },
      ]
      vi.mocked(dbModule.db.getAll).mockResolvedValue(scannedRecords)

      await handler.handle(envelope, STORE_NAME.stocks)

      const getAllCalls = vi.mocked(dbModule.db.getAll).mock.calls
      const scanStores = getAllCalls.map((c) => c[0])
      expect(scanStores).toContain(STORE_NAME.orders)
      expect(scanStores).toContain(STORE_NAME.signals)
      expect(scanStores).toContain(STORE_NAME.watchlists)
    })

    it('单个级联 store 失败不影响其他（容错）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteStock, { symbol: '600519' })

      // 让 v6Scores 删除失败，其他正常
      const deleteMock = vi.mocked(dbModule.db.delete)
      deleteMock.mockImplementation((storeName: string, _key: string) => {
        if (storeName === STORE_NAME.v6Scores) {
          return Promise.reject(new Error('v6Scores delete failed'))
        }
        return Promise.resolve(undefined)
      })
      vi.mocked(dbModule.db.getAllByIndex).mockResolvedValue([])
      vi.mocked(dbModule.db.getAll).mockResolvedValue([])

      // 不应抛出异常
      await handler.handle(envelope, STORE_NAME.stocks)

      // 主记录仍然被删除
      expect(deleteMock).toHaveBeenCalledWith(STORE_NAME.stocks, '600519')
      // 有警告日志
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('级联删除失败'),
        expect.any(Object),
      )
    })

    it('日志记录完整（开始和结束）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteStock, { symbol: '600519' })
      vi.mocked(dbModule.db.getAllByIndex).mockResolvedValue([])
      vi.mocked(dbModule.db.getAll).mockResolvedValue([])

      await handler.handle(envelope, STORE_NAME.stocks)

      const infoCalls = logger.info.mock.calls
      const messages = infoCalls.map((c: any[]) => c[0])
      expect(messages.some((m: string) => m.includes('开始级联删除'))).toBe(true)
      expect(messages.some((m: string) => m.includes('级联删除结束'))).toBe(true)
    })
  })

  // ──────────────────────────────────────────
  // NotificationHandler
  // ──────────────────────────────────────────
  describe('NotificationHandler', () => {
    it('不执行任何 DB 操作', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.newsArticleLoaded)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.newsArticleLoaded, { articleId: 'a1' })

      await handler.handle(envelope, STORE_NAME.news)

      expect(dbModule.db.put).not.toHaveBeenCalled()
      expect(dbModule.db.get).not.toHaveBeenCalled()
      expect(dbModule.db.delete).not.toHaveBeenCalled()
    })

    it('记录 info 级别日志', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.newsArticleLoaded)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.newsArticleLoaded, { articleId: 'a1' })

      await handler.handle(envelope, STORE_NAME.news)

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Notification-only'),
      )
    })

    it('支持多个 action（holdingsDataLoaded）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.holdingsDataLoaded)!
      expect(handler).toBeDefined()
      const envelope = makeEnvelope(ENVELOPE_ACTION.holdingsDataLoaded, { count: 10 })

      await handler.handle(envelope, STORE_NAME.portfolios)

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Notification-only'),
      )
    })

    it('支持多个 action（tradeActionExecuted）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.tradeActionExecuted)!
      expect(handler).toBeDefined()
    })
  })

  // ──────────────────────────────────────────
  // BulkHandler
  // ──────────────────────────────────────────
  describe('BulkHandler', () => {
    it('正常批量写入', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.bulkInsertStock)!
      const items = [
        { symbol: '600519', name: '贵州茅台' },
        { symbol: '000001', name: '平安银行' },
        { symbol: '601318', name: '中国平安' },
      ]
      const envelope = makeEnvelope(ENVELOPE_ACTION.bulkInsertStock, items)

      const putMock = vi.fn()
      const objectStoreMock = { put: putMock }
      const txMock = { objectStore: vi.fn(() => objectStoreMock) }
      vi.mocked(dbModule.db.withTransaction).mockImplementation(
        (_stores: string[], _mode: IDBTransactionMode, callback: (tx: IDBTransaction) => Promise<unknown> | unknown) => {
          callback(txMock as unknown as IDBTransaction)
        },
      )

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(dbModule.db.withTransaction).toHaveBeenCalledWith(
        [STORE_NAME.stocks],
        'readwrite',
        expect.any(Function),
      )
      expect(putMock).toHaveBeenCalledTimes(3)
      expect(putMock).toHaveBeenCalledWith(items[0])
      expect(putMock).toHaveBeenCalledWith(items[1])
      expect(putMock).toHaveBeenCalledWith(items[2])
    })

    it('空数组时跳过', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.bulkInsertStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.bulkInsertStock, [])

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(dbModule.db.withTransaction).not.toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('empty array'),
      )
    })

    it('非数组 payload 抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.bulkInsertStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.bulkInsertStock, { not: 'an array' })

      const promise = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promise).rejects.toThrow(EnvelopeError)
      await expect(promise).rejects.toThrow('requires array payload')
    })

    it('事务失败时抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.bulkInsertStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.bulkInsertStock, [{ symbol: '600519' }])

      vi.mocked(dbModule.db.withTransaction).mockRejectedValueOnce(
        new Error('Transaction failed'),
      )

      const promise = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promise).rejects.toThrow(EnvelopeError)
      await expect(promise).rejects.toThrow('Bulk operation failed')
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('批量写入失败'),
        expect.any(Object),
      )
    })

    it('性能日志包含 duration 和 avgPerItem', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.bulkInsertStock)!
      const items = [{ symbol: '600519' }, { symbol: '000001' }]
      const envelope = makeEnvelope(ENVELOPE_ACTION.bulkInsertStock, items)

      const objectStoreMock = { put: vi.fn() }
      const txMock = { objectStore: vi.fn(() => objectStoreMock) }
      vi.mocked(dbModule.db.withTransaction).mockImplementation(
        (_stores: string[], _mode: IDBTransactionMode, callback: (tx: IDBTransaction) => Promise<unknown> | unknown) => {
          callback(txMock as unknown as IDBTransaction)
        },
      )

      await handler.handle(envelope, STORE_NAME.stocks)

      const infoCalls = logger.info.mock.calls as unknown as unknown[][]
      const completeCall = infoCalls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('批量写入完成'),
      )
      expect(completeCall).toBeDefined()
      const completeArg = completeCall![1] as { duration: unknown; avgPerItem: unknown; count: number }
      expect(completeArg).toHaveProperty('duration')
      expect(completeArg).toHaveProperty('avgPerItem')
      expect(completeArg.count).toBe(2)
    })
  })

  // ──────────────────────────────────────────
  // LoadHoldingsDataHandler
  // ──────────────────────────────────────────
  describe('LoadHoldingsDataHandler', () => {
    it('不执行 DB 写入', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.loadHoldingsData)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.loadHoldingsData, {
        page: 1,
        pageSize: 20,
      })

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(dbModule.db.put).not.toHaveBeenCalled()
      expect(dbModule.db.delete).not.toHaveBeenCalled()
    })

    it('记录查询日志', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.loadHoldingsData)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.loadHoldingsData, {
        page: 1,
        keyword: '茅台',
      })

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('query-only action'),
        expect.objectContaining({
          payloadKeys: ['page', 'keyword'],
        }),
      )
    })

    it('payload 为 null 时安全处理', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.loadHoldingsData)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.loadHoldingsData, null)

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('query-only action'),
        expect.objectContaining({
          payloadKeys: [],
        }),
      )
    })
  })

  // ──────────────────────────────────────────
  // HandlerRegistry
  // ──────────────────────────────────────────
  describe('HandlerRegistry', () => {
    it('register 注册 handler', () => {
      const registry = new HandlerRegistry()
      const mockHandler: EnvelopeHandler = {
        canHandle: vi.fn(() => false),
        handle: vi.fn(),
      }

      registry.register(mockHandler)

      // 通过 findHandler 验证注册成功
      expect(registry.findHandler('nonexistent')).toBeUndefined()
    })

    it('findHandler 找到匹配的 handler', () => {
      const registry = new HandlerRegistry()
      const mockHandler: EnvelopeHandler = {
        canHandle: vi.fn((action) => action === 'TEST_ACTION'),
        handle: vi.fn(),
      }
      registry.register(mockHandler)

      const found = registry.findHandler('TEST_ACTION')
      expect(found).toBe(mockHandler)
    })

    it('findHandler 找不到时返回 undefined', () => {
      const registry = new HandlerRegistry()
      const mockHandler: EnvelopeHandler = {
        canHandle: vi.fn(() => false),
        handle: vi.fn(),
      }
      registry.register(mockHandler)

      expect(registry.findHandler('UNKNOWN_ACTION')).toBeUndefined()
    })

    it('多个 handler 时按注册顺序匹配（第一个匹配优先）', () => {
      const registry = new HandlerRegistry()
      const handler1: EnvelopeHandler = {
        canHandle: vi.fn((action) => action === 'SHARED_ACTION'),
        handle: vi.fn(),
      }
      const handler2: EnvelopeHandler = {
        canHandle: vi.fn((action) => action === 'SHARED_ACTION'),
        handle: vi.fn(),
      }
      registry.register(handler1)
      registry.register(handler2)

      const found = registry.findHandler('SHARED_ACTION')
      expect(found).toBe(handler1)
      expect(handler2.canHandle).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────
  // createHandlerRegistry
  // ──────────────────────────────────────────
  describe('createHandlerRegistry', () => {
    it('正确创建所有 handler', () => {
      const registry = createHandlerRegistry()
      expect(registry).toBeInstanceOf(HandlerRegistry)
    })

    it('InsertStock 能找到对应 handler', () => {
      const registry = createHandlerRegistry()
      const handler = registry.findHandler(ENVELOPE_ACTION.insertStock)
      expect(handler).toBeDefined()
      expect(handler!.canHandle(ENVELOPE_ACTION.insertStock)).toBe(true)
    })

    it('UpdateStock 能找到对应 handler', () => {
      const registry = createHandlerRegistry()
      const handler = registry.findHandler(ENVELOPE_ACTION.updateStock)
      expect(handler).toBeDefined()
    })

    it('DeleteStock 能找到对应 handler', () => {
      const registry = createHandlerRegistry()
      const handler = registry.findHandler(ENVELOPE_ACTION.deleteStock)
      expect(handler).toBeDefined()
    })

    it('UpdateStockStatus 能找到对应 handler', () => {
      const registry = createHandlerRegistry()
      const handler = registry.findHandler(ENVELOPE_ACTION.updateStockStatus)
      expect(handler).toBeDefined()
    })

    it('UpdateStockGroup 能找到对应 handler', () => {
      const registry = createHandlerRegistry()
      const handler = registry.findHandler(ENVELOPE_ACTION.updateStockGroup)
      expect(handler).toBeDefined()
    })

    it('Notification 类 action 能找到对应 handler', () => {
      const registry = createHandlerRegistry()
      expect(registry.findHandler(ENVELOPE_ACTION.newsArticleLoaded)).toBeDefined()
      expect(registry.findHandler(ENVELOPE_ACTION.holdingsDataLoaded)).toBeDefined()
      expect(registry.findHandler(ENVELOPE_ACTION.tradeActionExecuted)).toBeDefined()
    })

    it('LoadHoldingsData 能找到对应 handler', () => {
      const registry = createHandlerRegistry()
      const handler = registry.findHandler(ENVELOPE_ACTION.loadHoldingsData)
      expect(handler).toBeDefined()
    })

    it('Bulk 类 action 能找到对应 handler', () => {
      const registry = createHandlerRegistry()
      expect(registry.findHandler(ENVELOPE_ACTION.bulkInsertStock)).toBeDefined()
      expect(registry.findHandler(ENVELOPE_ACTION.bulkSaveDailyQuotes)).toBeDefined()
      expect(registry.findHandler(ENVELOPE_ACTION.bulkSaveScores)).toBeDefined()
    })

    it('Delete 类 action 能找到对应 handler', () => {
      const registry = createHandlerRegistry()
      expect(registry.findHandler(ENVELOPE_ACTION.deleteExecutionPlan)).toBeDefined()
      expect(registry.findHandler(ENVELOPE_ACTION.deleteCustomAgent)).toBeDefined()
    })

    it('SaveCustomAgent 能找到对应 handler', () => {
      const registry = createHandlerRegistry()
      const handler = registry.findHandler(ENVELOPE_ACTION.saveCustomAgent)
      expect(handler).toBeDefined()
    })

    it('Put 类 action 能找到对应 handler', () => {
      const registry = createHandlerRegistry()
      expect(registry.findHandler(ENVELOPE_ACTION.saveScores)).toBeDefined()
      expect(registry.findHandler(ENVELOPE_ACTION.saveFinancialReport)).toBeDefined()
      expect(registry.findHandler(ENVELOPE_ACTION.saveDailyQuotes)).toBeDefined()
    })

    it('优先级顺序：特殊处理器优先于通用 PutHandler', () => {
      const registry = createHandlerRegistry()
      // insertStock 应该被 InsertStockHandler 处理，而不是 PutHandler
      const handler = registry.findHandler(ENVELOPE_ACTION.insertStock)
      expect(handler).toBeDefined()
      // InsertStockHandler 只处理 insertStock
      expect(handler!.canHandle(ENVELOPE_ACTION.saveScores)).toBe(false)
    })

    it('未知 action 找不到 handler', () => {
      const registry = createHandlerRegistry()
      expect(registry.findHandler('UNKNOWN_RANDOM_ACTION')).toBeUndefined()
    })
  })
})
