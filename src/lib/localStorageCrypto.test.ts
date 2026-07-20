import { describe, it, expect } from 'vitest'
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  generateIv,
  getOrCreateCryptoKey,
} from './localStorageCrypto'

describe('localStorageCrypto', () => {
  describe('arrayBufferToBase64 / base64ToArrayBuffer', () => {
    it('编解码往返一致', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 100, 200, 255])
      const base64 = arrayBufferToBase64(original)
      const decoded = new Uint8Array(base64ToArrayBuffer(base64))
      expect(decoded.length).toBe(original.length)
      for (let i = 0; i < original.length; i++) {
        expect(decoded[i]).toBe(original[i])
      }
    })

    it('空数组编解码', () => {
      const empty = new Uint8Array([])
      const base64 = arrayBufferToBase64(empty)
      const decoded = new Uint8Array(base64ToArrayBuffer(base64))
      expect(decoded.length).toBe(0)
    })

    it('ArrayBuffer 输入也能处理', () => {
      const buf = new Uint8Array([65, 66, 67]).buffer
      const base64 = arrayBufferToBase64(buf)
      expect(typeof base64).toBe('string')
      expect(base64.length).toBeGreaterThan(0)
    })

    it('典型字符串编解码', () => {
      // "Hello" 的 UTF-8 bytes
      const bytes = new TextEncoder().encode('Hello, World!')
      const base64 = arrayBufferToBase64(bytes)
      const decoded = new Uint8Array(base64ToArrayBuffer(base64))
      const str = new TextDecoder().decode(decoded)
      expect(str).toBe('Hello, World!')
    })
  })

  describe('generateIv()', () => {
    it('生成 12 字节 IV', () => {
      const iv = generateIv()
      expect(iv).toBeInstanceOf(Uint8Array)
      expect(iv.length).toBe(12)
    })

    it('两次生成结果不同', () => {
      const iv1 = generateIv()
      const iv2 = generateIv()
      let same = true
      for (let i = 0; i < 12; i++) {
        if (iv1[i] !== iv2[i]) {
          same = false
          break
        }
      }
      expect(same).toBe(false)
    })
  })

  describe('getOrCreateCryptoKey()', () => {
    it('返回 CryptoKey', async () => {
      const key = await getOrCreateCryptoKey('test-ns')
      expect(key).toBeDefined()
      expect(key.type).toBe('secret')
    })

    it('相同命名空间返回同一 key（缓存）', async () => {
      const key1 = await getOrCreateCryptoKey('cached-ns')
      const key2 = await getOrCreateCryptoKey('cached-ns')
      expect(key1).toBe(key2)
    })

    it('不同命名空间返回不同 key', async () => {
      const key1 = await getOrCreateCryptoKey('ns-a')
      const key2 = await getOrCreateCryptoKey('ns-b')
      expect(key1).not.toBe(key2)
    })

    it('生成的 key 可用于加密和解密', async () => {
      const key = await getOrCreateCryptoKey('crypto-test')
      const iv = generateIv()
      const plaintext = new TextEncoder().encode('secret data')
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        plaintext,
      )
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted,
      )
      
      const result = new TextDecoder().decode(decrypted)
      expect(result).toBe('secret data')
    })
  })
})
