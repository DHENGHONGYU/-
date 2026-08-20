/**
 * lib/localStorageCrypto — 单元测试
 * 只增不删策略（TD-022 覆盖率增量 Round 3+）。
 *
 * 覆盖目标：
 *  - getOrCreateCryptoKey：缓存命中 / 未命中；window 未定义 fallback='app' 分支
 *  - generateIv：12 字节 Uint8Array + getRandomValues 填充
 *  - arrayBufferToBase64：Uint8Array 真分支 / ArrayBuffer 假分支
 *  - base64ToArrayBuffer：atob → Uint8Array
 *
 * 修复（TD-024）：
 *   - globalThis.crypto / window 用 Object.defineProperty 或 as any 赋值，
 *     避免 Node 20 全局 crypto 只读属性 TypeError。
 *   - 用 vi.resetModules() + beforeEach 的动态 import() 重置模块级缓存 Map，
 *     而不是 require.cache（ESM 环境里不存在）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { EncryptedPayload } from './localStorageCrypto'

type EC = typeof import('./localStorageCrypto')

type DummyKey = { __brand: 'AES-GCM'; ns: string }
function isDummyKey(k: unknown): k is DummyKey {
  return typeof k === 'object' && k !== null && (k as DummyKey).__brand === 'AES-GCM'
}

const calls: string[] = []
let stubRandomSeed = 0

function buildCryptoStub() {
  return {
    getRandomValues: <T extends Uint8Array>(buf: T): T => {
      calls.push('getRandomValues(' + buf.length + ')')
      for (let i = 0; i < buf.length; i++) {
        buf[i] = ((stubRandomSeed + i) * 31) % 256
      }
      stubRandomSeed++
      return buf
    },
    subtle: {
      importKey: async (
        format: string,
        keyMaterial: BufferSource,
        _algo: any,
        _extractable: boolean,
        usages: KeyUsage[],
      ) => {
        const bytes = keyMaterial instanceof Uint8Array ? keyMaterial : new Uint8Array(keyMaterial as ArrayBuffer)
        const nsText = new TextDecoder().decode(bytes)
        calls.push(`subtle.importKey(${format}, ${nsText.slice(0, 40)}, ${JSON.stringify(usages)})`)
        return { __brand: 'PBKDF2-BASE', mat: nsText } as unknown as CryptoKey
      },
      deriveKey: async (
        algo: any,
        baseKey: CryptoKey,
        _derivedKeyType: any,
        _extractable: boolean,
        usages: KeyUsage[],
      ) => {
        const iterations = algo.iterations
        const mat = (baseKey as unknown as { mat: string }).mat
        const ns = mat.split(':')[0] ?? 'unknown'
        calls.push(`subtle.deriveKey(PBKDF2 it=${iterations}, ns=${ns}, usages=${JSON.stringify(usages)})`)
        return { __brand: 'AES-GCM', ns } as unknown as CryptoKey
      },
    },
  }
}

/** 每个 it 前：装 global，重置模块，返回被测模块。 */
async function loadModule(hasWindow: boolean): Promise<EC> {
  calls.length = 0
  stubRandomSeed = 0

  // --- window polyfill ---
  // 在 Node.js 下写 globalThis.window 要先删再赋值，避免只读属性冲突
  try { delete (globalThis as any).window } catch { /* noop */ }
  if (hasWindow) {
    (globalThis as any).window = { location: { origin: 'https://app.example.com:8443' } }
  } else {
    (globalThis as any).window = undefined
  }

  // --- crypto polyfill（Node 20 有只读全局 crypto → 用 defineProperty 覆写）---
  try {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: buildCryptoStub(),
    })
  } catch {
    ;(globalThis as any).crypto = buildCryptoStub()
  }

  vi.resetModules() // 清 Vitest 模块缓存（重置模块级 cryptoKeyCache Map）
  return (await import('./localStorageCrypto')) as EC
}

describe('lib/localStorageCrypto', () => {
  afterEach(() => {
    // 恢复环境，防止污染其它 it / 其它套件
    try { delete (globalThis as any).window } catch { /* noop */ }
    vi.resetModules()
  })

  describe('generateIv()', () => {
    it('返回 12 字节 Uint8Array；调用 crypto.getRandomValues(12)', async () => {
      const { generateIv } = await loadModule(true)
      const iv = generateIv()
      expect(iv).toBeInstanceOf(Uint8Array)
      expect(iv.length).toBe(12)
      expect(calls).toContain('getRandomValues(12)')
    })
    it('多次调用 → 填充值不同（stubRandomSeed 递增）', async () => {
      const { generateIv } = await loadModule(true)
      const a = [...generateIv()]
      const b = [...generateIv()]
      expect(a).not.toEqual(b)
      expect(calls.filter(c => c.startsWith('getRandomValues')).length).toBe(2)
    })
  })

  describe('arrayBufferToBase64(buf)', () => {
    it('Uint8Array 分支（L99 真分支）', async () => {
      const { arrayBufferToBase64 } = await loadModule(true)
      const u8 = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]) // "Hello"
      expect(arrayBufferToBase64(u8)).toBe('SGVsbG8=')
    })
    it('ArrayBuffer 分支（L99 假分支 → new Uint8Array(buffer)）', async () => {
      const { arrayBufferToBase64 } = await loadModule(true)
      const u8 = new Uint8Array([0x57, 0x6f, 0x72, 0x6c, 0x64]) // "World"
      expect(arrayBufferToBase64(u8.buffer)).toBe('V29ybGQ=')
    })
    it('空 buffer → 空串', async () => {
      const { arrayBufferToBase64 } = await loadModule(true)
      expect(arrayBufferToBase64(new Uint8Array(0))).toBe('')
    })
  })

  describe('base64ToArrayBuffer(base64)', () => {
    it('"SGVsbG8=" → Uint8Array [72,101,108,108,111]', async () => {
      const { base64ToArrayBuffer } = await loadModule(true)
      const ab = base64ToArrayBuffer('SGVsbG8=')
      expect(ab).toBeInstanceOf(ArrayBuffer)
      expect([...new Uint8Array(ab)]).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f])
    })
    it('空串 → 0 字节 ArrayBuffer', async () => {
      const { base64ToArrayBuffer } = await loadModule(true)
      expect(base64ToArrayBuffer('').byteLength).toBe(0)
    })
  })

  describe('getOrCreateCryptoKey(namespace)', () => {
    it('window 存在 → keyMaterial = "ns:origin"，走一次 importKey+deriveKey', async () => {
      const { getOrCreateCryptoKey } = await loadModule(true)
      const k = await getOrCreateCryptoKey('users')
      expect(isDummyKey(k)).toBe(true)
      expect((k as DummyKey).ns).toBe('users')
      expect(calls.some(c => c.startsWith('subtle.importKey(raw, users:https://app.example.com:8443'))).toBe(true)
      expect(calls.some(c => c.startsWith('subtle.deriveKey(PBKDF2 it=100000, ns=users'))).toBe(true)
      expect(calls.filter(c => c.startsWith('subtle.importKey')).length).toBe(1)
      expect(calls.filter(c => c.startsWith('subtle.deriveKey')).length).toBe(1)
    })

    it('window 未定义（SSR / Node）→ origin fallback "app"', async () => {
      const { getOrCreateCryptoKey } = await loadModule(false)
      await getOrCreateCryptoKey('auth')
      expect(calls.some(c => c.startsWith('subtle.importKey(raw, auth:app'))).toBe(true)
    })

    it('相同 namespace 二次调用 → 缓存命中（不再调用 importKey/deriveKey）', async () => {
      const { getOrCreateCryptoKey } = await loadModule(true)
      const k1 = await getOrCreateCryptoKey('settings')
      calls.length = 0 // 清空调用记录
      const k2 = await getOrCreateCryptoKey('settings')
      expect(k1).toBe(k2) // 同一引用（Map 命中）
      expect(calls.some(c => c.startsWith('subtle.importKey'))).toBe(false)
      expect(calls.some(c => c.startsWith('subtle.deriveKey'))).toBe(false)
    })

    it('不同 namespace → 不共享缓存（各一次 import/derive）', async () => {
      const { getOrCreateCryptoKey } = await loadModule(true)
      await getOrCreateCryptoKey('A')
      await getOrCreateCryptoKey('B')
      expect(calls.filter(c => c.startsWith('subtle.importKey')).length).toBe(2)
      expect(calls.filter(c => c.startsWith('subtle.deriveKey')).length).toBe(2)
    })
  })

  describe('EncryptedPayload interface（类型结构占位）', () => {
    it('字段全部正确赋值', () => {
      const p: EncryptedPayload = {
        __encrypted: true,
        iv: 'iv-base64',
        data: 'data-base64',
        createdAt: 1_700_000_000_000,
        expiresAt: 0,
        version: 1,
      }
      expect(p.__encrypted).toBe(true)
      expect(p.expiresAt).toBe(0)
    })
  })
})
