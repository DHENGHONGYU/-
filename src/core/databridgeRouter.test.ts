import { describe, it, expect, vi, beforeEach } from 'vitest'
import { routeToQuery, routeToEvent, routeToManager } from './databridgeRouter'
import { EnvelopeFactory } from './envelope'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'

// Mock db
vi.mock('@/data/db', () => ({
  db: {
    reset: vi.fn(),
    import: vi.fn(),
    export: vi.fn().mockResolvedValue({ stocks: [] }),
  },
}))

import { db } from '@/data/db'

describe('databridgeRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('routeToQuery()', () => {
    it('执行查询并广播结果', async () => {
      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.queryGet,
          source: MODULE_ID.analyzer,
          target: 'db',
          traceId: 'test-001',
        },
        { key: '600519.SH' },
      )

      const mockResult = { success: true, data: { symbol: '600519.SH', name: '贵州茅台' } }
      const queryDelegate = {
        query: vi.fn().mockResolvedValue(mockResult),
      }
      const broadcast = vi.fn()

      await routeToQuery(envelope, STORE_NAME.stocks, queryDelegate, broadcast)

      expect(queryDelegate.query).toHaveBeenCalledTimes(1)
      expect(queryDelegate.query).toHaveBeenCalledWith(
        expect.objectContaining({
          store: STORE_NAME.stocks,
          key: '600519.SH',
          source: MODULE_ID.analyzer,
        })
      )
      expect(broadcast).toHaveBeenCalledTimes(1)
      expect(broadcast).toHaveBeenCalledWith(
        `query:${STORE_NAME.stocks}`,
        expect.objectContaining({
          meta: envelope.meta,
          payload: expect.objectContaining({
            key: '600519.SH',
            queryResult: mockResult,
          }),
        })
      )
    })

    it('payload 为非对象时，新 payload 只有 queryResult', async () => {
      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.queryList,
          source: MODULE_ID.analyzer,
          target: 'db',
          traceId: 'test-002',
        },
        null,
      )

      const mockResult = { success: true, data: [] }
      const queryDelegate = {
        query: vi.fn().mockResolvedValue(mockResult),
      }
      const broadcast = vi.fn()

      await routeToQuery(envelope, STORE_NAME.stocks, queryDelegate, broadcast)

      const broadcastedEnvelope = broadcast.mock.calls[0]![1]
      expect(broadcastedEnvelope.payload).toEqual({ queryResult: mockResult })
    })

    it('payload 有 indexName 和 indexValue 时传递给 query', async () => {
      const envelope = EnvelopeFactory.create(
        {
          action: 'QUERY_BY_INDEX',
          source: MODULE_ID.analyzer,
          target: 'db',
          traceId: 'test-003',
        },
        { indexName: 'byStatus', indexValue: 'active' },
      )

      const queryDelegate = {
        query: vi.fn().mockResolvedValue({ success: true, data: [] }),
      }
      const broadcast = vi.fn()

      await routeToQuery(envelope, STORE_NAME.stocks, queryDelegate, broadcast)

      expect(queryDelegate.query).toHaveBeenCalledWith(
        expect.objectContaining({
          indexName: 'byStatus',
          indexValue: 'active',
        })
      )
    })

    it('查询失败时也广播结果', async () => {
      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.queryGet,
          source: MODULE_ID.analyzer,
          target: 'db',
          traceId: 'test-004',
        },
        { key: 'notfound' },
      )

      const mockResult = { success: false, error: 'Not found' }
      const queryDelegate = {
        query: vi.fn().mockResolvedValue(mockResult),
      }
      const broadcast = vi.fn()

      await routeToQuery(envelope, STORE_NAME.stocks, queryDelegate, broadcast)

      expect(broadcast).toHaveBeenCalledTimes(1)
      const broadcastedEnvelope = broadcast.mock.calls[0]![1]
      expect(broadcastedEnvelope.payload.queryResult.success).toBe(false)
    })

    it('payload 为原始类型时正确处理', async () => {
      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.queryGet,
          source: MODULE_ID.analyzer,
          target: 'db',
          traceId: 'test-005',
        },
        'string-payload',
      )

      const queryDelegate = {
        query: vi.fn().mockResolvedValue({ success: true, data: null }),
      }
      const broadcast = vi.fn()

      await routeToQuery(envelope, STORE_NAME.stocks, queryDelegate, broadcast)

      const broadcastedEnvelope = broadcast.mock.calls[0]![1]
      expect(broadcastedEnvelope.payload).toEqual({
        queryResult: { success: true, data: null },
      })
    })
  })

  describe('routeToEvent()', () => {
    it('广播到 event:{action} 和 event:* 两个频道', () => {
      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.insertStock,
          source: MODULE_ID.fetcher,
          target: 'db',
          traceId: 'test-001',
        },
        { symbol: 'TEST' },
      )

      const broadcast = vi.fn()
      routeToEvent(envelope, broadcast)

      expect(broadcast).toHaveBeenCalledTimes(2)
      expect(broadcast).toHaveBeenNthCalledWith(
        1,
        `event:${ENVELOPE_ACTION.insertStock.toLowerCase()}`,
        envelope,
      )
      expect(broadcast).toHaveBeenNthCalledWith(2, 'event:*', envelope)
    })

    it('action 转为小写', () => {
      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.saveScores,
          source: MODULE_ID.analyzer,
          target: 'db',
          traceId: 'test-002',
        },
        null,
      )

      const broadcast = vi.fn()
      routeToEvent(envelope, broadcast)

      expect(broadcast.mock.calls[0]![0]).toBe('event:save_scores')
    })
  })

  describe('routeToManager()', () => {
    it('resetAll 调用 db.reset()', async () => {
      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.resetAll,
          source: MODULE_ID.system,
          target: 'db',
          traceId: 'test-001',
        },
        null,
      )

      vi.mocked(db.reset).mockResolvedValue()

      await routeToManager(envelope)

      expect(db.reset).toHaveBeenCalledTimes(1)
    })

    it('importAll 调用 db.import()', async () => {
      const mockData = { stocks: [{ symbol: 'TEST' }], orders: [] }
      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.importAll,
          source: MODULE_ID.system,
          target: 'db',
          traceId: 'test-002',
        },
        mockData,
      )

      vi.mocked(db.import).mockResolvedValue()

      await routeToManager(envelope)

      expect(db.import).toHaveBeenCalledTimes(1)
      expect(db.import).toHaveBeenCalledWith(mockData)
    })

    it('exportAll 调用 db.export()', async () => {
      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.exportAll,
          source: MODULE_ID.system,
          target: 'db',
          traceId: 'test-003',
        },
        null,
      )

      vi.mocked(db.export).mockResolvedValue({ stocks: [] })

      await routeToManager(envelope)

      expect(db.export).toHaveBeenCalledTimes(1)
    })

    it('未知 action 抛出错误', async () => {
      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.insertStock,
          source: MODULE_ID.system,
          target: 'db',
          traceId: 'test-004',
        },
        null,
      )

      await expect(routeToManager(envelope)).rejects.toThrow('Unknown manager action')
    })

    it('db.reset 失败时传播错误', async () => {
      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.resetAll,
          source: MODULE_ID.system,
          target: 'db',
          traceId: 'test-005',
        },
        null,
      )

      vi.mocked(db.reset).mockRejectedValue(new Error('DB error'))

      await expect(routeToManager(envelope)).rejects.toThrow('DB error')
    })
  })
})
