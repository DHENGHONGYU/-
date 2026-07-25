/**
 * @test_id V9-TEST-SEC-007
 * @covers_docs [V9-DOC-BACK-012, V9-DOC-AI-006]
 * @description secretConfig 密钥轮换机制单元测试
 *
 * 验证：
 * - setTushareToken / setQwenApiKey 写入时同步创建元数据
 * - isExpired 基于元数据 setAt 正确判断过期
 * - getAgeDays / getDaysSinceVerification 返回正确天数
 * - markVerified 更新 lastVerifiedAt
 * - 清除密钥时同时删除元数据
 * - getSecretHealthSnapshot 返回正确快照
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ============================================================
// Mock localStorage
// ============================================================

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((_index: number) => null),
    _store: () => store,
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

// Mock localStorageManager (defaultStorage)
vi.mock('@/lib/localStorageManager', () => ({
  defaultStorage: {
    getEncrypted: vi.fn().mockResolvedValue('mock-token-value'),
    setEncrypted: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

// 在 mock 之后导入被测模块
const {
  setTushareToken,
  isTushareTokenConfigured,
  isTushareTokenExpired,
  getTushareTokenAgeDays,
  getTushareTokenDaysSinceVerification,
  markTushareTokenVerified,
  setQwenApiKey,
  isQwenApiKeyExpired,
  getQwenApiKeyAgeDays,
  getQwenApiKeyDaysSinceVerification,
  markQwenApiKeyVerified,
  getSecretHealthSnapshot,
} = await import('@/config/secretConfig')

const DAY_MS = 24 * 60 * 60 * 1000

function setMetaNow(storageKey: string, ageMs: number) {
  const setAt = Date.now() - ageMs
  const meta = JSON.stringify({ setAt, lastVerifiedAt: setAt })
  localStorageMock.setItem(`app:${storageKey}_meta`, meta)
}

function setEncryptedEntry(storageKey: string) {
  localStorageMock.setItem(`app:${storageKey}`, '{"__encrypted":true,"data":"abc","iv":"abc"}')
}

describe('secretConfig 密钥轮换机制', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------
  // Tushare Token
  // ----------------------------------------------------------
  describe('Tushare Token', () => {
    it('setTushareToken 写入时同步创建元数据', async () => {
      await setTushareToken('test-token-123')

      const metaRaw = localStorageMock._store()['app:tushare_token_meta']
      expect(metaRaw).toBeDefined()
      const meta = JSON.parse(metaRaw!)
      expect(meta.setAt).toBeGreaterThan(0)
      expect(meta.lastVerifiedAt).toBe(meta.setAt)
    })

    it('setTushareToken 空值时清除密钥和元数据', async () => {
      setEncryptedEntry('tushare_token')
      setMetaNow('tushare_token', 0)

      await setTushareToken('')

      expect(localStorageMock._store()['app:tushare_token_meta']).toBeUndefined()
    })

    it('isTushareTokenConfigured 检测加密条目', () => {
      expect(isTushareTokenConfigured()).toBe(false)

      setEncryptedEntry('tushare_token')
      expect(isTushareTokenConfigured()).toBe(true)
    })

    it('isTushareTokenExpired 未配置时返回 false', () => {
      expect(isTushareTokenExpired()).toBe(false)
    })

    it('isTushareTokenExpired 15天未过期', () => {
      setEncryptedEntry('tushare_token')
      setMetaNow('tushare_token', 15 * DAY_MS)

      expect(isTushareTokenExpired()).toBe(false)
    })

    it('isTushareTokenExpired 31天已过期', () => {
      setEncryptedEntry('tushare_token')
      setMetaNow('tushare_token', 31 * DAY_MS)

      expect(isTushareTokenExpired()).toBe(true)
    })

    it('isTushareTokenExpired 自定义 TTL', () => {
      setEncryptedEntry('tushare_token')
      setMetaNow('tushare_token', 5 * DAY_MS)

      expect(isTushareTokenExpired(3 * DAY_MS)).toBe(true)
      expect(isTushareTokenExpired(10 * DAY_MS)).toBe(false)
    })

    it('isTushareTokenExpired 无元数据时返回 false', () => {
      setEncryptedEntry('tushare_token')
      expect(isTushareTokenExpired()).toBe(false)
    })

    it('getTushareTokenAgeDays 返回正确天数', () => {
      setEncryptedEntry('tushare_token')
      setMetaNow('tushare_token', 10 * DAY_MS + 12 * 60 * 60 * 1000)

      expect(getTushareTokenAgeDays()).toBe(10)
    })

    it('getTushareTokenAgeDays 无元数据时返回 0', () => {
      expect(getTushareTokenAgeDays()).toBe(0)
    })

    it('getTushareTokenDaysSinceVerification 未验证过返回 -1', () => {
      setEncryptedEntry('tushare_token')
      setMetaNow('tushare_token', 10 * DAY_MS)

      expect(getTushareTokenDaysSinceVerification()).toBe(-1)
    })

    it('markTushareTokenVerified 更新 lastVerifiedAt', () => {
      setEncryptedEntry('tushare_token')
      setMetaNow('tushare_token', 10 * DAY_MS)

      const beforeMs = Date.now()
      markTushareTokenVerified()

      const meta = JSON.parse(localStorageMock._store()['app:tushare_token_meta']!)
      expect(meta.lastVerifiedAt).toBeGreaterThanOrEqual(beforeMs)
      expect(meta.setAt).toBe(Date.now() - 10 * DAY_MS)
    })

    it('markTushareTokenVerified 后 getDaysSinceVerification 返回 0', () => {
      setEncryptedEntry('tushare_token')
      setMetaNow('tushare_token', 10 * DAY_MS)

      markTushareTokenVerified()
      expect(getTushareTokenDaysSinceVerification()).toBe(0)
    })
  })

  // ----------------------------------------------------------
  // Qwen API Key
  // ----------------------------------------------------------
  describe('Qwen API Key', () => {
    it('setQwenApiKey 写入时同步创建元数据', async () => {
      await setQwenApiKey('sk-test-key')

      const metaRaw = localStorageMock._store()['app:qwen_api_key_meta']
      expect(metaRaw).toBeDefined()
      const meta = JSON.parse(metaRaw!)
      expect(meta.setAt).toBeGreaterThan(0)
    })

    it('isQwenApiKeyExpired 31天已过期', () => {
      setEncryptedEntry('qwen_api_key')
      setMetaNow('qwen_api_key', 31 * DAY_MS)

      expect(isQwenApiKeyExpired()).toBe(true)
    })

    it('getQwenApiKeyAgeDays 正确计算', () => {
      setEncryptedEntry('qwen_api_key')
      setMetaNow('qwen_api_key', 7 * DAY_MS)

      expect(getQwenApiKeyAgeDays()).toBe(7)
    })

    it('markQwenApiKeyVerified 更新验证时间', () => {
      setEncryptedEntry('qwen_api_key')
      setMetaNow('qwen_api_key', 5 * DAY_MS)

      markQwenApiKeyVerified()
      expect(getQwenApiKeyDaysSinceVerification()).toBe(0)
    })
  })

  // ----------------------------------------------------------
  // getSecretHealthSnapshot
  // ----------------------------------------------------------
  describe('getSecretHealthSnapshot', () => {
    it('全部未配置时返回正确状态', () => {
      const snapshot = getSecretHealthSnapshot()

      expect(snapshot).toHaveLength(2)
      expect(snapshot[0]!.name).toBe('Tushare Token')
      expect(snapshot[0]!.configured).toBe(false)
      expect(snapshot[0]!.expired).toBe(false)
      expect(snapshot[1]!.name).toBe('Qwen API Key')
      expect(snapshot[1]!.configured).toBe(false)
    })

    it('已配置但未过期', () => {
      setEncryptedEntry('tushare_token')
      setMetaNow('tushare_token', 10 * DAY_MS)
      setEncryptedEntry('qwen_api_key')
      setMetaNow('qwen_api_key', 5 * DAY_MS)

      const snapshot = getSecretHealthSnapshot()
      expect(snapshot[0]!.configured).toBe(true)
      expect(snapshot[0]!.expired).toBe(false)
      expect(snapshot[0]!.ageDays).toBe(10)
      expect(snapshot[1]!.configured).toBe(true)
      expect(snapshot[1]!.ageDays).toBe(5)
    })

    it('已配置且已过期', () => {
      setEncryptedEntry('tushare_token')
      setMetaNow('tushare_token', 35 * DAY_MS)

      const snapshot = getSecretHealthSnapshot()
      expect(snapshot[0]!.expired).toBe(true)
      expect(snapshot[0]!.ageDays).toBe(35)
    })
  })
})
