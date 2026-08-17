/**
 * @test_id V9-TEST-ST-020-MUTATION
 * @covers_docs [V9-DOC-BACK-010, V9-DOC-PROJ-003]
 *
 * Mutation Handler 测试：写入 / 更新 / 批量操作
 * 涵盖 PutHandler、InsertStockHandler、UpdateStockHandler、UpdateStockStatusHandler、
 * UpdateStockGroupHandler、CustomAgentSaveHandler、BulkHandler
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import { EnvelopeError } from './envelope'
import type { Stock, CustomAgent } from '@/data/types'
import {
  createHandlerRegistry,
  type EnvelopeHandler,
} from './databridgeHandlers'
import { mockLogger, dbModule, makeEnvelope } from './databridgeHandlers.test-utils'

// 将 handler 实际依赖的 @/data/db 重定向到 dbModule mock。
// 使用 async 工厂避免 vi.mock 提升期引用 import（否则 "Cannot access before initialization"）
vi.mock('@/data/db', async () => {
  const { dbModule } = await import('./databridgeHandlers.test-utils')
  return dbModule
})
// handler 通过 getLogger() 获取日志器；重定向到 mockLogger 使 logger.debug/info 可断言
vi.mock('@/lib/logger', async () => {
  const { mockLogger } = await import('./databridgeHandlers.test-utils')
  return { getLogger: () => mockLogger }
})

const logger = mockLogger! // vi.mock 工厂闭包引用同模块顶层 import，TS 判定可能 undefined（hoisting 陷阱），运行时必定义

function getHandlerFromRegistry(action: string): EnvelopeHandler | undefined {
  const registry = createHandlerRegistry()
  return registry.findHandler(action)
}

describe('databridgeHandlers (mutation)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ──────────────────────────────────────────
  // PutHandler
  // ──────────────────────────────────────────
  describe('PutHandler', () => {
    it('正常保存数据（普通操作使用 debug 级别日志）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.saveScores)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.saveScores, { symbol: '600519.SH', score: 85 })

      await handler.handle(envelope, STORE_NAME.v6Scores)

      expect(dbModule!.db.put).toHaveBeenCalledTimes(1)
      expect(dbModule!.db.put).toHaveBeenCalledWith(STORE_NAME.v6Scores, {
        symbol: '600519.SH',
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
        symbol: '600519.SH',
        reportDate: '2024-Q1',
        revenue: 1000000,
        netProfit: 500000,
      }
      const envelope = makeEnvelope(ENVELOPE_ACTION.saveFinancialReport, payload)

      await handler.handle(envelope, STORE_NAME.financialReports)

      expect(dbModule!.db.put).toHaveBeenCalledTimes(1)
      expect(dbModule!.db.put).toHaveBeenCalledWith(STORE_NAME.financialReports, payload)
      expect(logger.info).toHaveBeenCalled()
      expect(logger.info.mock.calls[0]![0]).toContain('开始保存财务数据')
      expect(logger.info.mock.calls[1]![0]).toContain('财务数据保存完成')
    })

    it('db.put 抛出异常时正确传播', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.saveScores)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.saveScores, { symbol: '600519.SH' })
      const putMock = vi.mocked(dbModule!.db.put)
      putMock.mockRejectedValueOnce(new Error('DB error'))

      await expect(handler.handle(envelope, STORE_NAME.v6Scores)).rejects.toThrow('DB error')
    })
  })

  // ──────────────────────────────────────────
  // InsertStockHandler
  // ──────────────────────────────────────────
  describe('InsertStockHandler', () => {
    it('正常插入股票', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.insertStock)!
      const stock: Partial<Stock> = {
        symbol: '600519.SH',
        name: '贵州茅台',
        researchStatus: 'screening',
        source: 'manual',
        dataVersion: 1,
      }
      const envelope = makeEnvelope(ENVELOPE_ACTION.insertStock, stock)

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(dbModule!.db.put).toHaveBeenCalledWith(STORE_NAME.stocks, stock)
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
      expect(dbModule!.db.put).not.toHaveBeenCalled()
    })

    it('symbol 为 undefined 时抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.insertStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.insertStock, { name: 'Test' })

      const promise2 = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promise2).rejects.toThrow(EnvelopeError)
      await expect(promise2).rejects.toThrow(
        'missing or empty "symbol"',
      )
      expect(dbModule!.db.put).not.toHaveBeenCalled()
    })

    it('symbol 格式非法时抛出 EnvelopeError（无交易所后缀）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.insertStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.insertStock, {
        symbol: '600519',
        name: 'Test',
      })

      const promise = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promise).rejects.toThrow(EnvelopeError)
      await expect(promise).rejects.toThrow('symbol 格式非法')
      expect(dbModule!.db.put).not.toHaveBeenCalled()
    })

    it('symbol 格式非法时抛出 EnvelopeError（完全非法字符串）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.insertStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.insertStock, {
        symbol: 'INVALID',
        name: 'Test',
      })

      const promise = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promise).rejects.toThrow(EnvelopeError)
      await expect(promise).rejects.toThrow('symbol 格式非法')
      expect(dbModule!.db.put).not.toHaveBeenCalled()
    })

    it('A股 symbol 格式正确通过校验', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.insertStock)!
      const stock: Partial<Stock> = {
        symbol: '600519.SH',
        name: '贵州茅台',
        researchStatus: 'screening',
        source: 'manual',
        dataVersion: 1,
      }
      const envelope = makeEnvelope(ENVELOPE_ACTION.insertStock, stock)

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(dbModule!.db.put).toHaveBeenCalledWith(STORE_NAME.stocks, stock)
    })

    it('港股 symbol 格式正确通过校验', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.insertStock)!
      const stock: Partial<Stock> = {
        symbol: '00700.HK',
        name: '腾讯控股',
        researchStatus: 'screening',
        source: 'manual',
        dataVersion: 1,
      }
      const envelope = makeEnvelope(ENVELOPE_ACTION.insertStock, stock)

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(dbModule!.db.put).toHaveBeenCalledWith(STORE_NAME.stocks, stock)
    })

    it('美股 symbol 格式正确通过校验', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.insertStock)!
      const stock: Partial<Stock> = {
        symbol: 'AAPL.US',
        name: 'Apple Inc.',
        researchStatus: 'screening',
        source: 'manual',
        dataVersion: 1,
      }
      const envelope = makeEnvelope(ENVELOPE_ACTION.insertStock, stock)

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(dbModule!.db.put).toHaveBeenCalledWith(STORE_NAME.stocks, stock)
    })

    it('日志记录正确', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.insertStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.insertStock, {
        symbol: '000001.SZ',
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
      symbol: '600519.SH',
      name: '贵州茅台',
      researchStatus: 'screening',
      source: 'manual',
      dataVersion: 3,
      updatedAt: 1600000000000,
    }

    it('正常更新股票（合并现有数据）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStock)!
      vi.mocked(dbModule!.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStock, {
        symbol: '600519.SH',
        price: 1800,
      })

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(dbModule!.db.get).toHaveBeenCalledWith(STORE_NAME.stocks, '600519.SH')
      expect(dbModule!.db.put).toHaveBeenCalledTimes(1)
      const putArg = vi.mocked(dbModule!.db.put).mock.calls[0]![1] as Stock
      expect(putArg.symbol).toBe('600519.SH')
      expect(putArg.name).toBe('贵州茅台')
      expect(putArg.price).toBe(1800)
    })

    it('dataVersion 递增', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStock)!
      vi.mocked(dbModule!.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStock, { symbol: '600519.SH' })

      await handler.handle(envelope, STORE_NAME.stocks)

      const putArg = vi.mocked(dbModule!.db.put).mock.calls[0]![1] as Stock
      expect(putArg.dataVersion).toBe(4)
    })

    it('updatedAt 更新', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStock)!
      vi.mocked(dbModule!.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStock, { symbol: '600519.SH' })

      await handler.handle(envelope, STORE_NAME.stocks)

      const putArg = vi.mocked(dbModule!.db.put).mock.calls[0]![1] as Stock
      expect(putArg.updatedAt).toBeGreaterThan(existingStock.updatedAt!)
    })

    it('股票不存在时抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStock)!
      vi.mocked(dbModule!.db.get).mockResolvedValueOnce(undefined)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStock, { symbol: '999999.SZ' })

      const promise = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promise).rejects.toThrow(EnvelopeError)
      await expect(promise).rejects.toThrow('Stock not found')
      expect(dbModule!.db.put).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('updateStock failed'),
      )
    })

    it('symbol 格式非法时抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStock, {
        symbol: '600519',
      })

      const promise = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promise).rejects.toThrow(EnvelopeError)
      await expect(promise).rejects.toThrow('symbol 格式非法')
      expect(dbModule!.db.get).not.toHaveBeenCalled()
      expect(dbModule!.db.put).not.toHaveBeenCalled()
    })

    it('日志记录正确', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStock)!
      vi.mocked(dbModule!.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStock, { symbol: '600519.SH' })

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
      symbol: '600519.SH',
      name: '贵州茅台',
      researchStatus: 'screening',
      source: 'manual',
      dataVersion: 3,
      updatedAt: 1600000000000,
    }

    it('正常更新 researchStatus', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStockStatus)!
      vi.mocked(dbModule!.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStockStatus, {
        symbol: '600519.SH',
        status: 'research',
      })

      await handler.handle(envelope, STORE_NAME.stocks)

      const putArg = vi.mocked(dbModule!.db.put).mock.calls[0]![1] as Stock
      expect(putArg.researchStatus).toBe('research')
      expect(putArg.name).toBe('贵州茅台')
    })

    it('dataVersion 递增', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStockStatus)!
      vi.mocked(dbModule!.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStockStatus, {
        symbol: '600519.SH',
        status: 'research',
      })

      await handler.handle(envelope, STORE_NAME.stocks)

      const putArg = vi.mocked(dbModule!.db.put).mock.calls[0]![1] as Stock
      expect(putArg.dataVersion).toBe(4)
    })

    it('股票不存在时抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStockStatus)!
      vi.mocked(dbModule!.db.get).mockResolvedValueOnce(undefined)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStockStatus, {
        symbol: '999999.SZ',
        status: 'research',
      })

      const promiseStatus = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promiseStatus).rejects.toThrow(EnvelopeError)
      await expect(promiseStatus).rejects.toThrow('Stock not found')
      expect(dbModule!.db.put).not.toHaveBeenCalled()
    })

    it('symbol 格式非法时抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStockStatus)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStockStatus, {
        symbol: 'INVALID',
        status: 'research',
      })

      const promise = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promise).rejects.toThrow(EnvelopeError)
      await expect(promise).rejects.toThrow('symbol 格式非法')
      expect(dbModule!.db.get).not.toHaveBeenCalled()
      expect(dbModule!.db.put).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────
  // UpdateStockGroupHandler
  // ──────────────────────────────────────────
  describe('UpdateStockGroupHandler', () => {
    const existingStock: Stock = {
      symbol: '600519.SH',
      name: '贵州茅台',
      researchStatus: 'screening',
      source: 'manual',
      dataVersion: 3,
      updatedAt: 1600000000000,
    }

    it('正常更新 group', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStockGroup)!
      vi.mocked(dbModule!.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStockGroup, {
        symbol: '600519.SH',
        group: '白酒板块',
      })

      await handler.handle(envelope, STORE_NAME.stocks)

      const putArg = vi.mocked(dbModule!.db.put).mock.calls[0]![1] as Stock
      expect(putArg.group).toBe('白酒板块')
      expect(putArg.name).toBe('贵州茅台')
    })

    it('dataVersion 递增', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStockGroup)!
      vi.mocked(dbModule!.db.get).mockResolvedValueOnce(existingStock)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStockGroup, {
        symbol: '600519.SH',
        group: '白酒板块',
      })

      await handler.handle(envelope, STORE_NAME.stocks)

      const putArg = vi.mocked(dbModule!.db.put).mock.calls[0]![1] as Stock
      expect(putArg.dataVersion).toBe(4)
    })

    it('股票不存在时抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStockGroup)!
      vi.mocked(dbModule!.db.get).mockResolvedValueOnce(undefined)
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStockGroup, {
        symbol: '999999.SZ',
        group: '测试组',
      })

      const promiseGroup = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promiseGroup).rejects.toThrow(EnvelopeError)
      await expect(promiseGroup).rejects.toThrow('Stock not found')
      expect(dbModule!.db.put).not.toHaveBeenCalled()
    })

    it('symbol 格式非法时抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.updateStockGroup)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.updateStockGroup, {
        symbol: '00700',
        group: '测试组',
      })

      const promise = handler.handle(envelope, STORE_NAME.stocks)
      await expect(promise).rejects.toThrow(EnvelopeError)
      await expect(promise).rejects.toThrow('symbol 格式非法')
      expect(dbModule!.db.get).not.toHaveBeenCalled()
      expect(dbModule!.db.put).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────
  // CustomAgentSaveHandler
  // ──────────────────────────────────────────
  describe('CustomAgentSaveHandler', () => {
    const mockNow = 1700000000000

    // handler 的 now() 来自 @/data/db 的 dbModule.now；固定其返回值以匹配断言
    beforeEach(() => {
      vi.mocked(dbModule.now).mockReturnValue(mockNow)
    })

    it('新增智能体（补齐 createdAt/updatedAt）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.saveCustomAgent)!
      vi.mocked(dbModule!.db.get).mockResolvedValueOnce(undefined)
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

      const putArg = vi.mocked(dbModule!.db.put).mock.calls[0]![1] as CustomAgent
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
      vi.mocked(dbModule!.db.get).mockResolvedValueOnce(existing)
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

      const putArg = vi.mocked(dbModule!.db.put).mock.calls[0]![1] as CustomAgent
      expect(putArg.name).toBe('新名称')
      expect(putArg.createdAt).toBe(1600000000000)
      expect(putArg.updatedAt).toBe(mockNow)
    })

    it('传入 createdAt 时保留原值（新增场景）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.saveCustomAgent)!
      vi.mocked(dbModule!.db.get).mockResolvedValueOnce(undefined)
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

      const putArg = vi.mocked(dbModule!.db.put).mock.calls[0]![1] as CustomAgent
      expect(putArg.createdAt).toBe(customCreatedAt)
      expect(putArg.updatedAt).toBe(mockNow)
    })
  })

  // ──────────────────────────────────────────
  // BulkHandler
  // ──────────────────────────────────────────
  describe('BulkHandler', () => {
    it('正常批量写入', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.bulkInsertStock)!
      const items = [
        { symbol: '600519.SH', name: '贵州茅台' },
        { symbol: '000001.SZ', name: '平安银行' },
        { symbol: '601318.SH', name: '中国平安' },
      ]
      const envelope = makeEnvelope(ENVELOPE_ACTION.bulkInsertStock, items)

      const putMock = vi.fn()
      const objectStoreMock = { put: putMock }
      const txMock = { objectStore: vi.fn(() => objectStoreMock) }
      vi.mocked(dbModule!.db.withTransaction).mockImplementation(
        (_stores: string[], _mode: IDBTransactionMode, callback: (tx: IDBTransaction) => Promise<unknown> | unknown) => {
          callback(txMock as unknown as IDBTransaction)
        },
      )

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(dbModule!.db.withTransaction).toHaveBeenCalledWith(
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

      expect(dbModule!.db.withTransaction).not.toHaveBeenCalled()
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
      const envelope = makeEnvelope(ENVELOPE_ACTION.bulkInsertStock, [{ symbol: '600519.SH' }])

      vi.mocked(dbModule!.db.withTransaction).mockRejectedValueOnce(
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
      const items = [{ symbol: '600519.SH' }, { symbol: '000001.SZ' }]
      const envelope = makeEnvelope(ENVELOPE_ACTION.bulkInsertStock, items)

      const objectStoreMock = { put: vi.fn() }
      const txMock = { objectStore: vi.fn(() => objectStoreMock) }
      vi.mocked(dbModule!.db.withTransaction).mockImplementation(
        (_stores: string[], _mode: IDBTransactionMode, callback: (tx: IDBTransaction) => Promise<unknown> | unknown) => {
          callback(txMock as unknown as IDBTransaction)
        },
      )

      await handler.handle(envelope, STORE_NAME.stocks)

      const infoCalls = logger.info.mock.calls
      const completeCall = infoCalls.find(
        (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('批量写入完成'),
      )
      expect(completeCall).toBeDefined()
      expect(completeCall![1]).toHaveProperty('duration')
      expect(completeCall![1]).toHaveProperty('avgPerItem')
      expect(completeCall![1].count).toBe(2)
    })
  })
})
