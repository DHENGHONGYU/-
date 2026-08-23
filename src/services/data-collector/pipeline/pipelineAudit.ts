/**
 * @fileoverview pipelineAudit
 * @description collectionPipeline 拆分（2026-08-23 遗留问题整改 P3）：
 * 写入后数据质量断言（WAP Audit）与字段完整率统计上报。
 *
 * @module services/data-collector/pipeline/pipelineAudit
 */

import { getQualityMetrics } from '../qualityMetricsCollector'
import type { RealtimeQuote } from '../../fetcher/directDataAPI'
import type { KlineBar } from '@/data/types/types.marketData'

/**
 * 写入后数据质量断言（WAP 模式 Audit 阶段）。
 * 校验关键字段非空，防止"写入成功但数据无效"的假绿灯。
 *
 * @param storeName - 目标存储名（用于选择校验规则）
 * @param payload - 已写入的记录
 * @throws Error 如果关键字段缺失或为空
 */
export function auditRecord(storeName: string, payload: unknown): void {
  if (payload == null) {
    throw new Error(`[auditRecord] ${storeName}: payload 为 null/undefined`)
  }
  const record = payload as Record<string, unknown>

  // 按存储定义必填字段
  const requiredFields: Record<string, string[]> = {
    stocks: ['symbol'],
    dailyQuotes: ['symbol'],
    news: ['id'],
    sectorScores: ['id'],
    researchLogs: ['id'],
    traceRecords: ['traceId'],
    localDocs: ['id'],
    sectorCollectData: ['id', 'symbol'],
    dimensionCollectData: ['id', 'symbol'],
  }

  const required = requiredFields[storeName]
  if (!required) return // 无校验规则的存储跳过

  for (const field of required) {
    const value = record[field]
    if (value == null || (typeof value === 'string' && value.trim() === '')) {
      throw new Error(`[auditRecord] ${storeName}: 必填字段 "${field}" 为空`)
    }
  }
}

/**
 * 判断字段值是否"有效"（非 null/undefined/空串/NaN/Infinity）。
 * @param value 待检查字段值
 * @returns 有效返回 true
 */
export function isFieldPresent(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (typeof value === 'number') return Number.isFinite(value)
  return true
}

/** 行情完整率校验字段（RealtimeQuote 核心 9 字段，symbol 由上游强制覆盖故不计） */
const QUOTE_COMPLETENESS_FIELDS = ['name', 'price', 'change', 'changePercent', 'open', 'high', 'low', 'volume', 'amount'] as const

/** K 线单 bar 完整率校验字段（KlineBar 核心 7 字段，turnoverRate 可选不计） */
const KLINE_COMPLETENESS_FIELDS = ['date', 'open', 'high', 'low', 'close', 'volume', 'amount'] as const

/**
 * 统计行情数据字段完整率并上报 qualityMetricsCollector（P0：接通 recordCompleteness）。
 * @param quote 实时行情数据
 */
export function reportQuoteCompleteness(quote: RealtimeQuote): void {
  const nonNull = QUOTE_COMPLETENESS_FIELDS.filter((f) => isFieldPresent(quote[f])).length
  getQualityMetrics().recordCompleteness({ nonNull, total: QUOTE_COMPLETENESS_FIELDS.length })
}

/**
 * 统计 K 线数据字段完整率（跨 bar 聚合）并上报 qualityMetricsCollector（P0：接通 recordCompleteness）。
 * @param klines K 线数据数组
 */
export function reportKlineCompleteness(klines: KlineBar[]): void {
  if (klines.length === 0) return
  let nonNull = 0
  for (const bar of klines) {
    nonNull += KLINE_COMPLETENESS_FIELDS.filter((f) => isFieldPresent(bar[f])).length
  }
  getQualityMetrics().recordCompleteness({ nonNull, total: klines.length * KLINE_COMPLETENESS_FIELDS.length })
}
