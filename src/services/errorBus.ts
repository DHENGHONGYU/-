/**
 * @module services/errorBus
 * @description S-02：统一错误捕获与全局错误总线
 *
 * 提供 `captureError()`：将任意异常经 `toV9Error` 收敛为 `V9Error`，
 * 发布到全局 `eventBus`（事件名 `ERROR_CAPTURED_EVENT`），并输出结构化日志。
 *
 * 设计原则：
 * - 复用 `src/lib/errors` 的 `V9Error` 体系，不新建错误类。
 * - 仅依赖 lib 基础设施（eventBus / errors / logger），符合 AGENTS.md §一 分层白名单。
 * - UI 层（A-03 全局错误边界）可订阅 `ERROR_CAPTURED_EVENT` 做统一提示与上报。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/

import { V9Error, toV9Error } from '@/lib/errors'
import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 全局错误总线事件名 */
export const ERROR_CAPTURED_EVENT = 'v9:error:captured'

/** 错误来源上下文，用于日志与总线 payload 的结构化路由 */
export interface ErrorContext {
  /** 来源模块 / 服务名 */
  source?: string
  /** 操作描述 */
  operation?: string
  /** 附加结构化信息 */
  meta?: Record<string, unknown>
}

/** 错误总线 payload 形态 */
export interface ErrorCapturedPayload {
  error: V9Error
  context: ErrorContext
  timestamp: number
}

/**
 * 统一错误捕获。
 *
 * 行为：
 * 1. 经 `toV9Error` 将任意异常收敛为 `V9Error`（已是 V9Error 子类则原样保留）。
 * 2. 输出结构化错误日志（含 code / category / message）。
 * 3. 发布到全局错误总线，供 UI 层与监控系统订阅。
 *
 * @returns 收敛后的 `V9Error`，便于上层按 `error.code` / `error.category` 路由。
 */
export function captureError(err: unknown, context: ErrorContext = {}): V9Error {
  const v9 = toV9Error(err)
  const payload: ErrorCapturedPayload = { error: v9, context, timestamp: Date.now() }

  logger.error(
    `[ErrorBus] ${context.source ?? 'unknown'}/${context.operation ?? 'unknown'} failed`,
    {
      code: v9.code,
      category: v9.category,
      message: v9.message,
      ...context.meta,
    },
  )

  eventBus.emit(ERROR_CAPTURED_EVENT, payload)
  return v9
}

/**
 * 订阅全局错误总线。
 * 返回的取消函数须在使用方 cleanup 中调用（配对 unsubscribe）。
 */
export function onErrorCaptured(cb: (payload: ErrorCapturedPayload) => void): () => void {
  return eventBus.on(ERROR_CAPTURED_EVENT, cb as (p: unknown) => void)
}
