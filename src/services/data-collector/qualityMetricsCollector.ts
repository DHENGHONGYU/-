/**
 * @fileoverview G-3: 数据传递质量监控指标收集器
 *
 * 收集各采集环节的质量指标，供监控面板消费：
 * - 采集成功率 (success / total)
 * - 数据完整率 (非空字段数 / 总字段数)
 * - 采集延迟分布
 * - 写入成功率
 * - 降级计数
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-023, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-BACK-026]
*/
import { getLogger } from '@/lib/logger'
import type { QuoteDataSourceId } from '@/types/modules/collection.types'

/** 采集质量指标覆盖的源：报价链源 + MCP 多维源（westock 通过 marketdata:westock 接入，见 MCP 化改造方案 §5.4） */
type DataSource = QuoteDataSourceId | 'westock' | 'tencentnews'

const logger = getLogger()

export interface QualityMetrics {
  /** 时间窗口起始 */
  since: number
  /** 采集总次数 */
  totalCollects: number
  /** 采集成功次数（含 mock） */
  successCollects: number
  /** mock 采集次数 */
  mockCollects: number
  /** mock 采集成功次数 */
  mockSuccesses: number
  /** 漏采集成功率（含 mock） */
  successRate: number
  /** 真实数据源采集成功率（排除 mock） */
  realSuccessRate: number
  /** 数据完整率（非空字段数/总字段数） */
  completeness: number
  /** 各数据源使用次数（报价链源 + MCP 多维源 westock）。动态递增，无需预置全量 key。 */
  sourceCounts: Partial<Record<DataSource, number>>
  /** 降级次数 */
  fallbackCount: number
  /** 写入成功次数 */
  writeSuccess: number
  /** 写入总次数 */
  writeTotal: number
  /** 写入成功率 */
  writeRate: number
  /** mock 写入次数 */
  mockWrites: number
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
      realSuccessRate: 0,
      mockCollects: 0,
      mockSuccesses: 0,
      completeness: 0,
      sourceCounts: {},
      fallbackCount: 0,
      writeSuccess: 0,
      writeTotal: 0,
      writeRate: 0,
      mockWrites: 0,
      avgLatency: 0,
      totalLatency: 0,
    }
  }

  /** 记录一次采集 */
  recordCollect(success: boolean, source: DataSource, latency: number, fallbackChain: DataSource[]): void {
    const isMock = source === 'mock'
    this.metrics.totalCollects++
    const successInc = success ? 1 : 0
    this.metrics.successCollects += successInc
    if (isMock) {
      this.metrics.mockCollects++
      this.metrics.mockSuccesses += successInc
    }
    this.metrics.sourceCounts[source] = (this.metrics.sourceCounts[source] || 0) + 1
    // Math.max 下溢保护：空 fallbackChain(主源直连)时不得产生 -1 负数（V9-TEST-UT-FALLBACK-001 F-08）
    this.metrics.fallbackCount += Math.max(0, fallbackChain.length - 1)
    this.metrics.totalLatency += latency
    this.metrics.avgLatency = Math.round(this.metrics.totalLatency / this.metrics.totalCollects)
    // 含 mock 的整体成功率
    this.metrics.successRate = Math.round((this.metrics.successCollects / this.metrics.totalCollects) * 100)
    // 真实数据源成功率：排除 mock，避免假绿灯
    const realTotal = this.metrics.totalCollects - this.metrics.mockCollects
    if (realTotal > 0) {
      const realSuccesses = this.metrics.successCollects - this.metrics.mockSuccesses
      this.metrics.realSuccessRate = Math.round((realSuccesses / realTotal) * 100)
    }
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
