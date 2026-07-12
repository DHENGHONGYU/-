/**
 * @module MemoryCache
 * @description 独立内存缓存模块，支持 TTL（默认 10s）、LRU 淘汰（默认 200 条）、
 *              容量上限与自动过期清理。
 *
 * 使用场景：
 * - 高频访问的行情快照缓存
 * - 策略计算结果临时缓存
 * - API 响应去重缓存
 * - 跨组件共享的临时状态
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 类型定义
// ============================================================

/** 缓存条目元数据 */
interface CacheEntry<T> {
  value: T
  /** 创建时间戳 (ms) */
  createdAt: number
  /** TTL 毫秒数，0 表示永不过期 */
  ttl: number
  /** 最后访问时间戳 (ms)，用于 LRU 淘汰 */
  lastAccessedAt: number
  /** 访问次数（可选统计） */
  accessCount: number
}

/** MemoryCache 配置选项 */
export interface MemoryCacheOptions {
  /** TTL 毫秒数，默认 10000 (10s)，设为 0 表示永不过期 */
  defaultTTL?: number
  /** 最大条目数，默认 200，超出时按 LRU 淘汰 */
  maxSize?: number
  /** 清理间隔毫秒数，默认 30000 (30s)，设为 0 禁用自动清理 */
  cleanupInterval?: number
  /** 缓存命名空间，用于日志区分 */
  namespace?: string
}

/** 缓存统计信息 */
export interface CacheStats {
  size: number
  maxSize: number
  hitCount: number
  missCount: number
  evictionCount: number
  expiredCount: number
  /** 命中率 */
  hitRate: number
}

// ============================================================
// MemoryCache 实现
// ============================================================

/**
 * MemoryCache
 */
export class MemoryCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>()
  private options: Required<MemoryCacheOptions>
  private stats: Omit<CacheStats, 'hitRate' | 'size'>
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: MemoryCacheOptions = {}) {
    this.options = {
      defaultTTL: options.defaultTTL ?? 10_000,
      maxSize: options.maxSize ?? 200,
      cleanupInterval: options.cleanupInterval ?? 30_000,
      namespace: options.namespace ?? 'default',
    }

    this.stats = {
      maxSize: this.options.maxSize,
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
      expiredCount: 0,
    }

    if (this.options.cleanupInterval > 0) {
      this.startCleanup()
    }

    logger.debug(`[MemoryCache:${this.options.namespace}] 初始化完成，maxSize=${this.options.maxSize}, TTL=${this.options.defaultTTL}ms, cleanupInterval=${this.options.cleanupInterval}ms`)
  }

  // ============================================================
  // 公共 API
  // ============================================================

  /**
   * 获取缓存值。
   * 命中时自动刷新 LRU 访问时间并增加命中计数。
   * 过期条目自动删除并返回 undefined。
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key)

    if (!entry) {
      this.stats.missCount++
      logger.debug(`[MemoryCache:${this.options.namespace}] MISS: key="${key}"`)
      return undefined
    }

    if (this.isExpired(entry)) {
      this.store.delete(key)
      this.stats.expiredCount++
      this.stats.missCount++
      logger.debug(`[MemoryCache:${this.options.namespace}] EXPIRED: key="${key}"`)
      return undefined
    }

    // 更新 LRU 访问时间（使用 performance.now 保证亚毫秒精度）
    entry.lastAccessedAt = performance.now()
    entry.accessCount++
    this.stats.hitCount++

    logger.debug(`[MemoryCache:${this.options.namespace}] HIT: key="${key}"`)
    return entry.value
  }

  /**
   * 设置缓存值。
   * 若超出容量上限，自动淘汰最久未访问的条目。
   */
  set(key: string, value: T, ttl?: number): void {
    const effectiveTTL = ttl ?? this.options.defaultTTL

    // 如果 key 已存在，更新值并刷新时间
    if (this.store.has(key)) {
      const existing = this.store.get(key)!
      existing.value = value
      existing.createdAt = Date.now()
      existing.lastAccessedAt = performance.now()
      existing.ttl = effectiveTTL
      logger.debug(`[MemoryCache:${this.options.namespace}] UPDATE: key="${key}", TTL=${effectiveTTL}ms`)
      return
    }

    // 容量检查：超出上限则淘汰最旧的条目
    if (this.store.size >= this.options.maxSize) {
      this.evictLRU()
    }

    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      ttl: effectiveTTL,
      lastAccessedAt: performance.now(),
      accessCount: 0,
    }

    this.store.set(key, entry)
    logger.debug(`[MemoryCache:${this.options.namespace}] SET: key="${key}", TTL=${effectiveTTL}ms, size=${this.store.size}`)
  }

  /**
   * 删除指定缓存条目。
   */
  delete(key: string): boolean {
    const result = this.store.delete(key)
    if (result) {
      logger.debug(`[MemoryCache:${this.options.namespace}] DELETE: key="${key}"`)
    }
    return result
  }

  /**
   * 检查缓存条目是否存在且未过期。
   */
  has(key: string): boolean {
    const entry = this.store.get(key)
    if (!entry) return false
    if (this.isExpired(entry)) {
      this.store.delete(key)
      this.stats.expiredCount++
      return false
    }
    return true
  }

  /**
   * 清空全部缓存。
   */
  clear(): void {
    const count = this.store.size
    this.store.clear()
    logger.info(`[MemoryCache:${this.options.namespace}] CLEAR: 已清除 ${count} 条缓存`)
  }

  /**
   * 获取缓存统计信息。
   */
  getStats(): CacheStats {
    const total = this.stats.hitCount + this.stats.missCount
    return {
      ...this.stats,
      size: this.store.size,
      hitRate: total > 0 ? this.stats.hitCount / total : 0,
    }
  }

  /**
   * 重置统计计数。
   */
  resetStats(): void {
    this.stats.hitCount = 0
    this.stats.missCount = 0
    this.stats.evictionCount = 0
    this.stats.expiredCount = 0
    logger.debug(`[MemoryCache:${this.options.namespace}] 统计已重置`)
  }

  /**
   * 手动触发过期条目清理。
   * @returns 清理的条目数
   */
  purgeExpired(): number {
    const now = Date.now()
    let count = 0

    for (const [key, entry] of this.store.entries()) {
      if (this.isExpired(entry, now)) {
        this.store.delete(key)
        count++
      }
    }

    this.stats.expiredCount += count
    if (count > 0) {
      logger.debug(`[MemoryCache:${this.options.namespace}] 清理了 ${count} 条过期缓存`)
    }
    return count
  }

  /**
   * 获取当前缓存条目数。
   */
  get size(): number {
    return this.store.size
  }

  /**
   * 销毁缓存实例，停止自动清理定时器。
   */
  destroy(): void {
    this.stopCleanup()
    this.store.clear()
    logger.info(`[MemoryCache:${this.options.namespace}] 已销毁`)
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 判断缓存条目是否已过期。
   */
  private isExpired(entry: CacheEntry<T>, now: number = Date.now()): boolean {
    if (entry.ttl <= 0) return false // 永不过期
    return now - entry.createdAt > entry.ttl
  }

  /**
   * LRU 淘汰：删除最久未访问的条目。
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.store.entries()) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey)
      this.stats.evictionCount++
      logger.debug(`[MemoryCache:${this.options.namespace}] LRU EVICT: key="${oldestKey}", lastAccess=${new Date(oldestTime).toISOString()}`)
    }
  }

  /**
   * 启动自动清理定时器。
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const count = this.purgeExpired()
      if (count > 0) {
        logger.debug(`[MemoryCache:${this.options.namespace}] 自动清理完成，已清除 ${count} 条过期缓存`)
      }
    }, this.options.cleanupInterval)
  }

  /**
   * 停止自动清理定时器。
   */
  private stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }
}

// ============================================================
// 默认实例（单例）
// ============================================================

/** 默认全局内存缓存实例 */
export const defaultCache = new MemoryCache({ namespace: 'global' })

/**
 * 创建并返回一个命名空间隔离的 MemoryCache 实例。
 * 适合模块级使用，避免 key 冲突。
 */
export function createCache(namespace: string, options?: Omit<MemoryCacheOptions, 'namespace'>): MemoryCache {
  return new MemoryCache({ ...options, namespace })
}