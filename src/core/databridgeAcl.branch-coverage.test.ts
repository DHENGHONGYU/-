/**
 * @test_id V9-TEST-BRANCH-DATABRIDGEACL
 * databridgeAcl 分支覆盖率补充测试
 *
 * 覆盖目标：
 *   1. assertQueryAcl: apiVersion=undefined 时使用 'unspecified' 标签
 *   2. assertQueryGetKey: key 为 null/undefined 时抛 EnvelopeError
 *   3. assertQueryByIndexKey: 缺少 indexName/indexValue 时抛错
 *   4. isMarketEnvelope: 匹配/不匹配 saveDailyQuotes
 *   5. assertAclWithFallback: ACL 通过→true / 市场类拒绝→入队false / 非市场类拒绝→抛出
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EnvelopeError } from './envelope'
import { ENVELOPE_ACTION } from '@/config/dbConfig'
import type { ModuleId } from '@/config/dbConfig'

// ──────────────────────────────────────────────
// Hoisted mocks（vi.mock 工厂会在文件顶部执行，必须用 vi.hoisted）
// ──────────────────────────────────────────────
const { mockLogger, mockAclEngine, mockFallbackQueue } = vi.hoisted(() => ({
  mockLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  mockAclEngine: {
    assert: vi.fn(),
  },
  mockFallbackQueue: {
    push: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

vi.mock('./acl', () => ({
  aclEngine: mockAclEngine,
}))

vi.mock('./fallbackQueue', () => ({
  fallbackQueue: mockFallbackQueue,
}))

// 导入被测模块（在 mock 之后）
import {
  assertQueryAcl,
  assertQueryGetKey,
  assertQueryByIndexKey,
  isMarketEnvelope,
  assertAclWithFallback,
} from './databridgeAcl'
import type { StandardEnvelope } from './envelope'

describe('databridgeAcl — 分支覆盖率补充', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ──────────────────────────────────────────
  // assertQueryAcl
  // ──────────────────────────────────────────
  describe('assertQueryAcl', () => {
    it('apiVersion=undefined 时应使用 unspecified 标签记录日志', () => {
      mockAclEngine.assert.mockImplementation(() => {})

      assertQueryAcl('pool', 'stocks')

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('apiVersion="unspecified"'),
      )
      expect(mockAclEngine.assert).toHaveBeenCalledWith(
        expect.objectContaining({ apiVersion: undefined }),
      )
    })

    it('apiVersion 有值时应记录实际版本', () => {
      mockAclEngine.assert.mockImplementation(() => {})

      assertQueryAcl('pool', 'stocks', '2.0')

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('apiVersion="2.0"'),
      )
      expect(mockAclEngine.assert).toHaveBeenCalledWith(
        expect.objectContaining({ apiVersion: '2.0' }),
      )
    })

    it('ACL 通过时应记录 PASS 日志', () => {
      mockAclEngine.assert.mockImplementation(() => {})

      assertQueryAcl('pool', 'stocks')

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('ACL PASS'),
      )
    })
  })

  // ──────────────────────────────────────────
  // assertQueryGetKey
  // ──────────────────────────────────────────
  describe('assertQueryGetKey', () => {
    it('key 为 null 时应抛 EnvelopeError', () => {
      expect(() => assertQueryGetKey({ key: null })).toThrow(EnvelopeError)
      expect(() => assertQueryGetKey({ key: null })).toThrow('queryGet requires key')
    })

    it('key 为 undefined 时应抛 EnvelopeError', () => {
      expect(() => assertQueryGetKey({})).toThrow(EnvelopeError)
    })

    it('key 有值时应直接返回（不抛错）', () => {
      expect(() => assertQueryGetKey({ key: 'test-key' })).not.toThrow()
    })

    it('key 为 0 时应视为有效值（!= null 检查）', () => {
      expect(() => assertQueryGetKey({ key: 0 })).not.toThrow()
    })

    it('key 为空字符串时应视为有效值', () => {
      expect(() => assertQueryGetKey({ key: '' })).not.toThrow()
    })
  })

  // ──────────────────────────────────────────
  // assertQueryByIndexKey
  // ──────────────────────────────────────────
  describe('assertQueryByIndexKey', () => {
    it('缺少 indexName 时应抛 EnvelopeError', () => {
      expect(() => assertQueryByIndexKey({ indexValue: 'val' })).toThrow(EnvelopeError)
      expect(() => assertQueryByIndexKey({ indexValue: 'val' })).toThrow('queryByIndex requires')
    })

    it('缺少 indexValue 时应抛 EnvelopeError', () => {
      expect(() => assertQueryByIndexKey({ indexName: 'idx' })).toThrow(EnvelopeError)
    })

    it('indexValue 为 undefined 时应抛错', () => {
      expect(() => assertQueryByIndexKey({ indexName: 'idx', indexValue: undefined })).toThrow(EnvelopeError)
    })

    it('indexName 和 indexValue 都有值时应直接返回', () => {
      expect(() => assertQueryByIndexKey({ indexName: 'idx', indexValue: 'val' })).not.toThrow()
    })

    it('indexValue 为 0 时应视为有效值', () => {
      expect(() => assertQueryByIndexKey({ indexName: 'idx', indexValue: 0 })).not.toThrow()
    })
  })

  // ──────────────────────────────────────────
  // isMarketEnvelope
  // ──────────────────────────────────────────
  describe('isMarketEnvelope', () => {
    it('saveDailyQuotes 动作应返回 true', () => {
      expect(isMarketEnvelope(ENVELOPE_ACTION.saveDailyQuotes)).toBe(true)
    })

    it('非 saveDailyQuotes 动作应返回 false', () => {
      expect(isMarketEnvelope(ENVELOPE_ACTION.insertStock)).toBe(false)
      expect(isMarketEnvelope('UNKNOWN_ACTION')).toBe(false)
      expect(isMarketEnvelope('')).toBe(false)
    })
  })

  // ──────────────────────────────────────────
  // assertAclWithFallback
  // ──────────────────────────────────────────
  describe('assertAclWithFallback', () => {
    function makeEnvelope(action: string, source: ModuleId = 'pool'): StandardEnvelope {
      return {
        meta: {
          source,
          target: 'db',
          action: action as never,
          traceId: 'test-trace',
          timestamp: Date.now(),
        },
        payload: {},
      }
    }

    it('ACL 通过时应返回 true', async () => {
      mockAclEngine.assert.mockImplementation(() => {})

      const result = await assertAclWithFallback(
        makeEnvelope(ENVELOPE_ACTION.insertStock),
        'stocks',
        'INSERT',
      )

      expect(result).toBe(true)
      expect(mockFallbackQueue.push).not.toHaveBeenCalled()
    })

    it('市场类 envelope ACL 拒绝时应入队并返回 false', async () => {
      mockAclEngine.assert.mockImplementation(() => {
        throw new Error('ACL denied')
      })

      const envelope = makeEnvelope(ENVELOPE_ACTION.saveDailyQuotes, 'market' as ModuleId)
      const result = await assertAclWithFallback(envelope, 'daily_quotes', 'INSERT')

      expect(result).toBe(false)
      expect(mockFallbackQueue.push).toHaveBeenCalledWith(envelope)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('市场数据 ACL 拒绝'),
        expect.objectContaining({ source: 'market' }),
      )
    })

    it('非市场类 envelope ACL 拒绝时应直接抛出', async () => {
      const aclError = new Error('ACL denied for non-market')
      mockAclEngine.assert.mockImplementation(() => {
        throw aclError
      })

      await expect(
        assertAclWithFallback(
          makeEnvelope(ENVELOPE_ACTION.insertStock),
          'stocks',
          'INSERT',
        ),
      ).rejects.toThrow('ACL denied for non-market')

      expect(mockFallbackQueue.push).not.toHaveBeenCalled()
    })

    it('非 Error 异常在 ACL 拒绝时也应正确处理', async () => {
      mockAclEngine.assert.mockImplementation(() => {
        throw 'string acl error'
      })

      // 非市场类 → 直接抛出
      await expect(
        assertAclWithFallback(
          makeEnvelope(ENVELOPE_ACTION.insertStock),
          'stocks',
          'INSERT',
        ),
      ).rejects.toThrow('string acl error')
    })
  })
})
