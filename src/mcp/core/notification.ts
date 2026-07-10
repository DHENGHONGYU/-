/**
 * MCP Notification 订阅管理器
 *
 * @description
 * 实现 MCP 协议的通知订阅/分发机制。
 * 支持按 NotificationMethod 注册监听器，emit 时批量通知所有订阅者。
 * 每个监听器隔离执行，单个监听器异常不影响其他监听器。
 *
 * @module mcp/core/notification
 * @created 2026-07-04 - Phase 0 MCP 基础设施层建设
 */

import type { NotificationMethod, NotificationPayload } from '@/types/modules/mcp.types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 通知监听器函数类型 */
type NotificationListener = (payload: NotificationPayload) => void

/** 通知管理器 —— 单例模式 */
export class NotificationManager {
  /** 监听器注册表：method → Set<listener> */
  private listeners = new Map<NotificationMethod, Set<NotificationListener>>()

  /**
   * 订阅指定通知类型
   * @param method 通知方法名
   * @param listener 监听器回调
   * @returns 取消订阅函数
   */
  subscribe(method: NotificationMethod, listener: NotificationListener): () => void {
    if (!this.listeners.has(method)) {
      this.listeners.set(method, new Set())
    }
    this.listeners.get(method)!.add(listener)
    logger.info(`[NotificationManager] Subscribed to ${method}`)
    return () => {
      this.listeners.get(method)?.delete(listener)
      logger.info(`[NotificationManager] Unsubscribed from ${method}`)
    }
  }

  /**
   * 发送通知到所有订阅者
   * @param method 通知方法名
   * @param params 通知参数（可选）
   */
  emit(method: NotificationMethod, params?: Record<string, unknown>): void {
    const payload: NotificationPayload = { method, params }
    logger.info(`[NotificationManager] Emitting ${method}`, { params })
    const listeners = this.listeners.get(method)
    if (!listeners) return

    for (const listener of listeners) {
      this.notifyListener(listener, payload)
    }
  }

  private notifyListener(listener: NotificationListener, payload: NotificationPayload): void {
    try {
      listener(payload)
    } catch (error) {
      logger.error(`[NotificationManager] Listener error for ${payload.method}`, { error: String(error) })
    }
  }
}

/** 全局单例通知管理器 */
export const notificationManager = new NotificationManager()