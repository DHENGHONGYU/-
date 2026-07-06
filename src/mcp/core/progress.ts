/**
 * @module mcp/core/progress
 * @description MCP Progress 追踪器 — 长时间运行任务的进度通知
 * @created 2026-07-04
 */

import type { ProgressNotification } from '@/types/modules/mcp.types'
import { notificationManager } from './notification'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

/** 单次进度追踪上下文 */
interface ProgressContext {
  token: string
  total: number
  current: number
  message?: string
  startedAt: number
}

/** Progress 追踪器 — 单例模式 */
export class ProgressTracker {
  private tracks = new Map<string, ProgressContext>()

  /** 开始追踪一个新任务 */
  start(token: string, total: number, message?: string): void {
    const ctx: ProgressContext = {
      token,
      total,
      current: 0,
      message,
      startedAt: Date.now(),
    }
    this.tracks.set(token, ctx)
    logger.info('[ProgressTracker] Task started', { token, total, message })
    this.emit(token, 0, total, message)
  }

  /** 更新进度 */
  update(token: string, current: number, message?: string): void {
    const ctx = this.tracks.get(token)
    if (!ctx) {
      logger.info('[ProgressTracker] Unknown token, ignoring update', { token })
      return
    }
    ctx.current = Math.min(current, ctx.total)
    if (message) ctx.message = message
    this.emit(token, ctx.current, ctx.total, ctx.message)
  }

  /** 增量更新进度（+n） */
  increment(token: string, delta: number, message?: string): void {
    const ctx = this.tracks.get(token)
    if (!ctx) return
    this.update(token, ctx.current + delta, message)
  }

  /** 完成任务 */
  complete(token: string, message?: string): void {
    const ctx = this.tracks.get(token)
    if (!ctx) return
    this.update(token, ctx.total, message ?? '完成')
    const duration = Date.now() - ctx.startedAt
    logger.info('[ProgressTracker] Task completed', { token, duration: `${duration}ms` })
    this.tracks.delete(token)
  }

  /** 获取进度 */
  getProgress(token: string): ProgressContext | undefined {
    return this.tracks.get(token)
  }

  /** 获取所有活跃追踪 */
  getAllActive(): ProgressContext[] {
    return Array.from(this.tracks.values())
  }

  /** 发送进度通知 */
  private emit(token: string, progress: number, total: number, message?: string): void {
    const notification: ProgressNotification = {
      progressToken: token,
      progress,
      total,
      message,
    }
    notificationManager.emit(
      'notifications/progress',
      notification as unknown as Record<string, unknown>,
    )
  }
}

export const progressTracker = new ProgressTracker()