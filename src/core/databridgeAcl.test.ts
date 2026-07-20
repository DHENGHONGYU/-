import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  assertQueryAcl,
  assertQueryGetKey,
  assertQueryByIndexKey,
  isMarketEnvelope,
  assertAclWithFallback,
} from './databridgeAcl'
import { MODULE_ID, ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import { EnvelopeFactory } from './envelope'
import { fallbackQueue } from './fallbackQueue'
import { aclEngine } from './acl'

// Mock aclEngine
vi.mock('./acl', () => ({
  aclEngine: {
    assert: vi.fn(),
  },
}))

// Mock fallbackQueue
vi.mock('./fallbackQueue', () => ({
  fallbackQueue: {
    push: vi.fn(),
  },
}))

describe('databridgeAcl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('assertQueryAcl()', () => {
    it('ACL 通过时不抛出', () => {
      vi.mocked(aclEngine.assert).mockImplementation(() => {})
      expect(() => assertQueryAcl(MODULE_ID.analyzer, STORE_NAME.stocks)).not.toThrow()
    })

    it('ACL 拒绝时抛出错误', () => {
      vi.mocked(aclEngine.assert).mockImplementation(() => {
        throw new Error('ACL denied')
      })
      expect(() => assertQueryAcl(MODULE_ID.analyzer, STORE_NAME.stocks)).toThrow('ACL denied')
    })

    it('调用 aclEngine.assert 时 operation 为 SELECT', () => {
      vi.mocked(aclEngine.assert).mockImplementation(() => {})
      assertQueryAcl(MODULE_ID.analyzer, STORE_NAME.stocks)
      expect(aclEngine.assert).toHaveBeenCalledWith(
        expect.objectContaining({
          module: MODULE_ID.analyzer,
          store: STORE_NAME.stocks,
          operation: 'SELECT',
        })
      )
    })
  })

  describe('assertQueryGetKey()', () => {
    it('有 key 时通过', () => {
      expect(() => assertQueryGetKey({ key: 'abc123' })).not.toThrow()
    })

    it('key 为 0 时通过（falsy但非null/undefined）', () => {
      expect(() => assertQueryGetKey({ key: 0 })).not.toThrow()
    })

    it('key 为空字符串时通过', () => {
      expect(() => assertQueryGetKey({ key: '' })).not.toThrow()
    })

    it('无 key 时抛出 EnvelopeError', () => {
      expect(() => assertQueryGetKey({})).toThrow('queryGet requires key parameter')
    })

    it('key 为 undefined 时抛出', () => {
      expect(() => assertQueryGetKey({ key: undefined })).toThrow()
    })

    it('key 为 null 时抛出', () => {
      expect(() => assertQueryGetKey({ key: null })).toThrow()
    })
  })

  describe('assertQueryByIndexKey()', () => {
    it('同时有 indexName 和 indexValue 时通过', () => {
      expect(() => assertQueryByIndexKey({
        indexName: 'bySymbol',
        indexValue: '600519.SH',
      })).not.toThrow()
    })

    it('indexValue 为 0 时通过', () => {
      expect(() => assertQueryByIndexKey({
        indexName: 'byRank',
        indexValue: 0,
      })).not.toThrow()
    })

    it('indexValue 为空字符串时通过', () => {
      expect(() => assertQueryByIndexKey({
        indexName: 'byStatus',
        indexValue: '',
      })).not.toThrow()
    })

    it('无 indexName 时抛出', () => {
      expect(() => assertQueryByIndexKey({ indexValue: 'test' })).toThrow(
        'queryByIndex requires indexName and indexValue'
      )
    })

    it('无 indexValue 时抛出', () => {
      expect(() => assertQueryByIndexKey({ indexName: 'bySymbol' })).toThrow()
    })

    it('两者都没有时抛出', () => {
      expect(() => assertQueryByIndexKey({})).toThrow()
    })
  })

  describe('isMarketEnvelope()', () => {
    it('insertStock 不是市场类', () => {
      expect(isMarketEnvelope(ENVELOPE_ACTION.insertStock)).toBe(false)
    })

    it('saveDailyQuotes 是市场类', () => {
      expect(isMarketEnvelope(ENVELOPE_ACTION.saveDailyQuotes)).toBe(true)
    })

    it('saveScores 不是市场类', () => {
      expect(isMarketEnvelope(ENVELOPE_ACTION.saveScores)).toBe(false)
    })

    it('saveIndustryScores 不是市场类', () => {
      expect(isMarketEnvelope(ENVELOPE_ACTION.saveIndustryScores)).toBe(false)
    })

    it('saveNews 不是市场类', () => {
      expect(isMarketEnvelope(ENVELOPE_ACTION.saveNews)).toBe(false)
    })

    it('saveNewsStockMap 不是市场类', () => {
      expect(isMarketEnvelope(ENVELOPE_ACTION.saveNewsStockMap)).toBe(false)
    })

    it('非市场类 action 返回 false', () => {
      expect(isMarketEnvelope('UNKNOWN_ACTION')).toBe(false)
      expect(isMarketEnvelope('SAVE_ORDER')).toBe(false)
    })

    it('空字符串返回 false', () => {
      expect(isMarketEnvelope('')).toBe(false)
    })
  })

  describe('assertAclWithFallback()', () => {
    it('ACL 通过时返回 true', async () => {
      vi.mocked(aclEngine.assert).mockImplementation(() => {})
      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.insertStock,
          source: MODULE_ID.fetcher,
          target: 'db',
          traceId: 'test-001',
        },
        { symbol: 'TEST' },
      )
      const result = await assertAclWithFallback(envelope, STORE_NAME.stocks, 'INSERT')
      expect(result).toBe(true)
    })

    it('市场类 action 被拒时入队并返回 false', async () => {
      vi.mocked(aclEngine.assert).mockImplementation(() => {
        throw new Error('ACL denied')
      })
      vi.mocked(fallbackQueue.push).mockImplementation(() => 0)

      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.saveDailyQuotes,
          source: MODULE_ID.fetcher,
          target: 'db',
          traceId: 'test-002',
        },
        { symbol: 'TEST' },
      )
      const result = await assertAclWithFallback(envelope, STORE_NAME.stocks, 'INSERT')
      expect(result).toBe(false)
      expect(fallbackQueue.push).toHaveBeenCalledWith(envelope)
    })

    it('非市场类 action 被拒时直接抛出', async () => {
      vi.mocked(aclEngine.assert).mockImplementation(() => {
        throw new Error('ACL denied')
      })

      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.insertOrder,
          source: MODULE_ID.trading,
          target: 'db',
          traceId: 'test-003',
        },
        { orderId: '123' },
      )

      await expect(
        assertAclWithFallback(envelope, STORE_NAME.orders, 'INSERT')
      ).rejects.toThrow('ACL denied')

      expect(fallbackQueue.push).not.toHaveBeenCalled()
    })

    it('saveDailyQuotes 被拒时入队', async () => {
      vi.mocked(aclEngine.assert).mockImplementation(() => {
        throw new Error('ACL denied')
      })
      vi.mocked(fallbackQueue.push).mockImplementation(() => 0)

      const envelope = EnvelopeFactory.create(
        {
          action: ENVELOPE_ACTION.saveDailyQuotes,
          source: MODULE_ID.fetcher,
          target: 'db',
          traceId: 'test-004',
        },
        [],
      )
      const result = await assertAclWithFallback(envelope, STORE_NAME.dailyQuotes, 'INSERT')
      expect(result).toBe(false)
      expect(fallbackQueue.push).toHaveBeenCalled()
    })
  })
})
