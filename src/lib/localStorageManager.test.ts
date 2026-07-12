/**
 * LocalStorageManager 压力测试
 *
 * 测试场景：
 * 1. 命名空间隔离
 * 2. TTL 过期检查
 * 3. 容量监控告警
 * 4. JSON 序列化/反序列化
 * 5. 批量操作（getAll/clearNamespace）
 * 6. 静态方法（listNamespaces/clearAll）
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { LocalStorageManager } from '@/lib/localStorageManager'

// 全局共享 mock storage（跨测试实例持久化）
const sharedMemory = new Map<string, string>()

// 将 localStorage 替换为 mock 实现
beforeEach(() => {
  sharedMemory.clear()
  const mem = sharedMemory
  // 使用 getter 使 length 动态化（避免直接赋值导致不更新）
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => mem.get(key) ?? null,
      setItem: (key: string, value: string) => { mem.set(key, value) },
      removeItem: (key: string) => { mem.delete(key) },
      clear: () => { mem.clear() },
      key: (i: number) => [...mem.keys()][i] ?? null,
      get length() { return mem.size },
    },
    writable: true,
    configurable: true,
  })
})

describe('LocalStorageManager — 压力测试', () => {
  describe('P2-B1: 命名空间隔离', () => {
    it('不同命名空间应互相隔离', () => {
      const mgrA = new LocalStorageManager({ namespace: 'app:a' })
      const mgrB = new LocalStorageManager({ namespace: 'app:b' })

      mgrA.set('token', 'secret-A')
      mgrB.set('token', 'secret-B')

      expect(mgrA.get<string>('token')).toBe('secret-A')
      expect(mgrB.get<string>('token')).toBe('secret-B')

      mgrA.clearNamespace()
      // get() 对不存在的 key 返回 null（非 undefined）
      expect(mgrA.get('token')).toBeNull()
      expect(mgrB.get<string>('token')).toBe('secret-B') // B 未受影响
    })

    it('clearNamespace 应删除所有该命名空间下的条目', () => {
      const mgr = new LocalStorageManager({ namespace: 'ns-multi' })
      mgr.set('k1', 'v1')
      mgr.set('k2', 'v2')
      mgr.set('k3', 'v3')

      expect(Object.keys(mgr.getAll())).toHaveLength(3)

      mgr.clearNamespace()
      expect(mgr.getAll()).toEqual({})
    })
  })

  describe('P2-B2: TTL 过期', () => {
    it('已过期的条目在 get 时应返回 undefined', () => {
      const mgr = new LocalStorageManager({ namespace: 'test-ttl', defaultTTL: 0 })

      // 手动写入已过期的条目（expiresAt 设为过去的时间戳）
      const pastExpiry = Date.now() - 1000 // 1 秒前已过期
      const expiredEntry = JSON.stringify({ v: JSON.stringify('should-be-gone'), expiresAt: pastExpiry, createdAt: Date.now(), version: 1 })
      sharedMemory.set('test-ttl:expired-key', expiredEntry)

      // get 应检测到过期并删除条目，返回 null（与实现一致）
      expect(mgr.get('expired-key')).toBeNull()
    })

    it('无过期时间的条目应永久有效', () => {
      const mgr = new LocalStorageManager({ namespace: 'test-no-ttl' })
      mgr.set('permanent', { data: 'forever' }) // 无 TTL

      const value = mgr.get<{ data: string }>('permanent')
      expect(value).toEqual({ data: 'forever' })
    })

    it('expiresAt=0 的条目应永久有效（0 表示不过期）', () => {
      const mgr = new LocalStorageManager({ namespace: 'test-ttl-zero', defaultTTL: 0 })
      // defaultTTL=0 → entries are stored with expiresAt=0 (never expire)
      mgr.set('forever', 'never')

      expect(mgr.get('forever')).toBe('never')
    })
  })

  describe('P2-B3: 容量监控告警', () => {
    it('容量超 80% 阈值时应触发警告', () => {
      const mgr = new LocalStorageManager({
        namespace: 'test-capacity',
        capacityWarningThreshold: 0.8,
      })

      // 模拟大量数据（每条约 200KB，使已用超过 80%）
      for (let i = 0; i < 22; i++) {
        sharedMemory.set(`test-capacity:large-${i}`, 'x'.repeat(200_000))
      }

      const cap = mgr.getCapacity()
      expect(cap.isWarning).toBe(true)
      expect(cap.usageRatio).toBeGreaterThan(0.8)
    })

    it('容量未超阈值时应无警告', () => {
      const mgr = new LocalStorageManager({
        namespace: 'test-capacity-ok',
        capacityWarningThreshold: 0.9,
      })

      mgr.set('small', 'value')
      const cap = mgr.getCapacity()
      expect(cap.isWarning).toBe(false)
    })
  })

  describe('P2-B4: JSON 序列化/反序列化', () => {
    it('应自动序列化/反序列化复杂对象', () => {
      const mgr = new LocalStorageManager({ namespace: 'test-json' })

      const complex = {
        nested: { deep: { value: 42 } },
        array: [1, 2, 3],
        bool: true,
        null: null,
      }

      mgr.set('complex', complex)
      const retrieved = mgr.get<typeof complex>('complex')
      expect(retrieved).toEqual(complex)
    })

    it('null 值应被正确处理', () => {
      const mgr = new LocalStorageManager({ namespace: 'test-null' })
      mgr.set('null', null)
      expect(mgr.get('null')).toBeNull()
    })
  })

  describe('P2-B5: 批量操作', () => {
    it('getAll 应返回当前命名空间下所有条目', () => {
      const mgr = new LocalStorageManager({ namespace: 'test-batch' })
      mgr.set('a', 1)
      mgr.set('b', 2)
      mgr.set('c', 3)

      const all = mgr.getAll<number>()
      expect(Object.keys(all)).toHaveLength(3)
      expect(all.a).toBe(1)
      expect(all.b).toBe(2)
      expect(all.c).toBe(3)
    })

    it('clearNamespace 应仅清空当前命名空间', () => {
      const mgrA = new LocalStorageManager({ namespace: 'ns-a' })
      const mgrB = new LocalStorageManager({ namespace: 'ns-b' })

      mgrA.set('x', 1)
      mgrB.set('y', 2)

      mgrA.clearNamespace()

      expect(mgrA.getAll()).toEqual({})
      expect(mgrB.get<number>('y')).toBe(2)
    })

    it('getAll 不应包含其他命名空间的数据', () => {
      const mgrA = new LocalStorageManager({ namespace: '隔离-a' })
      const mgrB = new LocalStorageManager({ namespace: '隔离-b' })

      mgrA.set('only-a', 'A')
      mgrB.set('only-b', 'B')

      const allA = mgrA.getAll()
      expect(allA['only-a']).toBe('A')
      expect((allA as Record<string, unknown>)['only-b']).toBeUndefined()
    })
  })

  describe('P2-B6: 静态方法', () => {
    it('listNamespaces 应返回所有活跃命名空间', () => {
      const mgr1 = new LocalStorageManager({ namespace: 'static-ns1' })
      const mgr2 = new LocalStorageManager({ namespace: 'static-ns2' })
      mgr1.set('x', 1)
      mgr2.set('y', 2)

      const ns = LocalStorageManager.listNamespaces()
      expect(ns).toContain('static-ns1')
      expect(ns).toContain('static-ns2')
    })

    it('clearAll 应清空所有命名空间', () => {
      const mgr1 = new LocalStorageManager({ namespace: 'clear-all-1' })
      const mgr2 = new LocalStorageManager({ namespace: 'clear-all-2' })
      mgr1.set('a', 1)
      mgr2.set('b', 2)

      LocalStorageManager.clearAll()

      expect(mgr1.getAll()).toEqual({})
      expect(mgr2.getAll()).toEqual({})
    })

    it('getGlobalCapacity 应返回全局容量信息', () => {
      const mgr = new LocalStorageManager({ namespace: 'test-global-cap' })
      mgr.set('tiny', 'x')

      const cap = LocalStorageManager.getGlobalCapacity()
      expect(cap.totalBytes).toBe(5_242_880)
      expect(cap.usedBytes).toBeGreaterThan(0)
      expect(cap.usageRatio).toBeGreaterThan(0)
    })
  })
})
