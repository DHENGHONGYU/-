/**
 * @module llmSearchCache
 * @description LLM 搜索结果的简单 JSON 文件缓存。
 *
 * 缓存结构：{ key, data, cachedAt, ttlHours }
 * 缓存目录：G:/FinSightV9/cache/llm-search/
 * 缓存键：{symbol}_{dimension}_{YYYY-MM}.json
 */

import fs from 'node:fs'
import path from 'node:path'

const CACHE_DIR = 'G:/FinSightV9/cache/llm-search'

/** 缓存条目结构 */
interface CacheEntry<T> {
  key: string
  data: T
  cachedAt: string
  ttlHours: number
}

/**
 * 确保缓存目录存在（首次访问时自动创建）。
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
}

/**
 * 获取缓存文件的完整路径。
 */
function cacheFilePath(key: string): string {
  return path.join(CACHE_DIR, `${key}.json`)
}

/**
 * 检查缓存是否有效（存在且未过期）。
 * @param key - 缓存键
 * @param ttlHours - 有效期（小时）
 * @returns 缓存有效返回 true，否则 false
 */
export function check(key: string, ttlHours: number): boolean {
  try {
    ensureCacheDir()
    const filePath = cacheFilePath(key)
    if (!fs.existsSync(filePath)) return false

    const raw = fs.readFileSync(filePath, 'utf-8')
    const entry: CacheEntry<unknown> = JSON.parse(raw)

    const cachedAt = new Date(entry.cachedAt).getTime()
    if (Number.isNaN(cachedAt)) return false

    const now = Date.now()
    const elapsedHours = (now - cachedAt) / (1000 * 60 * 60)
    return elapsedHours < ttlHours
  } catch {
    return false
  }
}

/**
 * 读取缓存数据。
 * @param key - 缓存键
 * @returns 缓存数据，不存在或读取失败返回 null
 */
export function get<T>(key: string): T | null {
  try {
    ensureCacheDir()
    const filePath = cacheFilePath(key)
    if (!fs.existsSync(filePath)) return null

    const raw = fs.readFileSync(filePath, 'utf-8')
    const entry: CacheEntry<T> = JSON.parse(raw)
    return entry.data
  } catch {
    return null
  }
}

/**
 * 存储数据到缓存。
 * @param key - 缓存键
 * @param data - 要存储的数据
 * @param ttlHours - 有效期（小时）
 */
export function set<T>(key: string, data: T, ttlHours: number): void {
  try {
    ensureCacheDir()
    const entry: CacheEntry<T> = {
      key,
      data,
      cachedAt: new Date().toISOString(),
      ttlHours,
    }
    const filePath = cacheFilePath(key)
    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8')
  } catch {
    // 缓存写入失败不应影响主流程
  }
}
