/**
 * @module DataBridgeAdapter
 * @lifecycle @Global
 * @description DataBridge 扩展适配层，提供面向模块的便捷数据访问接口
  * @doc [V9-DOC-BACK-010, V9-DOC-PROJ-003, V9-DOC-ARCH-008, V9-DOC-BACK-012, V9-DOC-PROJ-002]
*/

import { dataBridge } from './databridge'
import { EnvelopeFactory } from './envelope'
import { getLogger } from '@/lib/logger'
import { eventBus } from '@/lib/eventBus'
import type { StandardEnvelope } from './envelope'
import type { DataBridgeAdapterConfig, DataAction, BridgeQueryOptions, BridgeQueryResult } from '@/types/modules/databridge.types'

import { nanoid } from 'nanoid'
const logger = getLogger()

export type { DataBridgeAdapterConfig, DataAction, BridgeQueryOptions, BridgeQueryResult } from '@/types/modules/databridge.types'

// ============================================================
// 编程错误构造器集合 — fail-fast 策略
// ============================================================
const PROGRAMMING_ERROR_CONSTRUCTORS = new Set<unknown>([
  TypeError,
  SyntaxError,
  ReferenceError,
  RangeError,
  EvalError,
  URIError,
])

/**
 * 判断错误是否为编程错误（bug），应 fail-fast reject。
 * 操作错误（网络/超时等）则优雅降级 resolve success=false。
 *
 * 分支覆盖：
 * 1. 非对象（string/null/undefined）→ false（操作错误）
 * 2. Object.create(null)（无 constructor）→ false（操作错误）
 * 3. TypeError/SyntaxError 等（含子类）→ true（编程错误 fail-fast）
 * 4. 普通 Error → false（操作错误优雅降级）
 */
function isProgrammingError(err: unknown): boolean {
  // 分支 1：非对象错误（string/null/undefined）
  if ((err ?? null) === null || typeof err !== 'object') {
    logger.debug(`[DataBridgeAdapter] isProgrammingError: 非对象错误 → 操作错误(优雅降级), errorType=${typeof err}`)
    return false
  }

  // 分支 2：Object.create(null) 无 constructor 原型链
  const constructor = (err as object).constructor
  if (typeof constructor !== 'function') {
    logger.debug(`[DataBridgeAdapter] isProgrammingError: 无 constructor → 操作错误(优雅降级), error=${safeErrorMessage(err)}`)
    return false
  }

  // 分支 3：编程错误 — 先精确匹配构造器，再 instanceof 检查子类原型链
  if (PROGRAMMING_ERROR_CONSTRUCTORS.has(constructor) ||
      err instanceof TypeError || err instanceof SyntaxError ||
      err instanceof ReferenceError || err instanceof RangeError ||
      err instanceof EvalError || err instanceof URIError) {
    logger.debug(`[DataBridgeAdapter] isProgrammingError: 编程错误(fail-fast reject), constructor=${(constructor as { name?: string }).name}`)
    return true
  }

  // 分支 4：普通 Error → 操作错误
  logger.debug(`[DataBridgeAdapter] isProgrammingError: 操作错误(优雅降级), constructor=${(constructor as { name?: string }).name}`)
  return false
}

/**
 * 安全提取错误消息，防止 null/undefined/非对象错误导致二次崩溃。
 */
function safeErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if ((err ?? null) === null) return 'Unknown error'
  const e = err as Record<string, unknown>
  if (typeof err === 'object' && 'message' in e && typeof e.message === 'string') {
    return e.message
  }
  // Object.create(null) 或无 toString 的对象
  try {
    if (typeof err === 'object') {
      return JSON.stringify(err)
    }
    // eslint-disable-next-line @typescript-eslint/no-base-to-string -- err is narrowed to non-object primitive at this point
    return String(err)
  } catch {
    return 'Unknown error'
  }
}

/**
 * DataBridge 适配器 — 封装对 dataBridge 的 query/forward 调用，
 * 提供待处理查询追踪、自动订阅管理等功能。
 */
export class DataBridgeAdapter {
  private bridge = dataBridge
  private config: DataBridgeAdapterConfig
  private pendingQueries = new Map<string, { resolve: (r: BridgeQueryResult) => void; reject: (e: Error) => void }>()
  private activeSubscriptions: Array<() => void> = []

  constructor(config: DataBridgeAdapterConfig = {}) {
    this.config = {
      enableFallbackQueue: true,
      defaultTimeout: 10000,
      ...config,
    }
    logger.info('[DataBridgeAdapter] Initialized')
  }

  async query<T = unknown>(
    action: DataAction,
    payload: Record<string, unknown> = {},
    options: BridgeQueryOptions = {},
  ): Promise<BridgeQueryResult<T>> {
    const traceId = `bridge-${nanoid(8)}`
    const timeout = options.timeout ?? this.config.defaultTimeout ?? 10000

    logger.info(`[DataBridgeAdapter] query() action="${action}", traceId="${traceId}"`)

    const envelope = EnvelopeFactory.create(
      {
        action: action as unknown as import('@/config/dbConfig').EnvelopeAction,
        source: 'system',
        target: 'db',
        traceId,
      },
      payload,
    )

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingQueries.delete(traceId)
        logger.warn(`[DataBridgeAdapter] Query timeout: action="${action}", traceId="${traceId}"`)
        resolve({
          success: false,
          error: `Query timeout after ${timeout}ms`,
          traceId,
        })
      }, timeout)

      this.pendingQueries.set(traceId, {
        resolve: (result: BridgeQueryResult<unknown>) => {
          clearTimeout(timer)
          this.pendingQueries.delete(traceId)
          logger.info(`[DataBridgeAdapter] query() completed: action="${action}", traceId="${traceId}", success=${result.success}`)
          resolve(result as BridgeQueryResult<T>)
        },
        reject: (err: Error) => {
          clearTimeout(timer)
          this.pendingQueries.delete(traceId)
          logger.error(`[DataBridgeAdapter] query() rejected: action="${action}", traceId="${traceId}"`, { error: err.message })
          reject(err)
        },
      })

      this.bridge
        .forward(envelope)
        .then(() => {
          logger.debug(`[DataBridgeAdapter] Query forwarded: traceId="${traceId}"`)
          const result: BridgeQueryResult<T> = {
            success: true,
            data: envelope.payload as T,
            traceId,
          }
          this.pendingQueries.get(traceId)?.resolve(result)
        })
        .catch((err: unknown) => {
          const errMsg = safeErrorMessage(err)
          logger.error(`[DataBridgeAdapter] Query failed: traceId="${traceId}", error="${errMsg}"`)

          if (isProgrammingError(err)) {
            // 编程错误 → fail-fast reject，让上层感知 bug
            const rejectErr = err instanceof Error ? err : new Error(errMsg)
            this.pendingQueries.get(traceId)?.reject(rejectErr)
            return
          }

          // 操作错误 → 优雅降级 resolve success=false
          const result: BridgeQueryResult<T> = {
            success: false,
            error: errMsg,
            traceId,
          }
          this.pendingQueries.get(traceId)?.resolve(result)
        })
    })
  }

  subscribe(channel: string, callback: (envelope: StandardEnvelope) => void): () => void {
    logger.debug(`[DataBridgeAdapter] subscribe() channel="${channel}"`)
    const unsubscribe = eventBus.on(channel, callback as (payload: unknown) => void)
    // 追踪活跃订阅，destroy 时统一清理
    this.activeSubscriptions.push(unsubscribe)
    return () => {
      unsubscribe()
      const idx = this.activeSubscriptions.indexOf(unsubscribe)
      if (idx !== -1) this.activeSubscriptions.splice(idx, 1)
    }
  }

  getStats() {
    return {
      pendingQueries: this.pendingQueries.size,
      activeSubscriptions: this.activeSubscriptions.length,
      enableFallbackQueue: this.config.enableFallbackQueue,
    }
  }

  /**
   * 清理所有活跃 EventBus 订阅，防止内存泄漏。
   */
  destroySubscriptions(): void {
    this.activeSubscriptions.forEach((unsub) => unsub())
    this.activeSubscriptions = []
    logger.info('[DataBridgeAdapter] All subscriptions cleaned up')
  }
}

// Singleton
let adapterInstance: DataBridgeAdapter | null = null

/**
 * 创建 DataBridgeAdapter 实例。
 * @param config 适配器配置
 * @returns DataBridgeAdapter 实例
 */
export function createDataBridgeAdapter(config?: DataBridgeAdapterConfig): DataBridgeAdapter {
  if (adapterInstance) return adapterInstance
  adapterInstance = new DataBridgeAdapter(config)
  return adapterInstance
}

/**
 * 获取当前 DataBridgeAdapter 实例（单例）。
 * @returns DataBridgeAdapter 实例或 undefined
 */
export function getDataBridgeAdapter(): DataBridgeAdapter {
  if (!adapterInstance) {
    throw new Error('DataBridgeAdapter not initialized. Call createDataBridgeAdapter() first.')
  }
  return adapterInstance
}

/**
 * 销毁 DataBridgeAdapter 实例并清理订阅。
 */
export function destroyDataBridgeAdapter(): void {
  if (adapterInstance) {
    adapterInstance.destroySubscriptions()
  }
  adapterInstance = null
  logger.info('[DataBridgeAdapter] Instance destroyed')
}
