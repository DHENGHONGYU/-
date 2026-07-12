/**
 * MemoryCache 压力测试
 *
 * 测试场景：
 * 1. TTL 过期（隔离 describe 块，避免 fake timers 影响其他测试）
 * 2. LRU 淘汰（使用真实时间）
 * 3. 高频写入压力（1000 次 set）
 * 4. 命中率统计正确性
 * 5. delete 与 destroy
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { MemoryCache } from '@/core/memoryCache'

describe('MemoryCache — 压力测试', () => {
  describe('P2-A2: LRU 淘汰（真实时间）', () => {
    it('容量满时应淘汰最久未访问的条目', () => {
      const cache = new MemoryCache<string>({
        namespace: 'test-lru',
        maxSize: 3,
        cleanupInterval: 0, // 禁用定时清理，避免干扰
      })

      cache.set('a', 'A')
      cache.set('b', 'B')
      cache.set('c', 'C')
      expect(cache.size).toBe(3)

      // 访问 'a' 使其成为最新
      cache.get('a')

      // 写入 'd' 触发 LRU 淘汰（'b' 最久未访问）
      cache.set('d', 'D')
      expect(cache.size).toBe(3)
      expect(cache.get('b')).toBeUndefined() // 被淘汰
      expect(cache.get('a')).toBe('A') // 仍然存在
      expect(cache.get('c')).toBe('C') // 仍然存在
      expect(cache.get('d')).toBe('D') // 新写入

      cache.destroy()
    })

    it('set 操作应更新 LRU 时间戳（更新现有 key 不触发驱逐）', () => {
      const cache = new MemoryCache<string>({
        namespace: 'test-lru-set',
        maxSize: 2,
        cleanupInterval: 0,
      })

      // 容量为 2，连续写入 3 个不同的 key，第三个应驱逐第一个
      cache.set('a', 'A')
      cache.set('b', 'B')
      expect(cache.has('a')).toBe(true) // 不更新 LRU
      expect(cache.has('b')).toBe(true) // 不更新 LRU

      // 更新 'a' 的值（key 已存在，不应触发驱逐）
      cache.set('a', 'A-updated')
      expect(cache.size).toBe(2) // 容量仍为 2，未驱逐任何条目
      expect(cache.has('a')).toBe(true) // 'a' 仍存在
      expect(cache.has('b')).toBe(true) // 'b' 仍存在

      // 写入新 key 'c'，触发 LRU 驱逐（驱逐 'b'，因为 'a' 刚被更新过）
      cache.set('c', 'C')
      expect(cache.size).toBe(2)
      expect(cache.get('b')).toBeUndefined() // 'b' 被驱逐（最久未访问）
      expect(cache.get('a')).toBe('A-updated') // 'a' 保留（最近更新过）
      expect(cache.get('c')).toBe('C') // 'c' 新写入

      cache.destroy()
    })

    it('stats 应正确记录淘汰次数', () => {
      const cache = new MemoryCache<string>({
        namespace: 'test-lru-stats',
        maxSize: 2,
        cleanupInterval: 0,
      })

      cache.set('a', 'A')
      cache.set('b', 'B')
      expect(cache.getStats().evictionCount).toBe(0)

      cache.set('c', 'C') // 淘汰 'a'
      expect(cache.getStats().evictionCount).toBe(1)

      cache.set('d', 'D') // 淘汰 'b'
      expect(cache.getStats().evictionCount).toBe(2)

      cache.destroy()
    })

    it('仅访问（get）应更新 LRU 时间戳，不应更新创建时间', () => {
      const cache = new MemoryCache<string>({
        namespace: 'test-lru-get-only',
        maxSize: 2,
        cleanupInterval: 0,
      })

      cache.set('a', 'A')
      cache.set('b', 'B')

      // 大量访问 'a' 使其成为最新
      for (let i = 0; i < 100; i++) {
        cache.get('a')
      }

      // 写入 'c' 应淘汰 'b'（而非 'a'）
      cache.set('c', 'C')
      expect(cache.get('b')).toBeUndefined()
      expect(cache.get('a')).toBe('A')

      cache.destroy()
    })
  })

  describe('P2-A1: TTL 过期（隔离 fake timers）', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('应在 TTL 到期后自动清除过期条目', () => {
      vi.useFakeTimers()
      const cache = new MemoryCache<number>({
        namespace: 'test-ttl',
        defaultTTL: 50,
        cleanupInterval: 0, // 禁用自动清理，手动触发过期检测
      })

      cache.set('key1', 100)
      expect(cache.get('key1')).toBe(100)

      // 快进 49ms，未过期
      vi.advanceTimersByTime(49)
      expect(cache.get('key1')).toBe(100)

      // 快进到 51ms，已过期
      vi.advanceTimersByTime(2)
      expect(cache.get('key1')).toBeUndefined()

      cache.destroy()
    })

    it('应支持逐条自定义 TTL', () => {
      vi.useFakeTimers()
      const cache = new MemoryCache<number>({
        namespace: 'test-custom-ttl',
        defaultTTL: 100,
        cleanupInterval: 0,
      })

      cache.set('fast', 1, 20) // 20ms 后过期
      cache.set('slow', 2, 200) // 200ms 后过期

      vi.advanceTimersByTime(30)
      expect(cache.get('fast')).toBeUndefined()
      expect(cache.get('slow')).toBe(2)

      cache.destroy()
    })

    it('TTL=0 表示永不过期', () => {
      vi.useFakeTimers()
      const cache = new MemoryCache<number>({
        namespace: 'test-no-ttl',
        defaultTTL: 0,
        cleanupInterval: 0,
      })

      cache.set('permanent', 999)
      vi.advanceTimersByTime(999_999_999)
      expect(cache.get('permanent')).toBe(999)

      cache.destroy()
    })
  })

  describe('P2-A3: 高频写入压力', () => {
    it('1000 次 set/get 应无内存泄漏', () => {
      const cache = new MemoryCache<number>({
        namespace: 'test-stress',
        maxSize: 1000,
        cleanupInterval: 0,
      })

      for (let i = 0; i < 1000; i++) {
        cache.set(`key-${i}`, i)
      }
      expect(cache.size).toBe(1000)

      for (let i = 0; i < 1000; i++) {
        expect(cache.get(`key-${i}`)).toBe(i)
      }

      const stats = cache.getStats()
      expect(stats.hitCount).toBe(1000)
      expect(stats.missCount).toBe(0)
      expect(stats.evictionCount).toBe(0)

      cache.destroy()
    })

    it('容量 100 条时连续写入 200 条应触发 LRU 淘汰', () => {
      const cache = new MemoryCache<number>({
        namespace: 'test-stress-lru',
        maxSize: 100,
        cleanupInterval: 0,
      })

      for (let i = 0; i < 200; i++) {
        cache.set(`key-${i}`, i)
      }

      expect(cache.size).toBe(100)
      expect(cache.getStats().evictionCount).toBe(100)
      expect(cache.get('key-0')).toBeUndefined()
      expect(cache.get('key-99')).toBeUndefined()
      expect(cache.get('key-100')).toBe(100)
      expect(cache.get('key-199')).toBe(199)

      cache.destroy()
    })
  })

  describe('P2-A4: 命中率统计', () => {
    it('get 命中/未命中统计正确', () => {
      const cache = new MemoryCache<number>({
        namespace: 'test-stats',
        defaultTTL: 0,
        cleanupInterval: 0,
      })

      cache.set('a', 1)
      cache.set('b', 2)

      expect(cache.get('a')).toBe(1) // hit
      expect(cache.get('a')).toBe(1) // hit
      expect(cache.get('missing')).toBeUndefined() // miss
      expect(cache.get('b')).toBe(2) // hit

      const stats = cache.getStats()
      expect(stats.hitCount).toBe(3)
      expect(stats.missCount).toBe(1)
      expect(stats.hitRate).toBeCloseTo(0.75, 2)

      cache.destroy()
    })

    it('resetStats 应清零统计', () => {
      const cache = new MemoryCache<number>({
        namespace: 'test-reset',
        cleanupInterval: 0,
      })
      cache.set('a', 1)
      cache.get('a')
      cache.get('missing')

      cache.resetStats()

      const stats = cache.getStats()
      expect(stats.hitCount).toBe(0)
      expect(stats.missCount).toBe(0)
      expect(stats.evictionCount).toBe(0)
      expect(stats.hitRate).toBe(0)

      cache.destroy()
    })
  })

  describe('P2-A5: delete 与 destroy', () => {
    // 隔离 fake timers：destroy 测试使用 fake timers，必须确保测试结束后恢复真实 timers
    beforeEach(() => { vi.useRealTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('delete 应移除指定条目', () => {
      const cache = new MemoryCache<number>({
        namespace: 'test-delete',
        cleanupInterval: 0,
      })
      cache.set('a', 1)
      expect(cache.get('a')).toBe(1)

      const deleted = cache.delete('a')
      expect(deleted).toBe(true)
      expect(cache.get('a')).toBeUndefined()
      expect(cache.delete('a')).toBe(false)

      cache.destroy()
    })

    it('destroy 应清空所有数据并停止定时器', () => {
      vi.useFakeTimers()
      const cache = new MemoryCache<number>({
        namespace: 'test-destroy',
        defaultTTL: 10,
        cleanupInterval: 10,
      })

      cache.set('a', 1)
      cache.set('b', 2)
      expect(cache.size).toBe(2)

      cache.destroy()

      expect(cache.get('a')).toBeUndefined()
      expect(cache.size).toBe(0)

      vi.useRealTimers()
    })
  })
})
