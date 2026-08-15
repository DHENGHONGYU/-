/**
 * @fileoverview localStorage 加密辅助函数
 *
 * 从 localStorageManager.ts 拆分而来，职责：
 * - 提供 AES-GCM 加密所需的 CryptoKey 派生与缓存
 * - 提供 IV 生成、Base64 编解码工具
 * - 定义加密条目的存储结构 EncryptedPayload
 *
 * 设计原则：纯函数 + 模块级缓存，无状态副作用，可被 LocalStorageManager 安全调用。
 *
 * 安全策略（v0.9.16 STOR-001）：
 * - 使用 Web Crypto API (AES-GCM 256) 加密敏感字段
 * - 密钥派生自设备指纹（命名空间 + 浏览器 origin），防止跨站攻击
 * - PBKDF2 iterations=100000，符合 2026 年 OWASP 推荐
  * @doc [V9-DOC-FRONT-037]
*/

// ============================================================
// 类型定义
// ============================================================

/** 加密条目的存储结构 */
export interface EncryptedPayload {
  /** 标识为加密条目（区分明文旧版条目） */
  __encrypted: true
  /** Base64 编码的初始化向量 (12 bytes) */
  iv: string
  /** Base64 编码的密文 */
  data: string
  /** 创建时间戳 (ms) */
  createdAt: number
  /** 过期时间戳 (ms)，0 表示永不过期 */
  expiresAt: number
  /** 数据版本号 */
  version: number
}

// ============================================================
// 模块级缓存
// ============================================================

/** CryptoKey 缓存（按命名空间） */
const cryptoKeyCache = new Map<string, CryptoKey>()

// ============================================================
// 加密辅助函数
// ============================================================

/**
 * 获取或创建指定命名空间的 AES-GCM CryptoKey。
 *
 * 密钥派生策略：
 * - 使用 PBKDF2 从命名空间 + origin 派生 256 位 AES key
 * - salt 固定（应用级），增加跨域攻击难度
 * - iterations=100000，符合 2026 年 OWASP 推荐
 *
 * @param namespace 命名空间
 */
export async function getOrCreateCryptoKey(namespace: string): Promise<CryptoKey> {
  const cached = cryptoKeyCache.get(namespace)
  if (cached) return cached

  // 派生密钥的材料：命名空间 + 浏览器 origin
  const origin = typeof window !== 'undefined' ? window.location.origin : 'app'
  const keyMaterial = `${namespace}:${origin}`

  // 应用级 salt（不存储密钥，依赖 origin 隔离）
  const salt = new TextEncoder().encode('v9-local-storage-encryption-salt-v1')

  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keyMaterial) as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )

  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )

  cryptoKeyCache.set(namespace, aesKey)
  return aesKey
}

/** 生成 12 字节随机 IV（AES-GCM 推荐） */
export function generateIv(): Uint8Array<ArrayBuffer> {
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  return iv
}

/** ArrayBuffer → Base64 字符串 */
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const parts: string[] = new Array<string>(bytes.byteLength)
  for (let i = 0; i < bytes.byteLength; i++) {
    parts[i] = String.fromCharCode(bytes[i]!)
  }
  return btoa(parts.join(''))
}

/** Base64 字符串 → ArrayBuffer */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}
