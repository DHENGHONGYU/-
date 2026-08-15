/**
 * @module DataIntegrityGuard
 * @description 数据传输完整性守卫（P1 修复 R07：数据包丢失）
 *
 * 核心机制：
 * 1. 每次 DataBridge 发送带 traceId 和 sequenceNumber
 * 2. 接收端校验连续性，缺失则重试
 * 3. 统计发送/接收/重试次数
 *
 * traceId 格式：{source}-{timestamp}-{random}
 * 由发送方生成，接收方校验，确保每条数据可追溯
 *
 * @doc V9-DOC-QUALITY-007
 */

import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ── 类型定义 ──

/** 数据包追踪信息 */
export interface DataPacketTrace {
  /** 追踪 ID：{source}-{timestamp}-{random} */
  traceId: string
  /** 序列号：同一批次内的序号 */
  sequenceNumber: number
  /** 批次 ID */
  batchId: string
  /** 发送时间 */
  sentAt: number
  /** 数据维度 */
  dimension: string
  /** 股票代码 */
  symbol: string
}

/** 数据包信封 */
export interface DataPacketEnvelope {
  /** 追踪信息 */
  trace: DataPacketTrace
  /** 数据载荷 */
  payload: Record<string, unknown>
  /** 重试次数 */
  retryCount: number
}

/** 传输统计 */
export interface TransmissionStats {
  /** 发送总数 */
  sent: number
  /** 接收总数 */
  received: number
  /** 丢失数 */
  lost: number
  /** 重试总数 */
  retries: number
  /** 重试成功数 */
  retrySuccess: number
  /** 最近一次丢失的 traceId 列表 */
  missingTraces: string[]
  /** 最近一次传输时间 */
  lastTransmissionAt: number
}

/** 序列号追踪器 */
interface SequenceTracker {
  lastReceived: number
  gaps: number[]
  receivedSet: Set<number>
}

// ── 全局状态 ──

let stats: TransmissionStats = {
  sent: 0,
  received: 0,
  lost: 0,
  retries: 0,
  retrySuccess: 0,
  missingTraces: [],
  lastTransmissionAt: 0,
}

/** 维度 → 序列号追踪器 */
const sequenceTrackers = new Map<string, SequenceTracker>()

/** 待重试的数据包 */
const retryQueue: DataPacketEnvelope[] = []
const MAX_RETRY_QUEUE = 500

// ── 工具函数 ──

/**
 * 生成 traceId
 */
export function generateTraceId(source: string, symbol: string): string {
  const ts = Date.now()
  const rand = Math.random().toString(36).substring(2, 8)
  return `${source}-${ts}-${rand}-${symbol}`
}

/**
 * 生成批次 ID
 */
export function generateBatchId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
}

// ── 发送端 API ──

/**
 * 创建带追踪的数据包信封
 *
 * 使用方式：
 *   const envelope = createDataPacket('tencent', '000001.SZ', { close: 10.5, ... })
 *   await dataBridge.forward({ action: 'writeQuote', payload: envelope })
 */
export function createDataPacket(
  source: string,
  symbol: string,
  payload: Record<string, unknown>,
  batchId?: string,
): DataPacketEnvelope {
  const trace: DataPacketTrace = {
    traceId: generateTraceId(source, symbol),
    sequenceNumber: stats.sent + 1,
    batchId: batchId ?? generateBatchId(),
    sentAt: Date.now(),
    dimension: 'daily_quotes',
    symbol,
  }

  stats.sent++
  stats.lastTransmissionAt = Date.now()

  return {
    trace,
    payload: {
      ...payload,
      __trace: trace,
    },
    retryCount: 0,
  }
}

/**
 * 批量创建数据包
 */
export function createDataPackets(
  source: string,
  items: Array<{ symbol: string; payload: Record<string, unknown> }>,
): DataPacketEnvelope[] {
  const batchId = generateBatchId()
  return items.map((item) => createDataPacket(source, item.symbol, item.payload, batchId))
}

// ── 接收端 API ──

/**
 * 接收端校验数据包完整性
 *
 * 使用方式：
 *   const envelope = receivedData as DataPacketEnvelope
 *   const result = verifyDataPacket('daily_quotes', envelope)
 *   if (result.missing) {
 *     await requestRetry(envelope)
 *   }
 */
export function verifyDataPacket(
  dimension: string,
  envelope: DataPacketEnvelope,
): {
  valid: boolean
  missing: boolean
  gap: number[]
  isRetry: boolean
} {
  const { trace } = envelope
  stats.received++
  stats.lastTransmissionAt = Date.now()

  // 获取或创建序列号追踪器
  let tracker = sequenceTrackers.get(dimension)
  if (!tracker) {
    tracker = { lastReceived: 0, gaps: [], receivedSet: new Set() }
    sequenceTrackers.set(dimension, tracker)
  }

  const isRetry = tracker.receivedSet.has(trace.sequenceNumber)
  if (!isRetry) {
    tracker.receivedSet.add(trace.sequenceNumber)
  }

  // 检查序列号连续性
  if (tracker.lastReceived > 0 && trace.sequenceNumber > tracker.lastReceived + 1) {
    // 存在间隙
    for (let i = tracker.lastReceived + 1; i < trace.sequenceNumber; i++) {
      tracker.gaps.push(i)
    }
    stats.lost += trace.sequenceNumber - tracker.lastReceived - 1
    stats.missingTraces.push(trace.traceId)
    if (stats.missingTraces.length > 100) {
      stats.missingTraces = stats.missingTraces.slice(-50)
    }
    logger.warn(
      `[DataIntegrity] 序列号间隙: ${dimension} #${tracker.lastReceived} → #${trace.sequenceNumber}, 缺失 ${trace.sequenceNumber - tracker.lastReceived - 1} 条`,
    )
  }

  tracker.lastReceived = Math.max(tracker.lastReceived, trace.sequenceNumber)

  return {
    valid: true,
    missing: tracker.gaps.length > 0,
    gap: [...tracker.gaps],
    isRetry,
  }
}

// ── 重试机制 ──

/**
 * 将数据包加入重试队列
 */
export function enqueueRetry(envelope: DataPacketEnvelope): void {
  if (retryQueue.length >= MAX_RETRY_QUEUE) {
    retryQueue.shift()
  }
  envelope.retryCount++
  retryQueue.push(envelope)
  stats.retries++
}

/**
 * 获取重试队列
 */
export function getRetryQueue(): Readonly<DataPacketEnvelope[]> {
  return retryQueue
}

/**
 * 从重试队列中移除（重试成功）
 */
export function dequeueRetry(traceId: string): void {
  const idx = retryQueue.findIndex((e) => e.trace.traceId === traceId)
  if (idx >= 0) {
    retryQueue.splice(idx, 1)
    stats.retrySuccess++
    logger.info(`[DataIntegrity] 重试成功: ${traceId}`)
  }
}

/**
 * 清空重试队列
 */
export function clearRetryQueue(): void {
  retryQueue.length = 0
}

// ── 统计 API ──

/**
 * 获取传输统计
 */
export function getTransmissionStats(): Readonly<TransmissionStats> {
  return { ...stats }
}

/**
 * 获取序列号间隙
 */
export function getSequenceGaps(dimension: string): number[] {
  return sequenceTrackers.get(dimension)?.gaps ?? []
}

/**
 * 获取传输成功率
 */
export function getTransmissionSuccessRate(): number {
  if (stats.sent === 0) return 0
  return (stats.received / stats.sent)
}

/**
 * 重置统计
 */
export function resetTransmissionStats(): void {
  stats = {
    sent: 0,
    received: 0,
    lost: 0,
    retries: 0,
    retrySuccess: 0,
    missingTraces: [],
    lastTransmissionAt: 0,
  }
  sequenceTrackers.clear()
}

/**
 * 生成传输健康报告
 */
export function generateTransmissionReport(): string {
  const parts: string[] = [
    `发送: ${stats.sent} | 接收: ${stats.received}`,
    `丢失: ${stats.lost} (${stats.sent > 0 ? ((stats.lost / stats.sent) * 100).toFixed(2) : '0'}%)`,
    `接收率: ${(getTransmissionSuccessRate() * 100).toFixed(2)}%`,
  ]
  if (stats.retries > 0) {
    parts.push(`重试: ${stats.retries} (成功 ${stats.retrySuccess})`)
  }
  return parts.join(' | ')
}