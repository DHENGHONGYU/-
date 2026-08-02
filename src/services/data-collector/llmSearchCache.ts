/**
 * @module llmSearchCache
 * @description LLM 搜索结果的 JSON 缓存（Node 文件缓存 + 浏览器内存回退）。
 *
 * 缓存结构：{ key, data, cachedAt, ttlHours }
 * 缓存目录：<项目根>/cache/llm-search/（可用 LLM_SEARCH_CACHE_DIR 环境变量覆盖）
 * 缓存键：{symbol}_{dimension}_{YYYY-MM}.json
 *
 * 环境策略（S4 浏览器兼容）：
 * - Node 环境：文件系统缓存（cache/llm-search/），跨进程持久。
 * - 浏览器环境：模块级内存 Map 回退（页面生命周期有效），避免 node:fs/process 触达。
 *   顶层不得引用 process/fs（模块加载即执行，浏览器会 ReferenceError），故 CACHE_DIR 懒计算。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-027, V9-DOC-BACK-023, V9-DOC-BACK-021, V9-DOC-BACK-033]
*/

import fs from 'node:fs'
import path from 'node:path'

/** Node 环境检测：仅 Node 有 process.versions.node（typeof 守卫避免浏览器 ReferenceError） */
const isNodeEnv = typeof process !== 'undefined' && typeof process.versions?.node === 'string'

/** 浏览器回退：模块级内存缓存（页面生命周期内有效，不持久化） */
const memCache = new Map<string, CacheEntry<unknown>>()

/** 缓存条目结构 */
interface CacheEntry<T> {
  key: string
  data: T
  cachedAt: string
  ttlHours: number
}

/**
 * 解析缓存目录（懒计算：仅 Node 环境调用，浏览器分支不触达 process）。
 */
function resolveCacheDir(): string {
  const envDir = process.env.LLM_SEARCH_CACHE_DIR
  return envDir || path.join(process.cwd(), 'cache', 'llm-search')
}

/**
 * 确保缓存目录存在（首次访问时自动创建）。
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(resolveCacheDir())) {
    fs.mkdirSync(resolveCacheDir(), { recursive: true })
  }
}

/**
 * 获取缓存文件的完整路径。
 */
function cacheFilePath(key: string): string {
  return path.join(resolveCacheDir(), `${key}.json`)
}

/** 内存回退：校验缓存有效性（ttl 内返回 true） */
function memCheck(key: string, ttlHours: number): boolean {
  const entry = memCache.get(key)
  if (!entry) return false
  const cachedAt = new Date(entry.cachedAt).getTime()
  if (Number.isNaN(cachedAt)) return false
  const elapsedHours = (Date.now() - cachedAt) / (1000 * 60 * 60)
  return elapsedHours < ttlHours
}

/**
 * 检查缓存是否有效（存在且未过期）。
 * @param key - 缓存键
 * @param ttlHours - 有效期（小时）
 * @returns 缓存有效返回 true，否则 false
 */
export function check(key: string, ttlHours: number): boolean {
  if (!isNodeEnv) return memCheck(key, ttlHours)
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
  if (!isNodeEnv) {
    const entry = memCache.get(key) as CacheEntry<T> | undefined
    return entry ? entry.data : null
  }
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
  const entry: CacheEntry<T> = {
    key,
    data,
    cachedAt: new Date().toISOString(),
    ttlHours,
  }
  if (!isNodeEnv) {
    memCache.set(key, entry as CacheEntry<unknown>)
    return
  }
  try {
    ensureCacheDir()
    const filePath = cacheFilePath(key)
    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8')
  } catch {
    // 缓存写入失败不应影响主流程
  }
}
