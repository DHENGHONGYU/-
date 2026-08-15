/**
 * @test_id V9-TEST-ST-020-EDGE
 * @covers_docs [V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-ARCH-008]
 *
 * Edge Case & Registry Handler 测试：删除、级联、异常、注册表行为
 * 涵盖 DeleteHandler、DeleteStockHandler、HandlerRegistry、createHandlerRegistry
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ENVELOPE_ACTION, STORE_NAME, type StoreName } from '@/config/dbConfig'
import { EnvelopeError } from './envelope'
import { CascadeError } from '@/types/modules/cascade.types'
import {
  HandlerRegistry,
  createHandlerRegistry,
  type EnvelopeHandler,
} from './databridgeHandlers'
import { mockLogger, dbModule, makeEnvelope } from './databridgeHandlers.test-utils'

// 将 handler 实际依赖的 @/data/db 重定向到 dbModule mock
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
// 将 @/core/cascadeExecutor 重定向到 mock。
// 注意 handler 导入的是具名导出 cascadeExecutor（含 execute 方法），故返回 { cascadeExecutor: {...} }
vi.mock('@/core/cascadeExecutor', () => ({
  cascadeExecutor: { execute: vi.fn() },
}))

const logger = mockLogger

function getHandlerFromRegistry(action: string): EnvelopeHandler | undefined {
  const registry = createHandlerRegistry()
  return registry.findHandler(action)
}

describe('databridgeHandlers (edge)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ──────────────────────────────────────────
  // DeleteHandler
  // ──────────────────────────────────────────
  describe('DeleteHandler', () => {
    it('正常删除（无级联目标）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteCustomAgent)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteCustomAgent, { id: 'agent-1' })
      vi.mocked(dbModule.db.delete).mockResolvedValue(undefined)
      const { cascadeExecutor } = await import('@/core/cascadeExecutor')
      vi.mocked(cascadeExecutor.execute).mockResolvedValueOnce({ targets: [] })

      await handler.handle(envelope, STORE_NAME.customAgents)

      expect(cascadeExecutor.execute).toHaveBeenCalledWith(STORE_NAME.customAgents, 'agent-1')
      expect(dbModule.db.delete).toHaveBeenCalledWith(STORE_NAME.customAgents, 'agent-1')
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('DB delete'),
      )
    })

    it('级联删除成功（有子记录被级联删除）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteCustomAgent)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteCustomAgent, { id: 'agent-1' })
      const { cascadeExecutor } = await import('@/core/cascadeExecutor')
      vi.mocked(cascadeExecutor.execute).mockResolvedValueOnce({
        targets: [
          { store: 'execution_logs', strategy: 'CASCADE', affectedCount: 5 },
          { store: 'score_evidence', strategy: 'CASCADE', affectedCount: 3 },
        ],
      })

      await handler.handle(envelope, STORE_NAME.customAgents)

      expect(dbModule.db.delete).toHaveBeenCalledWith(STORE_NAME.customAgents, 'agent-1')
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('级联策略执行完成'),
        expect.objectContaining({
          cascadeTargets: 2,
          affectedTotal: 8,
        }),
      )
    })

    it('RESTRICT 策略阻止删除时抛出 EnvelopeError', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteCustomAgent)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteCustomAgent, { id: 'agent-1' })
      const { cascadeExecutor } = await import('@/core/cascadeExecutor')
      vi.mocked(cascadeExecutor.execute).mockRejectedValueOnce(
        new CascadeError('存在 3 条关联记录'),
      )

      const promise = handler.handle(envelope, STORE_NAME.customAgents)
      await expect(promise).rejects.toThrow(EnvelopeError)
      await expect(promise).rejects.toThrow('删除被阻止')
      expect(dbModule.db.delete).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('删除被级联策略阻止'),
        expect.any(Object),
      )
    })

    it('级联执行非 CascadeError 异常时继续删除（容错策略）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteCustomAgent)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteCustomAgent, { id: 'agent-1' })
      const { cascadeExecutor } = await import('@/core/cascadeExecutor')
      vi.mocked(cascadeExecutor.execute).mockRejectedValueOnce(new Error('Unexpected error'))

      await handler.handle(envelope, STORE_NAME.customAgents)

      expect(dbModule.db.delete).toHaveBeenCalledWith(STORE_NAME.customAgents, 'agent-1')
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('级联执行异常'),
        expect.any(Object),
      )
    })

    it('cascadeExecutor 返回多个目标时正确统计', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteCustomAgent)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteCustomAgent, { id: 'agent-1' })
      const { cascadeExecutor } = await import('@/core/cascadeExecutor')
      vi.mocked(cascadeExecutor.execute).mockResolvedValueOnce({
        targets: [
          { store: 'a', strategy: 'CASCADE', affectedCount: 10 },
          { store: 'b', strategy: 'SET_NULL', affectedCount: 5 },
          { store: 'c', strategy: 'SOFT_DELETE', affectedCount: 3 },
        ],
      })

      await handler.handle(envelope, STORE_NAME.customAgents)

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
  // DeleteStockHandler
  // ──────────────────────────────────────────
  describe('DeleteStockHandler', () => {
    it('正常删除股票主记录', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteStock, { symbol: '600519' })

      vi.mocked(dbModule.db.delete).mockResolvedValue(undefined)
      vi.mocked(dbModule.db.getAllByIndex).mockResolvedValue([])
      vi.mocked(dbModule.db.getAll).mockResolvedValue([])

      await handler.handle(envelope, STORE_NAME.stocks)

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
      const deleteStores = deleteCalls.map((c: unknown[]) => c[0])
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

      const getAllByIndexCalls = vi.mocked(dbModule.db.getAllByIndex).mock.calls
      const indexStores = getAllByIndexCalls.map((c: unknown[]) => c[0])
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
      const scanStores = getAllCalls.map((c: unknown[]) => c[0])
      expect(scanStores).toContain(STORE_NAME.orders)
      expect(scanStores).toContain(STORE_NAME.signals)
      expect(scanStores).toContain(STORE_NAME.watchlists)
    })

    it('单个级联 store 失败不影响其他（容错）', async () => {
      const handler = getHandlerFromRegistry(ENVELOPE_ACTION.deleteStock)!
      const envelope = makeEnvelope(ENVELOPE_ACTION.deleteStock, { symbol: '600519' })

      const deleteMock = vi.mocked(dbModule.db.delete)
      deleteMock.mockImplementation((store: StoreName) => {
        if (store === STORE_NAME.v6Scores) {
          return Promise.reject(new Error('v6Scores delete failed'))
        }
        return Promise.resolve(undefined)
      })
      vi.mocked(dbModule.db.getAllByIndex).mockResolvedValue([])
      vi.mocked(dbModule.db.getAll).mockResolvedValue([])

      await handler.handle(envelope, STORE_NAME.stocks)

      expect(deleteMock).toHaveBeenCalledWith(STORE_NAME.stocks, '600519')
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
      const handler = registry.findHandler(ENVELOPE_ACTION.insertStock)
      expect(handler).toBeDefined()
      expect(handler!.canHandle(ENVELOPE_ACTION.saveScores)).toBe(false)
    })

    it('未知 action 找不到 handler', () => {
      const registry = createHandlerRegistry()
      expect(registry.findHandler('UNKNOWN_RANDOM_ACTION')).toBeUndefined()
    })
  })
})
