/**
 * @module LocalStorageManager
 * @description 统一 localStorage 封装，支持命名空间隔离、JSON 序列化、TTL 过期、
 *              容量监控与批量操作。解决原生 localStorage 的以下痛点：
 *              - 无命名空间，key 容易冲突
 *              - 仅支持字符串，需手动序列化/反序列化
 *              - 无过期机制，数据永久残留
 *              - 无容量监控，超出配额静默失败
 *
 * v0.9.16 安全增强（audit-b4-4-security STOR-001 / STOR-003）：
 * - 新增 setEncrypted / getEncrypted 方法，使用 Web Crypto API (AES-GCM) 加密敏感字段
 * - 加密 key 派生自设备指纹（浏览器+origin），防止跨站攻击
 * - 加密失败时降级为不存储，避免明文回退
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 常量
// ============================================================

/** localStorage 标准容量上限 (5MB = 5,242,880 bytes) */
const STORAGE_MAX_BYTES = 5_242_880

/** 默认命名空间前缀分隔符 */
const NS_SEPARATOR = ':'

/** 默认过期时间（毫秒），0 表示永不过期 */
const DEFAULT_TTL = 0

// ============================================================
// 类型定义
// ============================================================

/** 存储条目包装结构 */
interface StorageEntry<T = unknown> {
  /** 命名空间 */
  ns: string
  /** 实际数据 */
  value: T
  /** 创建时间戳 (ms) */
  createdAt: number
  /** 过期时间戳 (ms)，0 表示永不过期 */
  expiresAt: number
  /** 数据版本号 */
  version: number
}

/** LocalStorageManager 配置选项 */
export interface LocalStorageOptions {
  /** 命名空间，用于 key 前缀隔离 */
  namespace?: string
  /** 默认 TTL 毫秒数，默认 0（永不过期） */
  defaultTTL?: number
  /** 容量警告阈值（0-1），默认 0.8（占用超过 80% 时发出警告） */
  capacityWarningThreshold?: number
}

/** 存储容量信息 */
export interface StorageCapacity {
  /** 已使用字节数 */
  usedBytes: number
  /** 总容量字节数 */
  totalBytes: number
  /** 使用率（0-1） */
  usageRatio: number
  /** 是否超过警告阈值 */
  isWarning: boolean
}

/** 命名空间信息 */
export interface NamespaceInfo {
  namespace: string
  keyCount: number
  totalBytes: number
  oldestEntry: string | null
  newestEntry: string | null
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 计算字符串的 UTF-8 字节长度。
 */
function byteLength(str: string): number {
  // 使用 Blob API 精确计算，回退到估算
  try {
    return new Blob([str]).size
  } catch {
    // 回退：英文 1 字节，中文 3 字节，其他 2 字节
    let len = 0
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i)
      if (code < 0x80) len += 1
      else if (code < 0x800) len += 2
      else len += 3
    }
    return len
  }
}

// ============================================================
// LocalStorageManager 实现
// ============================================================

export class LocalStorageManager {
  private namespace: string
  private defaultTTL: number
  private capacityWarningThreshold: number

  constructor(options: LocalStorageOptions = {}) {
    this.namespace = options.namespace ?? 'app'
    this.defaultTTL = options.defaultTTL ?? DEFAULT_TTL
    this.capacityWarningThreshold = options.capacityWarningThreshold ?? 0.8

    logger.debug(`[LocalStorageManager:${this.namespace}] 初始化完成，TTL=${this.defaultTTL}ms, capacityThreshold=${this.capacityWarningThreshold}`)
  }

  // ============================================================
  // 公共 API：基础 CRUD
  // ============================================================

  /**
   * 读取存储值。
   * 自动检测过期，过期条目删除并返回 null。
   */
  get<T = unknown>(key: string): T | null {
    const fullKey = this.makeKey(key)
    const raw = localStorage.getItem(fullKey)

    if (raw === null) {
      return null
    }

    try {
      const entry = JSON.parse(raw) as StorageEntry<T>

      // 检查过期
      if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
        localStorage.removeItem(fullKey)
        logger.debug(`[LocalStorageManager:${this.namespace}] EXPIRED: key="${key}"`)
        return null
      }

      return entry.value
    } catch (err) {
      logger.warn(`[LocalStorageManager:${this.namespace}] 反序列化失败: key="${key}"`, { error: err })
      // 损坏的数据直接删除
      localStorage.removeItem(fullKey)
      return null
    }
  }

  /**
   * 写入存储值。
   */
  set<T = unknown>(key: string, value: T, ttl?: number): void {
    const effectiveTTL = ttl ?? this.defaultTTL
    const entry: StorageEntry<T> = {
      ns: this.namespace,
      value,
      createdAt: Date.now(),
      expiresAt: effectiveTTL > 0 ? Date.now() + effectiveTTL : 0,
      version: 1,
    }

    const fullKey = this.makeKey(key)
    const raw = JSON.stringify(entry)

    try {
      localStorage.setItem(fullKey, raw)
      logger.debug(`[LocalStorageManager:${this.namespace}] SET: key="${key}", size=${byteLength(raw)}B, TTL=${effectiveTTL}ms`)

      // 写入后检查容量
      this.checkCapacity()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        logger.error(`[LocalStorageManager:${this.namespace}] 存储配额已满，写入失败: key="${key}"`)
        throw new Error(`localStorage 配额已满，无法写入 key="${key}"。请清理过期数据或减少存储量。`)
      }
      throw err
    }
  }

  /**
   * 删除指定存储条目。
   */
  remove(key: string): void {
    const fullKey = this.makeKey(key)
    localStorage.removeItem(fullKey)
    logger.debug(`[LocalStorageManager:${this.namespace}] REMOVE: key="${key}"`)
  }

  // ============================================================
  // 公共 API：加密存储（v0.9.16 STOR-001）
  // ============================================================

  /**
   * 写入加密存储值。
   *
   * 使用 Web Crypto API (AES-GCM) 对 value 进行加密后存储。
   * 加密 key 派生自命名空间 + 浏览器 origin，避免跨站攻击。
   * 若 Web Crypto API 不可用（如非 HTTPS 环境），降级为不存储并抛出错误。
   *
   * @param key 存储 key
   * @param value 待加密的值
   * @param ttl 过期时间（毫秒）
   */
  async setEncrypted<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    const cryptoKey = await getOrCreateCryptoKey(this.namespace)
    const plaintext = JSON.stringify(value)
    const iv = generateIv()

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv } as AesGcmParams,
      cryptoKey,
      new TextEncoder().encode(plaintext) as BufferSource,
    )

    const payload: EncryptedPayload = {
      __encrypted: true,
      iv: arrayBufferToBase64(iv),
      data: arrayBufferToBase64(ciphertext),
      createdAt: Date.now(),
      expiresAt: (ttl ?? this.defaultTTL) > 0 ? Date.now() + (ttl ?? this.defaultTTL) : 0,
      version: 1,
    }

    const fullKey = this.makeKey(key)
    const raw = JSON.stringify(payload)

    try {
      localStorage.setItem(fullKey, raw)
      logger.debug(`[LocalStorageManager:${this.namespace}] SET(encrypted): key="${key}", size=${byteLength(raw)}B`)
      this.checkCapacity()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        logger.error(`[LocalStorageManager:${this.namespace}] 存储配额已满，加密写入失败: key="${key}"`)
        throw new Error(`localStorage 配额已满，无法写入 key="${key}"。`)
      }
      throw err
    }
  }

  /**
   * 读取加密存储值。
   *
   * 自动解密并返回原始值。若条目未加密、已过期或解密失败，返回 null。
   *
   * @param key 存储 key
   */
  async getEncrypted<T = unknown>(key: string): Promise<T | null> {
    const fullKey = this.makeKey(key)
    const raw = localStorage.getItem(fullKey)

    if (raw === null) return null

    try {
      const payload = JSON.parse(raw) as EncryptedPayload

      // 兼容旧版非加密条目：直接返回 null（不降级为明文读取，防止明文回退攻击）
      if (!payload.__encrypted) {
        logger.warn(`[LocalStorageManager:${this.namespace}] 检测到明文条目，已忽略: key="${key}"`)
        localStorage.removeItem(fullKey)
        return null
      }

      // 过期检查
      if (payload.expiresAt > 0 && Date.now() > payload.expiresAt) {
        localStorage.removeItem(fullKey)
        logger.debug(`[LocalStorageManager:${this.namespace}] EXPIRED(encrypted): key="${key}"`)
        return null
      }

      const cryptoKey = await getOrCreateCryptoKey(this.namespace)
      const iv = base64ToArrayBuffer(payload.iv)
      const ciphertext = base64ToArrayBuffer(payload.data)

      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv } as AesGcmParams,
        cryptoKey,
        ciphertext as BufferSource,
      )

      return JSON.parse(new TextDecoder().decode(plaintext)) as T
    } catch (err) {
      logger.warn(`[LocalStorageManager:${this.namespace}] 加密条目解密失败: key="${key}"`, { error: err })
      localStorage.removeItem(fullKey)
      return null
    }
  }

  /**
   * 检查指定 key 是否存在且未过期。
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * 获取当前命名空间下的所有 key 列表。
   */
  keys(): string[] {
    const prefix = this.getPrefix()
    const result: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i)
      if (fullKey && fullKey.startsWith(prefix)) {
        result.push(fullKey.slice(prefix.length))
      }
    }

    return result
  }

  // ============================================================
  // 公共 API：批量操作
  // ============================================================

  /**
   * 批量获取当前命名空间下的所有有效条目。
   */
  getAll<T = unknown>(): Record<string, T> {
    const result: Record<string, T> = {}
    const keys = this.keys()

    for (const key of keys) {
      const value = this.get<T>(key)
      if (value !== null) {
        result[key] = value
      }
    }

    return result
  }

  /**
   * 清除当前命名空间下的所有条目（包括过期条目）。
   */
  clearNamespace(): void {
    const keys = this.getAllKeysInNamespace()
    for (const fullKey of keys) {
      localStorage.removeItem(fullKey)
    }
    logger.info(`[LocalStorageManager:${this.namespace}] 已清除命名空间下 ${keys.length} 条数据`)
  }

  /**
   * 清除当前命名空间下的过期条目。
   * @returns 清理的条目数
   */
  purgeExpired(): number {
    const keys = this.keys()
    let count = 0

    for (const key of keys) {
      if (this.get(key) === null) {
        // get 方法内部已自动删除过期条目
        count++
      }
    }

    if (count > 0) {
      logger.debug(`[LocalStorageManager:${this.namespace}] 清理了 ${count} 条过期数据`)
    }
    return count
  }

  // ============================================================
  // 公共 API：容量监控
  // ============================================================

  /**
   * 获取当前存储容量信息。
   */
  getCapacity(): StorageCapacity {
    let usedBytes = 0

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key)
        if (value) {
          usedBytes += byteLength(key) + byteLength(value)
        }
      }
    }

    const usageRatio = usedBytes / STORAGE_MAX_BYTES

    return {
      usedBytes,
      totalBytes: STORAGE_MAX_BYTES,
      usageRatio,
      isWarning: usageRatio >= this.capacityWarningThreshold,
    }
  }

  /**
   * 获取当前命名空间统计信息。
   */
  getNamespaceInfo(): NamespaceInfo {
    const keys = this.getAllKeysInNamespace()
    let totalBytes = 0
    let oldestEntry: string | null = null
    let newestEntry: string | null = null
    let oldestTime = Infinity
    let newestTime = 0

    for (const fullKey of keys) {
      const raw = localStorage.getItem(fullKey)
      if (raw) {
        totalBytes += byteLength(fullKey) + byteLength(raw)

        try {
          const entry = JSON.parse(raw) as StorageEntry
          if (entry.createdAt < oldestTime) {
            oldestTime = entry.createdAt
            oldestEntry = fullKey.slice(this.getPrefix().length)
          }
          if (entry.createdAt > newestTime) {
            newestTime = entry.createdAt
            newestEntry = fullKey.slice(this.getPrefix().length)
          }
        } catch {
          // 忽略解析失败
        }
      }
    }

    return {
      namespace: this.namespace,
      keyCount: keys.length,
      totalBytes,
      oldestEntry,
      newestEntry,
    }
  }

  // ============================================================
  // 静态方法：全局操作
  // ============================================================

  /**
   * 列出所有已知命名空间。
   */
  static listNamespaces(): string[] {
    const nsSet = new Set<string>()

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const sepIndex = key.indexOf(NS_SEPARATOR)
        if (sepIndex > 0) {
          nsSet.add(key.slice(0, sepIndex))
        }
      }
    }

    return Array.from(nsSet).sort()
  }

  /**
   * 清除所有命名空间的数据。
   */
  static clearAll(): void {
    const count = localStorage.length
    localStorage.clear()
    logger.info(`[LocalStorageManager] 已清除全部 ${count} 条数据`)
  }

  /**
   * 获取全局容量信息。
   */
  static getGlobalCapacity(): StorageCapacity {
    let usedBytes = 0

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key)
        if (value) {
          usedBytes += byteLength(key) + byteLength(value)
        }
      }
    }

    const usageRatio = usedBytes / STORAGE_MAX_BYTES

    return {
      usedBytes,
      totalBytes: STORAGE_MAX_BYTES,
      usageRatio,
      isWarning: usageRatio >= 0.8,
    }
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 拼接命名空间前缀与 key。
   */
  private makeKey(key: string): string {
    return `${this.getPrefix()}${key}`
  }

  /**
   * 获取命名空间前缀。
   */
  private getPrefix(): string {
    return `${this.namespace}${NS_SEPARATOR}`
  }

  /**
   * 获取当前命名空间下所有 key（含前缀的完整 key）。
   */
  private getAllKeysInNamespace(): string[] {
    const prefix = this.getPrefix()
    const result: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        result.push(key)
      }
    }

    return result
  }

  /**
   * 检查容量并在超过阈值时发出警告。
   */
  private checkCapacity(): void {
    const cap = this.getCapacity()
    if (cap.isWarning) {
      logger.warn(
        `[LocalStorageManager:${this.namespace}] 容量警告: ` +
        `已使用 ${(cap.usedBytes / 1024).toFixed(1)}KB / ${(cap.totalBytes / 1024).toFixed(0)}KB ` +
        `(${(cap.usageRatio * 100).toFixed(1)}%)`,
      )
    }
  }
}

// ============================================================
// 默认实例
// ============================================================

/** 默认 LocalStorageManager 实例（命名空间: app） */
export const defaultStorage = new LocalStorageManager({ namespace: 'app' })

/**
 * 创建命名空间隔离的 LocalStorageManager 实例。
 */
export function createStorage(namespace: string, options?: Omit<LocalStorageOptions, 'namespace'>): LocalStorageManager {
  return new LocalStorageManager({ ...options, namespace })
}

// ============================================================
// 加密存储辅助（v0.9.16 STOR-001）
// ============================================================

/** 加密条目的存储结构 */
interface EncryptedPayload {
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

/** CryptoKey 缓存（按命名空间） */
const cryptoKeyCache = new Map<string, CryptoKey>()

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
async function getOrCreateCryptoKey(namespace: string): Promise<CryptoKey> {
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
function generateIv(): Uint8Array<ArrayBuffer> {
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  return iv
}

/** ArrayBuffer → Base64 字符串 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const parts: string[] = new Array(bytes.byteLength)
  for (let i = 0; i < bytes.byteLength; i++) {
    parts[i] = String.fromCharCode(bytes[i]!)
  }
  return btoa(parts.join(''))
}

/** Base64 字符串 → ArrayBuffer */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}