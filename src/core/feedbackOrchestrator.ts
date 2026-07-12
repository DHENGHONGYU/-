/**
 * @fileoverview FeedbackOrchestrator - 数据链路回馈机制核心
 * 
 * 职责：
 * - 将分散的验证点整合为自动化反馈循环
 * - 检测评分数据不完整、证据不足、质量未达阈值
 * - 自动触发数据补充采集流程
 * - 在数据补充后重新运行评分
 * - 广播反馈事件通知各模块
 * 
 * 反馈触发条件：
 * 1. 评分数据完整度 < 80%（默认阈值）
 * 2. 某层评分缺乏证据支持（evidence 为空）
 * 3. 数据新鲜度违规（输出时间早于输入时间）
 * 4. 评分质量警告存在
 * 
 * 反馈循环流程：
 * 检测 → 评估 → 触发重采集 → 重评分 → 验证
 */

import { getLogger } from '@/lib/logger'
import { dataBridge } from './databridge'
import { MODULE_ID, ENVELOPE_ACTION, STORE_NAME } from '@/config/dbConfig'
import {
  checkV6ScoreFreshness,
} from './freshnessGuard'
import type { V6Score } from '@/data/types'
import type { Stock } from '@/data/types'
import type { V6ScoreService, FetcherService } from '@/types/modules/service.types'

const logger = getLogger()

let injectedServices: FeedbackServices | undefined

/**
 * 注入反馈编排器依赖的服务实例。
 * @param services 反馈服务集合
 */
export function setFeedbackServices(services: FeedbackServices): void {
  injectedServices = services
  logger.info('[FeedbackOrchestrator] 反馈服务已注入')
}

function getServices(): FeedbackServices {
  if (!injectedServices) {
    throw new Error('FeedbackServices 未注入，请在启动时调用 setFeedbackServices')
  }
  return injectedServices
}

export interface FeedbackIssue {
  type: 'incomplete_score' | 'insufficient_evidence' | 'stale_data' | 'quality_warning'
  severity: 'low' | 'medium' | 'high' | 'critical'
  symbol: string
  details: Record<string, unknown>
  timestamp: number
}

export interface FeedbackResult {
  success: boolean
  symbol: string
  issues: FeedbackIssue[]
  reScored: boolean
  reFetched: boolean
  message: string
}

export interface FeedbackConfig {
  completenessThreshold: number
  maxRetries: number
  retryDelayMs: number
  autoTrigger: boolean
}

const DEFAULT_CONFIG: FeedbackConfig = {
  completenessThreshold: 80,
  maxRetries: 3,
  retryDelayMs: 5000,
  autoTrigger: true,
}

/**
 * FeedbackOrchestrator
 */
export class FeedbackOrchestrator {
  private config: FeedbackConfig
  private processing = new Set<string>()

  constructor(config?: Partial<FeedbackConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    logger.info('[FeedbackOrchestrator] 初始化完成', { config: this.config })
  }

  async checkAndTrigger(symbol: string): Promise<FeedbackResult> {
    if (this.processing.has(symbol)) {
      logger.warn(`[FeedbackOrchestrator] ${symbol} 正在处理中，跳过`)
      return {
        success: false,
        symbol,
        issues: [],
        reScored: false,
        reFetched: false,
        message: '正在处理中',
      }
    }

    this.processing.add(symbol)
    logger.info(`[FeedbackOrchestrator] 开始检查: ${symbol}`)

    try {
      const issues = await this.detectIssues(symbol)

      if (issues.length === 0) {
        logger.info(`[FeedbackOrchestrator] ${symbol} 未检测到问题`)
        return {
          success: true,
          symbol,
          issues: [],
          reScored: false,
          reFetched: false,
          message: '数据质量检查通过',
        }
      }

      logger.warn(`[FeedbackOrchestrator] ${symbol} 检测到 ${issues.length} 个问题`, { issues })
      this.broadcastIssues(symbol, issues)

      if (!this.config.autoTrigger) {
        return {
          success: true,
          symbol,
          issues,
          reScored: false,
          reFetched: false,
          message: `检测到 ${issues.length} 个问题（未自动触发修复）`,
        }
      }

      return await this.executeFeedbackLoop(symbol, issues)
    } finally {
      this.processing.delete(symbol)
    }
  }

  async detectIssues(symbol: string): Promise<FeedbackIssue[]> {
    const issues: FeedbackIssue[] = []

    const scoreResult = await dataBridge.query<V6Score>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.v6Scores,
      key: symbol,
      source: MODULE_ID.system,
    })
    if (!scoreResult.success || !scoreResult.data) {
      issues.push({
        type: 'incomplete_score',
        severity: 'critical',
        symbol,
        details: { reason: 'V6评分不存在' },
        timestamp: Date.now(),
      })
      return issues
    }

    const score = scoreResult.data

    const services = getServices()
    const quality = services.getV6ScoreQuality(symbol, score.factors)
    if (quality.dataCompleteness < this.config.completenessThreshold) {
      issues.push({
        type: 'incomplete_score',
        severity: this.getCompletenessSeverity(quality.dataCompleteness),
        symbol,
        details: {
          dataCompleteness: quality.dataCompleteness,
          missingLayers: quality.missingLayers,
          totalLayers: quality.hasBasicData ? 11 : 0,
        },
        timestamp: Date.now(),
      })
    }

    const evidenceIssues = this.checkEvidenceSufficiency(score)
    issues.push(...evidenceIssues)

    const freshnessIssues = await this.checkDataFreshness(symbol, score)
    issues.push(...freshnessIssues)

    if (score.qualityWarning) {
      issues.push({
        type: 'quality_warning',
        severity: 'medium',
        symbol,
        details: { warning: score.qualityWarning },
        timestamp: Date.now(),
      })
    }

    return issues
  }

  private getCompletenessSeverity(completeness: number): FeedbackIssue['severity'] {
    if (completeness < 30) return 'critical'
    if (completeness < 50) return 'high'
    if (completeness < 70) return 'medium'
    return 'low'
  }

  private checkEvidenceSufficiency(score: V6Score): FeedbackIssue[] {
    const issues: FeedbackIssue[] = []

    if (!score.layerDetails) return issues

    for (const [layerId, detail] of Object.entries(score.layerDetails)) {
      if (!detail.summary || detail.summary.trim().length === 0) {
        issues.push({
          type: 'insufficient_evidence',
          severity: 'medium',
          symbol: score.symbol,
          details: {
            layerId,
            layerName: detail.summary,
            reason: '评分缺乏摘要说明',
          },
          timestamp: Date.now(),
        })
      }
    }

    return issues
  }

  private async checkDataFreshness(symbol: string, score: V6Score): Promise<FeedbackIssue[]> {
    const issues: FeedbackIssue[] = []

    const quotesResult = await dataBridge.query<{
      symbol: string
      latest: { date: string; open: number; high: number; low: number; close: number; volume: number; amount: number }
      history: unknown[]
      period: string
      adjust: string
      updatedAt: number
    }>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.dailyQuotes,
      key: symbol,
      source: MODULE_ID.system,
    })
    if (quotesResult.success && quotesResult.data) {
      const quotes = quotesResult.data
      const freshnessCheck = checkV6ScoreFreshness(score.calculatedAt, quotes.updatedAt)
      if (!freshnessCheck.valid) {
        issues.push({
          type: 'stale_data',
          severity: 'high',
          symbol,
          details: {
            output: freshnessCheck.output,
            input: freshnessCheck.input,
            outputTime: freshnessCheck.outputTime,
            inputTime: freshnessCheck.inputTime,
            reason: '评分计算时间早于行情更新时间',
          },
          timestamp: Date.now(),
        })
      }
    }

    return issues
  }

  private async executeFeedbackLoop(symbol: string, issues: FeedbackIssue[]): Promise<FeedbackResult> {
    let reFetched = false
    let reScored = false

    const fetchNeeded = issues.some(
      (i) => i.type === 'incomplete_score' || i.type === 'stale_data'
    )

    if (fetchNeeded) {
      logger.info(`[FeedbackOrchestrator] ${symbol} 需要重新采集数据`)
      const fetchResult = await this.triggerReCollection(symbol)
      reFetched = fetchResult
    }

    const scoreNeeded = issues.some(
      (i) => i.type === 'incomplete_score' || i.type === 'stale_data' || i.type === 'quality_warning'
    )

    if (scoreNeeded) {
      logger.info(`[FeedbackOrchestrator] ${symbol} 需要重新评分`)
      const scoreResult = await this.triggerReScore(symbol)
      reScored = scoreResult.success
    }

    const finalIssues = await this.detectIssues(symbol)
    const allResolved = finalIssues.length === 0

    logger.info(`[FeedbackOrchestrator] ${symbol} 反馈循环完成`, {
      reFetched,
      reScored,
      remainingIssues: finalIssues.length,
      allResolved,
    })

    return {
      success: allResolved,
      symbol,
      issues: finalIssues,
      reScored,
      reFetched,
      message: allResolved
        ? '所有问题已修复'
        : `仍有 ${finalIssues.length} 个问题未解决`,
    }
  }

  private async triggerReCollection(symbol: string): Promise<boolean> {
    logger.info(`[FeedbackOrchestrator] 开始重新采集: ${symbol}`)

    const services = getServices()
    const results = await Promise.allSettled([
      services.fetchStockBasic(symbol),
      services.fetchStockKline(symbol),
      services.fetchFinancial(symbol),
    ])

    const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
    const total = results.length

    logger.info(`[FeedbackOrchestrator] 重新采集完成: ${symbol}`, {
      successCount,
      total,
    })

    return successCount === total
  }

  private async triggerReScore(symbol: string): Promise<{ success: boolean; score?: V6Score }> {
    logger.info(`[FeedbackOrchestrator] 开始重新评分: ${symbol}`)

    const services = getServices()
    const result = await services.runV6Score(symbol)

    if (result.success && result.data) {
      logger.info(`[FeedbackOrchestrator] 重新评分成功: ${symbol}, score=${result.data.score}`)
      return { success: true, score: result.data }
    }

    logger.error(`[FeedbackOrchestrator] 重新评分失败: ${symbol}, error=${result.error}`)
    return { success: false }
  }

  private broadcastIssues(symbol: string, issues: FeedbackIssue[]): void {
    logger.info(`[FeedbackOrchestrator] 广播反馈事件: ${symbol}, issues=${issues.length}`)

    const envelope = {
      meta: {
        source: MODULE_ID.analyzer,
        target: 'event' as const,
        action: ENVELOPE_ACTION.feedbackIssuesDetected,
        traceId: `feedback-${symbol}-${Date.now()}`,
        timestamp: Date.now(),
      },
      payload: {
        symbol,
        issues,
        timestamp: Date.now(),
      },
    }

    try {
      dataBridge.broadcast(`event:feedback:${symbol}`, envelope)
      dataBridge.broadcast('event:feedback:*', envelope)
    } catch (err) {
      logger.error(`[FeedbackOrchestrator] 广播反馈事件失败`, { error: err })
    }
  }

  async checkAllStocks(): Promise<Record<string, FeedbackResult>> {
    logger.info('[FeedbackOrchestrator] 开始检查所有股票')

    const stocksResult = await dataBridge.query<Stock[]>({
      action: ENVELOPE_ACTION.queryList,
      store: STORE_NAME.stocks,
      source: MODULE_ID.system,
    })
    if (!stocksResult.success || !stocksResult.data) {
      logger.warn('[FeedbackOrchestrator] 批量检查失败: 无法获取股票列表', { error: stocksResult.error })
      return {}
    }
    const stocks = stocksResult.data
    const results: Record<string, FeedbackResult> = {}

    for (const stock of stocks) {
      const result = await this.checkAndTrigger(stock.symbol)
      results[stock.symbol] = result
    }

    const total = stocks.length
    const issuesFound = Object.values(results).filter((r) => r.issues.length > 0).length

    logger.info('[FeedbackOrchestrator] 批量检查完成', {
      total,
      issuesFound,
    })

    return results
  }
}

/**
 * feedbackOrchestrator
 */
export const feedbackOrchestrator = new FeedbackOrchestrator()

export type FeedbackServices = V6ScoreService & FetcherService

export interface FeedbackOrchestratorOptions {
  services?: FeedbackServices
}
