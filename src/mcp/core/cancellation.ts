/**
 * @module mcp/core/cancellation
 * @description MCP Cancellation 管理器 — 任务取消与资源清理
 * @created 2026-07-04
  * @doc [V9-DOC-ARCH-008, V9-DOC-PROJ-002, V9-DOC-AI-007, V9-DOC-AI-005, V9-DOC-PROJ-003]
*/

import { notificationManager } from './notification'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 取消令牌 */
interface CancellationToken {
  requestId: string
  reason?: string
  createdAt: number
}

/** 取消监听器 */
type CancellationListener = (token: CancellationToken) => void

/** Cancellation 管理器 — 单例模式 */
export class CancellationManager {
  private controllers = new Map<string, AbortController>()
  private listeners = new Set<CancellationListener>()

  /** 注册 AbortController（与 requestId 绑定） */
  register(requestId: string, controller: AbortController): void {
    this.controllers.set(requestId, controller)
    logger.info('[CancellationManager] Registered', { requestId })
  }

  /** 注销 AbortController */
  unregister(requestId: string): void {
    this.controllers.delete(requestId)
    logger.info('[CancellationManager] Unregistered', { requestId })
  }

  /** 取消指定请求 */
  cancel(requestId: string, reason = 'Cancelled by user'): boolean {
    const controller = this.controllers.get(requestId)
    if (!controller) {
      logger.info('[CancellationManager] No controller found for request', { requestId })
      return false
    }

    controller.abort(reason)
    this.controllers.delete(requestId)

    const token: CancellationToken = {
      requestId,
      reason,
      createdAt: Date.now(),
    }

    logger.info('[CancellationManager] Cancelled', { requestId, reason })

    // 通知所有监听器
    for (const listener of this.listeners) {
      try {
        listener(token)
      } catch (error) {
        logger.error('[CancellationManager] Listener error', { requestId, error: String(error) })
      }
    }

    // 发送 MCP 协议通知
    notificationManager.emit('notifications/cancelled', {
      requestId,
      reason,
    })

    return true
  }

  /** 取消所有活跃请求 */
  cancelAll(reason = 'Mass cancellation'): void {
    const ids = Array.from(this.controllers.keys())
    logger.info('[CancellationManager] Cancelling all', { count: ids.length, reason })
    for (const id of ids) {
      this.cancel(id, reason)
    }
  }

  /** 订阅取消事件 */
  onCancel(listener: CancellationListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 获取活跃请求数 */
  getActiveCount(): number {
    return this.controllers.size
  }
}

export const cancellationManager = new CancellationManager()