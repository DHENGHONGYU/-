/**
 * @fileoverview G-3: 数据传递质量监控指标收集器
 *
 * 收集各采集环节的质量指标，供监控面板消费：
 * - 采集成功率 (success / total)
 * - 数据完整率 (非空字段数 / 总字段数)
 * - 采集延迟分布
 * - 写入成功率
 * - 降级计数
 */
import { getLogger } from '@/lib/logger'
import type { QuoteDataSourceId } from '@/types/modules/collection.types'

type DataSource = QuoteDataSourceId

const logger = getLogger()

export interface QualityMetrics {
  /** 时间窗口起始 */
  since: number
  /** 采集总次数 */
  totalCollects: number
  /** 采集成功次数 */
  successCollects: number
  /** 采集成功率 */
  successRate: number
  /** 数据完整率（非空字段数/总字段数） */
  completeness: number
  /** 各数据源使用次数 */
  sourceCounts: Record<DataSource, number>
  /** 降级次数 */
  fallbackCount: number
  /** 写入成功次数 */
  writeSuccess: number
  /** 写入总次数 */
  writeTotal: number
  /** 写入成功率 */
  writeRate: number
  /** 平均延迟 (ms) */
  avgLatency: number
  /** 总延迟 (ms) */
  totalLatency: number
  /** 最后一次错误 */
  lastError?: string
}

interface QuoteFieldCheck {
  nonNull: number
  total: number
}

class QualityMetricsCollector {
  private metrics: QualityMetrics

  constructor() {
    this.metrics = this.createEmpty()
  }

  private createEmpty(): QualityMetrics {
    return {
      since: Date.now(),
      totalCollects: 0,
      successCollects: 0,
      successRate: 0,
      completeness: 0,
      sourceCounts: { tencent: 0, sina: 0, netease: 0, akshare: 0, mock: 0 },
      fallbackCount: 0,
      writeSuccess: 0,
      writeTotal: 0,
      writeRate: 0,
      avgLatency: 0,
      totalLatency: 0,
    }
  }

  /** 记录一次采集 */
  recordCollect(success: boolean, source: DataSource, latency: number, fallbackChain: DataSource[]): void {
    this.metrics.totalCollects++
    if (success) {
      this.metrics.successCollects++
    }
    this.metrics.sourceCounts[source] = (this.metrics.sourceCounts[source] || 0) + 1
    this.metrics.fallbackCount += fallbackChain.length - 1
    this.metrics.totalLatency += latency
    this.metrics.avgLatency = Math.round(this.metrics.totalLatency / this.metrics.totalCollects)
    this.metrics.successRate = Math.round((this.metrics.successCollects / this.metrics.totalCollects) * 100)
  }

  /** 记录字段完整性 */
  recordCompleteness(fields: QuoteFieldCheck): void {
    const ratio = fields.total > 0 ? fields.nonNull / fields.total : 0
    // 滚动平均
    this.metrics.completeness = Math.round(
      (this.metrics.completeness * (this.metrics.totalCollects - 1) + ratio * 100) /
        Math.max(1, this.metrics.totalCollects)
    )
  }

  /** 记录一次写入 */
  recordWrite(success: boolean): void {
    this.metrics.writeTotal++
    if (success) this.metrics.writeSuccess++
    this.metrics.writeRate = Math.round((this.metrics.writeSuccess / this.metrics.writeTotal) * 100)
  }

  /** 记录错误 */
  recordError(error: string): void {
    this.metrics.lastError = error
    logger.error(`[QualityMetrics] 采集错误: ${error}`)
  }

  /** 获取快照 */
  snapshot(): Readonly<QualityMetrics> {
    return { ...this.metrics }
  }

  /** 重置 */
  reset(): void {
    this.metrics = this.createEmpty()
    logger.info('[QualityMetrics] 指标已重置')
  }

  /** 生成告警报告 */
  checkAlerts(): string[] {
    const alerts: string[] = []
    if (this.metrics.successRate < 80 && this.metrics.totalCollects > 0) {
      alerts.push(`采集成功率 ${this.metrics.successRate}% < 80% 阈值`)
    }
    if (this.metrics.completeness < 90 && this.metrics.totalCollects > 0) {
      alerts.push(`数据完整率 ${this.metrics.completeness}% < 90% 阈值`)
    }
    if (this.metrics.writeRate < 95 && this.metrics.writeTotal > 0) {
      alerts.push(`写入成功率 ${this.metrics.writeRate}% < 95% 阈值`)
    }
    return alerts
  }
}

/** 全局单例 */
let _instance: QualityMetricsCollector | null = null

/**
 * getQualityMetrics
 * @returns QualityMetricsCollector
 */
export function getQualityMetrics(): QualityMetricsCollector {
  _instance ??= new QualityMetricsCollector()
  return _instance
}

/** 便捷读取快照 */
export function getQualitySnapshot(): Readonly<QualityMetrics> {
  return getQualityMetrics().snapshot()
}

/** 便捷告警检查 */
export function checkQualityAlerts(): string[] {
  return getQualityMetrics().checkAlerts()
}
