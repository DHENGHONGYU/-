/**
 * 操作反馈闭环服务
 *
 * 提供统一的操作反馈机制，包括：
 * - 操作状态记录（成功/失败/进行中）
 * - 反馈消息推送（通过 eventBus）
 * - 操作历史查询
 * - 错误重试机制
 *
 * 变更记录：
 * - v1.0.0 (2026-06-27): 初始版本，实现基础反馈闭环
 */

import { eventBus } from '@/lib/eventBus'
import { getLogger } from '@/lib/logger'
import type { DataLayerResult } from '@/data/types'

const logger = getLogger()

/**
 * 反馈事件类型
 */
export type FeedbackEventType =
  | 'OPERATION_STARTED'
  | 'OPERATION_SUCCESS'
  | 'OPERATION_FAILED'
  | 'OPERATION_RETRY'
  | 'OPERATION_CANCELLED'

/**
 * 反馈级别
 */
export type FeedbackLevel = 'info' | 'success' | 'warning' | 'error'

/**
 * 反馈消息
 */
export interface FeedbackMessage {
  /** 操作 ID */
  operationId: string
  /** 操作类型 */
  operationType: string
  /** 操作目标 */
  target?: string
  /** 事件类型 */
  eventType: FeedbackEventType
  /** 反馈级别 */
  level: FeedbackLevel
  /** 消息内容 */
  message: string
  /** 时间戳 */
  timestamp: number
  /** 错误详情（失败时） */
  error?: string
  /** 重试次数 */
  retryCount?: number
  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 操作记录
 */
export interface OperationRecord {
  operationId: string
  operationType: string
  target?: string
  status: 'started' | 'success' | 'failed' | 'retrying' | 'cancelled'
  message: string
  startTime: number
  endTime?: number
  retryCount: number
  error?: string
  metadata?: Record<string, unknown>
}

/**
 * 反馈监听器
 */
export type FeedbackListener = (message: FeedbackMessage) => void

/**
 * 全局操作记录（内存存储）
 */
const operationRecords: Map<string, OperationRecord> = new Map()

/**
 * 反馈监听器集合
 */
const feedbackListeners: Set<FeedbackListener> = new Set()

/**
 * 生成操作 ID
 */
function generateOperationId(operationType: string): string {
  return `${operationType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * 发布反馈消息
 */
function publishFeedback(message: FeedbackMessage): void {
  // 通过 eventBus 发布
  eventBus.emit('FEEDBACK_MESSAGE', message)

  // 通知监听器
  feedbackListeners.forEach((listener) => {
    try {
      listener(message)
    } catch (err) {
      logger.error('[FeedbackService] 监听器回调失败', { error: err })
    }
  })

  logger.info('[FeedbackService] 反馈消息已发布', {
    operationId: message.operationId,
    eventType: message.eventType,
    level: message.level,
  })
}

/**
 * 开始操作
 */
export function startOperation(
  operationType: string,
  options?: {
    target?: string
    message?: string
    metadata?: Record<string, unknown>
  },
): string {
  const operationId = generateOperationId(operationType)
  const message = options?.message ?? `${operationType} 操作开始`

  const record: OperationRecord = {
    operationId,
    operationType,
    target: options?.target,
    status: 'started',
    message,
    startTime: Date.now(),
    retryCount: 0,
    metadata: options?.metadata,
  }

  operationRecords.set(operationId, record)

  publishFeedback({
    operationId,
    operationType,
    target: options?.target,
    eventType: 'OPERATION_STARTED',
    level: 'info',
    message,
    timestamp: Date.now(),
    metadata: options?.metadata,
  })

  return operationId
}

/**
 * 操作成功
 */
export function succeedOperation(
  operationId: string,
  options?: {
    message?: string
    metadata?: Record<string, unknown>
  },
): void {
  const record = operationRecords.get(operationId)
  if (!record) {
    logger.warn('[FeedbackService] 操作记录不存在', { operationId })
    return
  }

  const message = options?.message ?? `${record.operationType} 操作成功`

  record.status = 'success'
  record.endTime = Date.now()
  record.message = message
  record.metadata = { ...record.metadata, ...options?.metadata }

  publishFeedback({
    operationId,
    operationType: record.operationType,
    target: record.target,
    eventType: 'OPERATION_SUCCESS',
    level: 'success',
    message,
    timestamp: Date.now(),
    metadata: record.metadata,
  })
}

/**
 * 操作失败
 */
export function failOperation(
  operationId: string,
  error: string,
  options?: {
    message?: string
    metadata?: Record<string, unknown>
  },
): void {
  const record = operationRecords.get(operationId)
  if (!record) {
    logger.warn('[FeedbackService] 操作记录不存在', { operationId })
    return
  }

  const message = options?.message ?? `${record.operationType} 操作失败`

  record.status = 'failed'
  record.endTime = Date.now()
  record.error = error
  record.message = message
  record.metadata = { ...record.metadata, ...options?.metadata }

  publishFeedback({
    operationId,
    operationType: record.operationType,
    target: record.target,
    eventType: 'OPERATION_FAILED',
    level: 'error',
    message,
    timestamp: Date.now(),
    error,
    retryCount: record.retryCount,
    metadata: record.metadata,
  })
}

/**
 * 重试操作
 */
export function retryOperation(
  operationId: string,
  options?: {
    message?: string
    metadata?: Record<string, unknown>
  },
): void {
  const record = operationRecords.get(operationId)
  if (!record) {
    logger.warn('[FeedbackService] 操作记录不存在', { operationId })
    return
  }

  record.retryCount++
  record.status = 'retrying'
  const message = options?.message ?? `${record.operationType} 操作重试（第${record.retryCount}次）`

  publishFeedback({
    operationId,
    operationType: record.operationType,
    target: record.target,
    eventType: 'OPERATION_RETRY',
    level: 'warning',
    message,
    timestamp: Date.now(),
    retryCount: record.retryCount,
    metadata: { ...record.metadata, ...options?.metadata },
  })
}

/**
 * 取消操作
 */
export function cancelOperation(
  operationId: string,
  options?: {
    message?: string
    metadata?: Record<string, unknown>
  },
): void {
  const record = operationRecords.get(operationId)
  if (!record) {
    logger.warn('[FeedbackService] 操作记录不存在', { operationId })
    return
  }

  const message = options?.message ?? `${record.operationType} 操作已取消`

  record.status = 'cancelled'
  record.endTime = Date.now()
  record.message = message
  record.metadata = { ...record.metadata, ...options?.metadata }

  publishFeedback({
    operationId,
    operationType: record.operationType,
    target: record.target,
    eventType: 'OPERATION_CANCELLED',
    level: 'warning',
    message,
    timestamp: Date.now(),
    metadata: record.metadata,
  })
}

/**
 * 包装异步操作（自动反馈）
 */
export async function wrapOperation<T>(
  operationType: string,
  operation: () => Promise<DataLayerResult<T>>,
  options?: {
    target?: string
    startMessage?: string
    successMessage?: string
    failMessage?: string
    maxRetries?: number
    metadata?: Record<string, unknown>
  },
): Promise<DataLayerResult<T>> {
  const operationId = startOperation(operationType, {
    target: options?.target,
    message: options?.startMessage,
    metadata: options?.metadata,
  })

  const maxRetries = options?.maxRetries ?? 0

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const outcome = await attemptOperation(operationId, operation, {
      successMessage: options?.successMessage,
      failMessage: options?.failMessage,
      maxRetries,
      attempt,
    })
    if (outcome.done) return outcome.result
  }

  return { success: false, error: '重试次数耗尽' }
}

type AttemptOutcome<T> =
  | { done: true; result: DataLayerResult<T> }
  | { done: false }

/**
 * 统一处理失败/重试分支，避免 attemptOperation 内重复判断 `options.attempt < options.maxRetries`。
 */
function handleFailure<T>(
  operationId: string,
  options: {
    successMessage?: string
    failMessage?: string
    maxRetries: number
    attempt: number
  },
  error: string,
): AttemptOutcome<T> {
  if (options.attempt < options.maxRetries) {
    retryOperation(operationId, { message: `重试第 ${options.attempt + 1} 次` })
    return { done: false }
  }

  failOperation(operationId, error, {
    message: options.failMessage,
  })
  return { done: true, result: { success: false, error } }
}

/**
 * 单次尝试执行操作，返回结果或需要重试。
 */
async function attemptOperation<T>(
  operationId: string,
  operation: () => Promise<DataLayerResult<T>>,
  options: {
    successMessage?: string
    failMessage?: string
    maxRetries: number
    attempt: number
  },
): Promise<AttemptOutcome<T>> {
  try {
    const result = await operation()

    if (result.success) {
      succeedOperation(operationId, {
        message: options.successMessage,
        metadata: { result: result.data },
      })
      return { done: true, result }
    }

    return handleFailure(operationId, options, result.error ?? '操作失败')
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return handleFailure(operationId, options, error)
  }
}

/**
 * 添加反馈监听器
 */
export function addFeedbackListener(listener: FeedbackListener): () => void {
  feedbackListeners.add(listener)
  return () => feedbackListeners.delete(listener)
}

/**
 * 获取操作记录
 */
export function getOperationRecord(operationId: string): OperationRecord | undefined {
  return operationRecords.get(operationId)
}

/**
 * 获取所有操作记录
 */
export function getAllOperationRecords(): OperationRecord[] {
  return Array.from(operationRecords.values())
}

/**
 * 清除操作记录
 */
export function clearOperationRecords(): void {
  operationRecords.clear()
  logger.info('[FeedbackService] 操作记录已清除')
}