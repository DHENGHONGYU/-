/**
 * @module services/useCase/generateTradeReview.useCase
 * @description AI 交易复盘报告生成用例
 *
 * 将原先 trading/tradeReviewAI 中的长流程（错误分类、五维规则生成、LLM 洞察）
 * 抽取为独立 UseCase，减少 tradeReviewAI.ts 的职责。
 */

import { getLogger } from '@/lib/logger'
import type { Order } from '@/data/types'
import { isLlmConfigured } from '@/config/llmConfig'
import { chat } from '@/services/llm/llmGateway'
import { checkReviewFreshness } from '@/core/freshnessGuard'
import { classifyErrors } from '@/services/trading/tradeErrorClassifier'
import {
  generateTradeSummary,
  generateErrorAnalysis,
  generateDisciplineAnalysis,
  generateActionPlan,
  generateAIDeepInsight,
} from '@/services/trading/tradeReviewAI.reportGenerator'
import { generateSkillDevelopment } from '@/services/trading/tradeReviewAI.skillDevelopment'
import {
  buildAIDeepInsightPrompt,
  parseAIDeepInsightFromLlm,
} from '@/services/trading/tradeReviewAI.llmEnhancer'
import type { TradeReviewReport, TradeReviewOptions } from '@/services/trading/tradeReviewAI.types'

const logger = getLogger()

function getLatestOrderCreatedAt(orders: Order[]): number {
  if (orders.length === 0) return 0
  return Math.max(...orders.map((o) => o.createdAt))
}

/**
 * 生成同步版交易复盘报告（无 LLM 增强）
 */
export function generateTradeReviewUseCase(orders: Order[], now = Date.now()): TradeReviewReport {
  logger.info(`[GenerateTradeReviewUseCase] 开始生成复盘报告: 订单数=${orders.length}`)

  const latestOrderCreatedAt = getLatestOrderCreatedAt(orders)
  const freshness = checkReviewFreshness(now, latestOrderCreatedAt)
  logger.info(`[GenerateTradeReviewUseCase] review freshness check`, {
    valid: freshness.valid,
    outputTime: freshness.outputTime,
    inputTime: freshness.inputTime,
  })

  const classification = classifyErrors(orders)
  const summary = generateTradeSummary(orders, classification)
  const errorAnalysis = generateErrorAnalysis(classification, orders)
  const disciplineAnalysis = generateDisciplineAnalysis(orders, classification)
  const skillDevelopment = generateSkillDevelopment(classification, orders)
  const actionPlan = generateActionPlan(classification, disciplineAnalysis)
  const aiInsight = generateAIDeepInsight(summary, errorAnalysis, disciplineAnalysis)

  logger.info(
    `[GenerateTradeReviewUseCase] 复盘报告生成完成: 纪律评分=${summary.disciplineScore}, ` +
      `胜率=${summary.winRate}%, 盈亏比=${summary.profitLossRatio}`,
  )

  return {
    generatedAt: now,
    summary,
    errorAnalysis,
    disciplineAnalysis,
    skillDevelopment,
    actionPlan,
    aiInsight,
  }
}

/**
 * 生成异步交易复盘报告（支持 LLM 增强）
 */
export async function generateTradeReviewAsyncUseCase(
  orders: Order[],
  options?: TradeReviewOptions,
): Promise<TradeReviewReport> {
  const { llmConfig: llmOverride, onProgress, now: nowOption } = options ?? {}
  const now = nowOption ?? Date.now()

  logger.info(`[GenerateTradeReviewAsyncUseCase] 开始生成异步复盘报告: 订单数=${orders.length}`)

  try {
    const latestOrderCreatedAt = getLatestOrderCreatedAt(orders)
    const freshness = checkReviewFreshness(now, latestOrderCreatedAt)
    logger.info(`[GenerateTradeReviewAsyncUseCase] async review freshness check`, {
      valid: freshness.valid,
      outputTime: freshness.outputTime,
      inputTime: freshness.inputTime,
    })

    const classification = classifyErrors(orders)
    const summary = generateTradeSummary(orders, classification)
    const errorAnalysis = generateErrorAnalysis(classification, orders)
    const disciplineAnalysis = generateDisciplineAnalysis(orders, classification)
    const skillDevelopment = generateSkillDevelopment(classification, orders)
    const actionPlan = generateActionPlan(classification, disciplineAnalysis)

    let aiInsight: TradeReviewReport['aiInsight']
    let usedLlm = false

    if (llmOverride) {
      const defaults = { baseURL: '', apiKey: '', model: '', ...llmOverride }
      if (isLlmConfigured(defaults)) {
        try {
          onProgress?.('llm', '调用 LLM 生成深度洞察...')
          logger.info('[GenerateTradeReviewAsyncUseCase] 使用 LLM 生成 AI 深度洞察')

          const messages = buildAIDeepInsightPrompt(summary, errorAnalysis, disciplineAnalysis)
          const response = await chat(messages, { ...llmOverride })
          logger.info(`[GenerateTradeReviewAsyncUseCase] LLM 洞察返回: model=${response.model}, tokens=${response.usage?.totalTokens ?? 'unknown'}`)

          const llmInsight = parseAIDeepInsightFromLlm(response.content)
          if (llmInsight.pnlAttribution.length > 0 || llmInsight.personalizedAdvice.length > 0) {
            aiInsight = llmInsight
            usedLlm = true
          } else {
            logger.warn('[GenerateTradeReviewAsyncUseCase] LLM 返回空洞察，降级为规则模板')
            aiInsight = generateAIDeepInsight(summary, errorAnalysis, disciplineAnalysis)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          logger.warn(`[GenerateTradeReviewAsyncUseCase] LLM 洞察失败，降级为规则模板: ${msg}`)
          onProgress?.('llm', `LLM 洞察失败: ${msg}`)
          aiInsight = generateAIDeepInsight(summary, errorAnalysis, disciplineAnalysis)
        }
      } else {
        aiInsight = generateAIDeepInsight(summary, errorAnalysis, disciplineAnalysis)
      }
    } else {
      aiInsight = generateAIDeepInsight(summary, errorAnalysis, disciplineAnalysis)
    }

    const report: TradeReviewReport = {
      generatedAt: now,
      summary,
      errorAnalysis,
      disciplineAnalysis,
      skillDevelopment,
      actionPlan,
      aiInsight,
      ...(usedLlm && { aiInsightSource: 'llm' as const }),
    }

    logger.info(
      `[GenerateTradeReviewAsyncUseCase] 异步复盘报告生成完成${usedLlm ? '（含LLM洞察）' : ''}: ` +
        `纪律评分=${summary.disciplineScore}, 胜率=${summary.winRate}%, 盈亏比=${summary.profitLossRatio}`,
    )

    return report
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[GenerateTradeReviewAsyncUseCase] 异步报告生成失败`, { error: message })
    throw err
  }
}
