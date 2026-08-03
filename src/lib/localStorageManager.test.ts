/**
 * @test_id V9-TEST-ST-024
 * LocalStorageManager 压力测试
 *
 * 测试场景：
 * 1. 命名空间隔离
 * 2. TTL 过期检查
 * 3. 容量监控告警
 * 4. JSON 序列化/反序列化
 * 5. 批量操作（getAll/clearNamespace）
 * 6. 静态方法（listNamespaces/clearAll）
  * @covers_docs []
*/
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { LocalStorageManager, createStorage, defaultStorage } from '@/lib/localStorageManager'

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

  describe('P0-A1: 加密存储', () => {
    it('加密写入后应能解密读取原始值', async () => {
      const mgr = new LocalStorageManager({ namespace: 'crypto-basic' })
      const secret = { token: 'sk-abc123', userId: 42 }
      await mgr.setEncrypted('secret', secret)
      expect(await mgr.getEncrypted<typeof secret>('secret')).toEqual(secret)
    })
    it('加密字符串/数字/null/嵌套对象/数组应正确解密', async () => {
      const mgr = new LocalStorageManager({ namespace: 'crypto-types' })
      await mgr.setEncrypted('s', 'str'); expect(await mgr.getEncrypted<string>('s')).toBe('str')
      await mgr.setEncrypted('n', 42); expect(await mgr.getEncrypted<number>('n')).toBe(42)
      await mgr.setEncrypted('nil', null); expect(await mgr.getEncrypted('nil')).toBeNull()
      const obj = { a: { b: [1, { c: true }] } }
      await mgr.setEncrypted('o', obj); expect(await mgr.getEncrypted<typeof obj>('o')).toEqual(obj)
      const arr = [1, 'two', { three: 3 }]
      await mgr.setEncrypted('arr', arr); expect(await mgr.getEncrypted<typeof arr>('arr')).toEqual([1, 'two', { three: 3 }])
    })
    it('读取不存在的加密 key 应返回 null', async () => {
      const mgr = new LocalStorageManager({ namespace: 'crypto-miss' })
      expect(await mgr.getEncrypted('nonexistent')).toBeNull()
    })
    it('加密条目应带 __encrypted 标识', async () => {
      const mgr = new LocalStorageManager({ namespace: 'crypto-flag' })
      await mgr.setEncrypted('k', 'v')
      const raw = sharedMemory.get('crypto-flag:k')!
      expect(JSON.parse(raw).__encrypted).toBe(true)
    })
    it('加密条目应支持 TTL 过期', async () => {
      const mgr = new LocalStorageManager({ namespace: 'crypto-ttl' })
      await mgr.setEncrypted('temp', 'data', 1)
      expect(await mgr.getEncrypted<string>('temp')).toBe('data')
      await new Promise((r) => setTimeout(r, 50))
      expect(await mgr.getEncrypted('temp')).toBeNull()
    })
    it('检测到明文条目应返回 null 并删除', async () => {
      const mgr = new LocalStorageManager({ namespace: 'crypto-plain' })
      sharedMemory.set('crypto-plain:k', JSON.stringify({ ns: 'crypto-plain', value: 'plain', createdAt: Date.now(), expiresAt: 0, version: 1 }))
      expect(await mgr.getEncrypted('k')).toBeNull()
      expect(sharedMemory.has('crypto-plain:k')).toBe(false)
    })
    it('解密失败应返回 null 并删除条目', async () => {
      const mgr = new LocalStorageManager({ namespace: 'crypto-tamper' })
      await mgr.setEncrypted('orig', 'real')
      const payload = JSON.parse(sharedMemory.get('crypto-tamper:orig')!)
      payload.data = btoa('tampered')
      sharedMemory.set('crypto-tamper:orig', JSON.stringify(payload))
      expect(await mgr.getEncrypted('orig')).toBeNull()
      expect(sharedMemory.has('crypto-tamper:orig')).toBe(false)
    })
    it('不同命名空间加密数据应隔离', async () => {
      const a = new LocalStorageManager({ namespace: 'crypto-ns-a' })
      const b = new LocalStorageManager({ namespace: 'crypto-ns-b' })
      await a.setEncrypted('k', 'va'); await b.setEncrypted('k', 'vb')
      expect(await a.getEncrypted<string>('k')).toBe('va')
      expect(await b.getEncrypted<string>('k')).toBe('vb')
    })
  })

  describe('P0-A2: 基础方法 remove/has/keys', () => {
    it('remove 应删除指定 key', () => {
      const mgr = new LocalStorageManager({ namespace: 'rm-basic' })
      mgr.set('a', 1); mgr.set('b', 2); mgr.remove('a')
      expect(mgr.get('a')).toBeNull(); expect(mgr.get<number>('b')).toBe(2)
    })
    it('remove 不存在的 key 不应抛出', () => {
      expect(() => new LocalStorageManager({ namespace: 'rm-miss' }).remove('no')).not.toThrow()
    })
    it('has 存在/不存在/过期', () => {
      const mgr = new LocalStorageManager({ namespace: 'has-test' })
      mgr.set('yes', 'v'); expect(mgr.has('yes')).toBe(true); expect(mgr.has('no')).toBe(false)
      sharedMemory.set('has-test:old', JSON.stringify({ ns: 'has-test', value: '"x"', createdAt: Date.now() - 10000, expiresAt: Date.now() - 1000, version: 1 }))
      expect(mgr.has('old')).toBe(false)
    })
    it('keys 应返回当前命名空间所有 key', () => {
      const mgr = new LocalStorageManager({ namespace: 'keys-multi' })
      mgr.set('k1', 1); mgr.set('k2', 2)
      expect(mgr.keys()).toHaveLength(2)
    })
    it('keys 不应包含其他命名空间', () => {
      const a = new LocalStorageManager({ namespace: 'keys-a' })
      const b = new LocalStorageManager({ namespace: 'keys-b' })
      a.set('only-a', 1); b.set('only-b', 2)
      expect(a.keys()).toContain('only-a'); expect(a.keys()).not.toContain('only-b')
    })
    it('keys 空命名空间返回空数组', () => {
      expect(new LocalStorageManager({ namespace: 'keys-empty' }).keys()).toEqual([])
    })
  })

  describe('P0-A3: purgeExpired', () => {
    it('应清理过期条目并返回数量', () => {
      const mgr = new LocalStorageManager({ namespace: 'purge-multi' })
      const past = Date.now() - 1000, future = Date.now() + 100000
      sharedMemory.set('purge-multi:e1', JSON.stringify({ ns: 'purge-multi', value: '"e1"', createdAt: past, expiresAt: past, version: 1 }))
      sharedMemory.set('purge-multi:e2', JSON.stringify({ ns: 'purge-multi', value: '"e2"', createdAt: past, expiresAt: past, version: 1 }))
      sharedMemory.set('purge-multi:alive', JSON.stringify({ ns: 'purge-multi', value: '"alive"', createdAt: Date.now(), expiresAt: future, version: 1 }))
      expect(mgr.purgeExpired()).toBe(2)
      expect(mgr.has('alive')).toBe(true)
    })
    it('无过期/空命名空间返回 0', () => {
      const mgr = new LocalStorageManager({ namespace: 'purge-none' })
      mgr.set('perm', 'v')
      expect(mgr.purgeExpired()).toBe(0)
      expect(new LocalStorageManager({ namespace: 'purge-empty' }).purgeExpired()).toBe(0)
    })
    it('expiresAt=0 永不过期', () => {
      const mgr = new LocalStorageManager({ namespace: 'purge-zero' })
      mgr.set('forever', 'v'); mgr.purgeExpired()
      expect(mgr.has('forever')).toBe(true)
    })
  })

  describe('P0-A4: getNamespaceInfo', () => {
    it('应返回命名空间名称和 key 数量', () => {
      const mgr = new LocalStorageManager({ namespace: 'info-basic' })
      mgr.set('a', 1); mgr.set('b', 2)
      const info = mgr.getNamespaceInfo()
      expect(info.namespace).toBe('info-basic'); expect(info.keyCount).toBe(2)
    })
    it('空命名空间 keyCount=0 totalBytes=0', () => {
      const info = new LocalStorageManager({ namespace: 'info-empty' }).getNamespaceInfo()
      expect(info.keyCount).toBe(0); expect(info.totalBytes).toBe(0)
      expect(info.oldestEntry).toBeNull(); expect(info.newestEntry).toBeNull()
    })
    it('oldestEntry/newestEntry 应返回正确 key', () => {
      const mgr = new LocalStorageManager({ namespace: 'info-time' })
      sharedMemory.set('info-time:second', JSON.stringify({ ns: 'info-time', value: '"b"', createdAt: 2000000, expiresAt: 0, version: 1 }))
      sharedMemory.set('info-time:first', JSON.stringify({ ns: 'info-time', value: '"a"', createdAt: 1000000, expiresAt: 0, version: 1 }))
      const info = mgr.getNamespaceInfo()
      expect(info.oldestEntry).toBe('first'); expect(info.newestEntry).toBe('second')
    })
    it('损坏 JSON 不应崩溃', () => {
      const mgr = new LocalStorageManager({ namespace: 'info-corrupt' })
      sharedMemory.set('info-corrupt:bad', 'not-json{{{')
      mgr.set('good', 'v')
      expect(() => mgr.getNamespaceInfo()).not.toThrow()
    })
  })

  describe('P0-A5: 异常路径', () => {
    it('set QuotaExceededError 应抛出含 key 的错误', () => {
      const mgr = new LocalStorageManager({ namespace: 'quota-set' })
      const orig = localStorage.setItem
      localStorage.setItem = vi.fn(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError') })
      try { expect(() => mgr.set('big', 'data')).toThrow(/配额已满/) } finally { localStorage.setItem = orig }
    })
    it('set 非 QuotaExceededError 应原样抛出', () => {
      const mgr = new LocalStorageManager({ namespace: 'quota-other' })
      const orig = localStorage.setItem
      localStorage.setItem = vi.fn(() => { throw new Error('Other error') })
      try { expect(() => mgr.set('k', 'v')).toThrow('Other error') } finally { localStorage.setItem = orig }
    })
    it('setEncrypted QuotaExceededError 应抛出', async () => {
      const mgr = new LocalStorageManager({ namespace: 'quota-enc' })
      await mgr.setEncrypted('pre', 'warmup')
      const orig = localStorage.setItem
      localStorage.setItem = vi.fn(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError') })
      try { await expect(mgr.setEncrypted('big', 'data')).rejects.toThrow(/配额已满/) } finally { localStorage.setItem = orig }
    })
    it('get/getEncrypted 损坏 JSON 应返回 null 并删除', async () => {
      const mgr = new LocalStorageManager({ namespace: 'corrupt' })
      sharedMemory.set('corrupt:bad', 'not-json{{{')
      expect(mgr.get('bad')).toBeNull(); expect(sharedMemory.has('corrupt:bad')).toBe(false)
      sharedMemory.set('corrupt:bad2', 'not-json{{{')
      expect(await mgr.getEncrypted('bad2')).toBeNull(); expect(sharedMemory.has('corrupt:bad2')).toBe(false)
    })
    it('get 未找到 key 返回 null', () => {
      expect(new LocalStorageManager({ namespace: 'get-miss' }).get('no')).toBeNull()
    })
  })

  describe('P0-A6: 工厂函数', () => {
    it('createStorage 应创建实例', () => {
      const s = createStorage('factory-ns')
      expect(s).toBeInstanceOf(LocalStorageManager)
      s.set('k', 'v'); expect(s.get<string>('k')).toBe('v')
    })
    it('createStorage 支持 options', () => {
      const s = createStorage('factory-opt', { defaultTTL: 0 })
      s.set('p', 'd'); expect(s.get<string>('p')).toBe('d')
    })
    it('createStorage 命名空间隔离', () => {
      const a = createStorage('iso-a'), b = createStorage('iso-b')
      a.set('k', 'a'); b.set('k', 'b')
      expect(a.get<string>('k')).toBe('a'); expect(b.get<string>('k')).toBe('b')
    })
    it('defaultStorage 为 LocalStorageManager 实例', () => {
      expect(defaultStorage).toBeInstanceOf(LocalStorageManager)
      defaultStorage.set('dt', 'v'); expect(defaultStorage.get<string>('dt')).toBe('v')
    })
  })

  describe('P0-A7: 容量监控补充', () => {
    it('未超阈值 isWarning=false', () => {
      const mgr = new LocalStorageManager({ namespace: 'cap-ok', capacityWarningThreshold: 0.9 })
      mgr.set('s', 'x'); expect(mgr.getCapacity().isWarning).toBe(false)
    })
    it('totalBytes=5MB', () => {
      expect(new LocalStorageManager({ namespace: 'cap-t' }).getCapacity().totalBytes).toBe(5_242_880)
    })
    it('空 storage usedBytes=0', () => {
      const cap = new LocalStorageManager({ namespace: 'cap-e' }).getCapacity()
      expect(cap.usedBytes).toBe(0); expect(cap.usageRatio).toBe(0)
    })
    it('自定义 threshold 应生效', () => {
      const mgr = new LocalStorageManager({ namespace: 'cap-th', capacityWarningThreshold: 0.00001 })
      mgr.set('t', 'data'); expect(mgr.getCapacity().isWarning).toBe(true)
    })
  })
})
