/**
 * @fileoverview pipelineDataGen
 * @description collectionPipeline 拆分（2026-08-23 遗留问题整改 P3）：
 * 非行情维度真实数据获取（熔断前置 + 失败归属记录，MOCK 禁用）
 * 与 KIMI AI 增强（新闻摘要 / 研报解读）。
 *
 * @module services/data-collector/pipeline/pipelineDataGen
 */

import { getLogger } from '@/lib/logger'
import type { QuoteDataSourceId } from '@/types/modules/collection.types'
import { fetchDimensionData } from '../multiSourceFetcher'
import {
  canExecute as canSourceExecute,
  recordSourceResult,
} from '../adaptiveSourceOrchestrator'
import { summarizeNews, digestResearch } from '../kimiAIService'
import type { NewsItem, ResearchReport } from '../kimiAIService'
import { DIMENSION_TO_ACTION, getDimensionKnownSources, mapSourceLabelToId } from './pipelineMappings'
import { writeDimensionData } from './pipelineWriters'
import type { SingleTraceContext } from './pipelineTypes'

const logger = getLogger()

/** 从采集数据中提取新闻条目 */
export function extractNewsItems(dimData: Record<string, unknown>): NewsItem[] {
  const news = dimData.news ?? dimData.items ?? dimData.data
  if (!Array.isArray(news)) return []
  return news.slice(0, 10).map((n: Record<string, unknown>) => ({
    title: typeof n.title === 'string' ? n.title : '',
    summary: typeof n.summary === 'string' ? n.summary : typeof n.content === 'string' ? n.content : '',
    source: typeof n.source === 'string' ? n.source : '',
    publishedAt: typeof n.publishedAt === 'string' ? n.publishedAt : typeof n.date === 'string' ? n.date : '',
  }))
}

/** 从采集数据中提取研报条目 */
export function extractResearchReports(dimData: Record<string, unknown>): ResearchReport[] {
  const reports = dimData.reports ?? dimData.items ?? dimData.data
  if (!Array.isArray(reports)) return []
  return reports.slice(0, 8).map((r: Record<string, unknown>) => ({
    title: typeof r.title === 'string' ? r.title : '',
    rating: typeof r.rating === 'string' ? r.rating : typeof r.reportRating === 'string' ? r.reportRating : '',
    targetPrice: typeof r.targetPrice === 'number' ? r.targetPrice : undefined,
    analyst: typeof r.analyst === 'string' ? r.analyst : typeof r.source === 'string' ? r.source : '',
    content: typeof r.content === 'string' ? r.content : typeof r.summary === 'string' ? r.summary : '',
    date: typeof r.date === 'string' ? r.date : typeof r.publishedAt === 'string' ? r.publishedAt : '',
  }))
}

// ── Mock 维度数据生成器（已禁用 —— MOCK 数据不真实，真实源失败直接报错）──
// 保留代码供开发参考，生产环境不调用。历史代码见 git log collectionPipeline.ts。

/**
 * 生成维度数据：优先尝试真实数据源，失败时回退到 Mock。
 * @convergence Phase C: multiSourceFetcher 拉取真实数据，Mock 作为降级回退
 *
 * P0 优化（2026-08-09）：接入熔断器，跳过已知死源（circuit-open），
 * 避免每次都走完整 Tushare(空Token) → 东财(已下线) → LLM(慢) 失败链。
 */
export async function generateDataForDimension(symbol: string, dimensionCode: string): Promise<Record<string, unknown>> {
  let fallbackReason = ''

  // 熔断器前置检查：若维度所有已知源均 circuit-open，直接跳过
  const dimSources = getDimensionKnownSources(dimensionCode)
  const allCircuitOpen = dimSources.length > 0 && dimSources.every((src) => !canSourceExecute(src))
  if (allCircuitOpen) {
    fallbackReason = `all_sources_circuit_open: [${dimSources.join(', ')}]`
    logger.warn(`[collectionPipeline] 维度 ${dimensionCode} 所有源熔断中，跳过采集: ${symbol}`, { sources: dimSources })
    return { _source: 'mock', _mock: true, _fallbackReason: fallbackReason, error: fallbackReason }
  }

  const dimStart = Date.now()
  // 尝试真实数据源
  try {
    const realData = await fetchDimensionData(symbol, dimensionCode)
    if (realData) {
      const source = (realData._source as string) || 'real'
      const sourceId = mapSourceLabelToId(source)
      // 记录成功：更新 EWMA 指标 + 熔断器 onSuccess
      recordSourceResult(sourceId, {
        success: true,
        isMock: false,
        latencyMs: Date.now() - dimStart,
        completeness: 1,
      })
      logger.debug(`[collectionPipeline] 维度 ${dimensionCode} 真实数据获取成功: ${symbol}`)
      return { ...realData, _source: source, _fallbackReason: '' }
    }
    fallbackReason = 'real_source_returned_empty'
    // 记录失败：空结果视为失败（用该维度配置的首个已知源作为失败归属，避免硬编码 tushare）
    const emptyFailSource = getDimensionKnownSources(dimensionCode)[0] ?? 'unknown'
    recordSourceResult(emptyFailSource, { success: false, isMock: false, latencyMs: Date.now() - dimStart, completeness: 0 })
    logger.warn(`[collectionPipeline] 维度 ${dimensionCode} 真实数据返回空，记录失败源=${emptyFailSource}: ${symbol}`)
  } catch (err) {
    logger.warn(`[collectionPipeline] 维度 ${dimensionCode} 真实数据获取失败: ${symbol}`, { error: String(err) })
    fallbackReason = `real_source_threw: ${err instanceof Error ? err.message : String(err)}`
    // 异常同样按维度已知源归属，避免硬编码 tushare
    const throwFailSource = getDimensionKnownSources(dimensionCode)[0] ?? 'unknown'
    recordSourceResult(throwFailSource, { success: false, isMock: false, latencyMs: Date.now() - dimStart, completeness: 0 })
    logger.warn(`[collectionPipeline] 维度 ${dimensionCode} 异常，记录失败源=${throwFailSource}: ${symbol}`)
  }

  // MOCK 禁用：真实源失败直接返回错误标记，不生成 mock
  logger.warn(`[collectionPipeline] 维度 ${dimensionCode} 真实数据不可用，禁止 mock: ${symbol}。原因: ${fallbackReason}`)
  return { _source: 'mock', _mock: true, _fallbackReason: fallbackReason, error: fallbackReason }
}

/**
 * KIMI AI 增强（Dim 05 新闻摘要 / Dim 08 研报解读）。
 * 独立函数 + 早退守卫：原内联块最深嵌套 9 层，抽取后≤4。
 * AI 增强失败不阻塞主流程。
 */
export async function runKimiaiEnhancement(
  ctx: SingleTraceContext,
  dimData: Record<string, unknown>,
  sourceLabel: string,
): Promise<void> {
  const { symbol, dimensionCode } = ctx

  if (dimensionCode === '05') {
    const aiStage = 'KIMI新闻摘要'
    ctx.addStage('transform', `开始 ${aiStage}`, sourceLabel as QuoteDataSourceId)
    const newsItems = extractNewsItems(dimData)
    if (newsItems.length === 0) return
    const aiResult = await summarizeNews(symbol, '', newsItems)
    if (!aiResult) return
    dimData._kimiSummary = aiResult
    dimData.sentiment = aiResult.sentiment
    dimData.sentimentScore = aiResult.sentimentScore
    await writeDimensionData(symbol, dimensionCode, { _kimiSummary: aiResult }, DIMENSION_TO_ACTION[dimensionCode]!)
    ctx.addStage('transform', `${aiStage} 完成 (sentiment: ${aiResult.sentiment}, score: ${aiResult.sentimentScore})`, sourceLabel as QuoteDataSourceId)
    return
  }

  if (dimensionCode === '08') {
    const aiStage = 'KIMI研报解读'
    ctx.addStage('transform', `开始 ${aiStage}`, sourceLabel as QuoteDataSourceId)
    const reports = extractResearchReports(dimData)
    if (reports.length === 0) return
    const aiResult = await digestResearch(symbol, '', reports)
    if (!aiResult) return
    dimData._kimiDigest = aiResult
    await writeDimensionData(symbol, dimensionCode, { _kimiDigest: aiResult }, DIMENSION_TO_ACTION[dimensionCode]!)
    ctx.addStage('transform', `${aiStage} 完成 (consensus: ${aiResult.consensusRating})`, sourceLabel as QuoteDataSourceId)
  }
}
