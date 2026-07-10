/**
 * 派生查询记忆化缓存工具（v2 带 VERBOSE 日志埋点）
 *
 * 用于缓存 Store 派生查询结果，避免每次渲染重算。
 * 三种缓存策略：
 *   1. memoizeByRef：基于输入引用的记忆化（适用于 Zustand 状态数组）
 *   2. memoizeByKey：基于参数 hash 的记忆化（适用于带参数派生）
 *   3. buildIndex：列表转 Map 索引（O(1) 查找替代 O(n) filter）
 *
 * v2 增强：memoizeByRef 添加 VERBOSE 日志埋点，记录缓存命中与失效
 *   启用方式：环境变量 AUDIT_VERBOSE=1 或 VERBOSE=1 或 window.__DEBUG_DERIVED__=true
 *   日志格式：[DerivedCache] hit/miss fnName inputRef=0x... resultRef=0x...
 *
 * @module lib/derivedCache
 * @since v2.2.0
 * @updated v2.3.0 添加 VERBOSE 日志埋点
 * @compliance AGENTS.md §一 lib 层依赖规则：仅依赖 core/ 和 config/
 */

// ═══════════════════════════════════════════════════════════════
// VERBOSE 模式开关
// ═══════════════════════════════════════════════════════════════

const VERBOSE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUDIT_VERBOSE === '1') ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VERBOSE === '1') ||
  (typeof globalThis !== 'undefined' && (globalThis as { __DEBUG_DERIVED__?: boolean }).__DEBUG_DERIVED__ === true)

/**
 * 缓存统计计数器（用于性能分析）
 */
interface CacheStats {
  hits: number
  misses: number
  totalCalls: number
}

const cacheStatsMap = new Map<string, CacheStats>()

/**
 * memoizeByRef 实例重置函数列表（用于测试隔离）
 * 每次创建 memoizeByRef 时注册一个 reset 函数，resetAllMemoCaches() 调用所有 reset
 */
const memoResetFns: Array<() => void> = []

/**
 * 获取或创建缓存统计计数器
 */
function getCacheStats(name: string): CacheStats {
  let stats = cacheStatsMap.get(name)
  if (!stats) {
    stats = { hits: 0, misses: 0, totalCalls: 0 }
    cacheStatsMap.set(name, stats)
  }
  return stats
}

/**
 * 获取对象引用的短哈希（用于日志展示）
 */
function refHash(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null'
  // 利用 Object.prototype.toString 获取内部属性
  const str = Object.prototype.toString.call(obj)
  // 取后 8 位作为短哈希
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return '0x' + (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * VERBOSE 日志输出
 */
function logVerbose(msg: string): void {
  if (VERBOSE) {
    console.log(`\x1b[36m[DerivedCache]\x1b[0m ${msg}`)
  }
}

/**
 * 重置所有缓存统计（用于测试）
 */
export function resetCacheStats(): void {
  cacheStatsMap.clear()
}

/**
 * 重置所有 memoizeByRef 实例的内部缓存（用于测试隔离）
 * 清除所有 memoizeByRef 的 lastInput/lastResult/hasCached 状态，
 * 确保下次调用必定 miss，从而保证测试间缓存状态隔离。
 */
export function resetAllMemoCaches(): void {
  for (const reset of memoResetFns) {
    reset()
  }
}

/**
 * 获取所有缓存统计快照（用于测试断言）
 */
export function getCacheStatsSnapshot(): Record<string, CacheStats> {
  const result: Record<string, CacheStats> = {}
  for (const [name, stats] of cacheStatsMap) {
    result[name] = { ...stats }
  }
  return result
}

// ═══════════════════════════════════════════════════════════════
// memoizeByRef：基于引用的记忆化（带 VERBOSE 日志埋点）
// ═══════════════════════════════════════════════════════════════

/**
 * 基于引用的记忆化函数
 *
 * 当输入引用未变时（Zustand 保证未修改时引用不变），直接返回缓存结果。
 * 适用于无参数或单参数派生查询。
 *
 * v2 增强：添加 VERBOSE 日志埋点
 *   - 命中时输出：[DerivedCache] hit <fnName> inputRef=0x... resultRef=0x...
 *   - 失效时输出：[DerivedCache] miss <fnName> inputRef=0x... (was 0x...) computing...
 *
 * @param fn 原始计算函数
 * @param name 函数名（用于日志标识，默认从 fn.name 推断）
 *
 * @example
 * const memoizedDistribution = memoizeByRef(
 *   (scores: V6Score[]) => scores.filter(s => s.total >= 80).length,
 *   'scoreLevelDistribution'
 * )
 * // scores 引用未变时，直接返回缓存结果
 */
export function memoizeByRef<TInput, TResult>(
  fn: (input: TInput) => TResult,
  name?: string,
): (input: TInput) => TResult {
  const fnName = name ?? fn.name ?? 'anonymous'
  let lastInput: TInput | undefined
  let lastResult: TResult | undefined
  let hasCached = false

  // 注册重置函数，供 resetAllMemoCaches() 调用（测试隔离用）
  memoResetFns.push(() => {
    lastInput = undefined
    lastResult = undefined
    hasCached = false
  })

  return (input: TInput): TResult => {
    const stats = getCacheStats(fnName)
    stats.totalCalls++

    if (hasCached && input === lastInput && lastResult !== undefined) {
      // 缓存命中
      stats.hits++
      logVerbose(
        `hit ${fnName} inputRef=${refHash(input)} resultRef=${refHash(lastResult)} ` +
        `(hits=${stats.hits}/${stats.totalCalls})`
      )
      return lastResult
    }

    // 缓存未命中（引用变化或首次调用）
    stats.misses++
    const wasRef = hasCached ? refHash(lastInput) : 'none'
    logVerbose(
      `miss ${fnName} inputRef=${refHash(input)} (was ${wasRef}) computing... ` +
      `(misses=${stats.misses}/${stats.totalCalls})`
    )

    lastInput = input
    lastResult = fn(input)
    hasCached = true

    logVerbose(`computed ${fnName} resultRef=${refHash(lastResult)}`)
    return lastResult
  }
}

// ═══════════════════════════════════════════════════════════════
// memoizeByKey：基于参数 hash 的记忆化
// ═══════════════════════════════════════════════════════════════

/**
 * 基于参数 hash 的记忆化函数
 *
 * 适用于带参数的派生查询，如 bySymbol(symbol)。
 * 注意：hash 基于 JSON.stringify，参数需可序列化。
 */
export function memoizeByKey<TResult>(
  fn: (...args: unknown[]) => TResult,
  name?: string,
): (...args: unknown[]) => TResult {
  const fnName = name ?? fn.name ?? 'anonymousByKey'
  const cache = new Map<string, TResult>()

  return (...args: unknown[]): TResult => {
    const stats = getCacheStats(fnName)
    stats.totalCalls++

    const key = JSON.stringify(args)
    const cached = cache.get(key)
    if (cached !== undefined) {
      stats.hits++
      logVerbose(`hit ${fnName} key=${key.slice(0, 50)} (hits=${stats.hits}/${stats.totalCalls})`)
      return cached
    }

    stats.misses++
    logVerbose(`miss ${fnName} key=${key.slice(0, 50)} computing... (misses=${stats.misses}/${stats.totalCalls})`)
    const result = fn(...args)
    cache.set(key, result)
    return result
  }
}

// ═══════════════════════════════════════════════════════════════
// buildIndex：列表转 Map 索引
// ═══════════════════════════════════════════════════════════════

/**
 * 列表转 Map 索引（按指定 key）
 * 用于高频字段查找优化，将 O(n) filter 降为 O(1) Map.get。
 */
export function buildIndex<T, K extends string | number>(
  list: readonly T[],
  keyFn: (item: T) => K,
): Map<K, T> {
  const map = new Map<K, T>()
  for (const item of list) {
    map.set(keyFn(item), item)
  }
  return map
}

/**
 * 列表转 Map 索引（按 key 分组，一对多）
 */
export function buildGroupIndex<T, K extends string | number>(
  list: readonly T[],
  keyFn: (item: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of list) {
    const key = keyFn(item)
    const group = map.get(key)
    if (group) {
      group.push(item)
    } else {
      map.set(key, [item])
    }
  }
  return map
}

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

/**
 * 安全访问数组长度（null/undefined 返回 0）
 */
export function safeLength<T>(arr: readonly T[] | null | undefined): number {
  return arr?.length ?? 0
}

/**
 * 安全除法（除数为 0 返回 0）
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return numerator / denominator
}

/**
 * 数组平均值（空数组返回 0）
 */
export function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  let sum = 0
  for (const v of values) {
    sum += v
  }
  return sum / values.length
}
