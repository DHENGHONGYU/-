/**
 * @test_id V9-TEST-ST-020-QUERY
 * @covers_docs [V9-DOC-BACK-010, V9-DOC-PROJ-003]
 *
 * Query / Read-only Handler 测试：仅查询、不修改数据
 * 涵盖 NotificationHandler、LoadHoldingsDataHandler
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import {
  createHandlerRegistry,
  type EnvelopeHandler,
} from './databridgeHandlers'
import { mockLogger, dbModule, makeEnvelope } from './databridgeHandlers.test-utils'

const logger = mockLogger

function getHandlerFromRegistry(action: string): EnvelopeHandler | undefined {
  const registry = createHandlerRegistry()
  return registry.findHandler(action)
}

describe('databridgeHandlers (query)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
