/**
 * 分析编排器 ↔ 八域资料体系 集成服务
 *
 * 为 analysisOrchestrator 提供资料体系的数据接入能力：
 * 1. gatherProfileSummary — 收集资料摘要（给 LLM 作为上下文）
 * 2. archiveAnalysisResult — 分析结论自动归档到资料体系
 *
 * 设计原则（第一性原则）：
 * - 不侵入 analysisOrchestrator 核心管线，以独立服务形式存在
 * - 降级友好：资料数据缺失时返回空摘要，不阻塞主流程
 * - 异步非阻塞：归档操作不等待，在后台执行
 *
 * @module services/analysis/profileIntegrationService
 * @created 2026-07-20
 * @doc [V9-DOC-DATA-028, V9-DOC-DATA-031]
 */

import { getLogger } from '@/lib/logger'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import type { ProfileItem, ScoreEvidence, ScoreLayerId } from '@/data/types'
import type { ProfileDataSummary } from '@/types/modules/analysisOrchestrator.types'
import type { AnalysisResult } from '@/types/modules/analysisOrchestrator.types'

const logger = getLogger()

// 取前 N 条高质量资料
const TOP_ITEMS_LIMIT = 10
// 每层取前 M 条证据
const TOP_EVIDENCE_PER_LAYER = 3

/**
 * 收集某只股票的资料摘要（用于 LLM 分析上下文）
 *
 * 流程：
 * 1. 从 profile_items 按域查询高质量资料
 * 2. 按质量分 + 证据权重排序
 * 3. 取 TOP_N 条做摘要
 * 4. （可选）从 score_evidence 取关键证据
 *
 * 失败时返回空摘要，不抛出异常
 */
export async function gatherProfileSummary(symbol: string): Promise<ProfileDataSummary> {
  const emptySummary: ProfileDataSummary = {
    totalItems: 0,
    domainCounts: {},
    topItems: [],
    evidenceSummary: [],
  }

  try {
    // 1. 查询所有资料条目
    let items: ProfileItem[] = []
    try {
      const result = await dataBridge.query<ProfileItem[]>({
        action: ENVELOPE_ACTION.queryByIndex,
        store: STORE_NAME.profileItems,
        indexName: 'by-symbol-domain-quality',
        indexValue: [symbol],
        source: MODULE_ID.analyzer,
      })
      if (result.success && result.data) {
        items = result.data
      }
    } catch {
      // 索引不存在或查询失败，降级
      logger.info(`[profileIntegration] profile_items 查询失败，跳过`, { symbol })
    }

    if (items.length === 0) {
      return emptySummary
    }

    // 2. 按域统计
    const domainCounts: Record<string, number> = {}
    for (const item of items) {
      domainCounts[item.domain] = (domainCounts[item.domain] ?? 0) + 1
    }

    // 3. 排序（质量分 × 证据权重，取前 N 条
    const sorted = [...items].sort((a, b) => {
      const scoreA = (a.qualityScore ?? 50) * (a.evidenceWeight ?? 0.5)
      const scoreB = (b.qualityScore ?? 50) * (b.evidenceWeight ?? 0.5)
      return scoreB - scoreA
    })

    const topItems = sorted.slice(0, TOP_ITEMS_LIMIT).map((item) => ({
      domain: item.domain,
      title: item.title,
      summary: item.summary?.slice(0, 150) ?? '',
      source: item.source,
      qualityScore: item.qualityScore,
      sentiment: item.sentiment,
    }))

    // 4. 收集证据摘要
    let evidenceSummary: ProfileDataSummary['evidenceSummary'] = []
    try {
      const evResult = await dataBridge.query<ScoreEvidence[]>({
        action: ENVELOPE_ACTION.queryByIndex,
        store: STORE_NAME.scoreEvidence,
        indexName: 'by-symbol-layer',
        indexValue: [symbol],
        source: MODULE_ID.analyzer,
      })

      if (evResult.success && evResult.data && evResult.data.length > 0) {
        const evidenceByLayer: Record<string, ScoreEvidence[]> = {}
        for (const ev of evResult.data) {
          evidenceByLayer[ev.layer] ??= []
          evidenceByLayer[ev.layer]!.push(ev)
        }

        evidenceSummary = Object.entries(evidenceByLayer).map(([layerId, evs]) => {
          const positive = evs
            .filter((e) => e.sentiment === 'positive')
            .sort((a, b) => b.weight - a.weight)
            .slice(0, TOP_EVIDENCE_PER_LAYER)
            .map((e) => e.description.slice(0, 80))

          const negative = evs
            .filter((e) => e.sentiment === 'negative')
            .sort((a, b) => a.weight - b.weight)
            .slice(0, TOP_EVIDENCE_PER_LAYER)
            .map((e) => e.description.slice(0, 80))

          return {
            layerId,
            evidenceCount: evs.length,
            topPositive: positive,
            topNegative: negative,
          }
        })
      }
    } catch {
      // 证据查询失败，跳过
      logger.info(`[profileIntegration] score_evidence 查询失败，跳过`, { symbol })
    }

    const summary: ProfileDataSummary = {
      totalItems: items.length,
      domainCounts,
      topItems,
      evidenceSummary: evidenceSummary.length > 0 ? evidenceSummary : undefined,
    }

    logger.info(`[profileIntegration] 资料摘要收集完成`, {
      symbol,
      totalItems: items.length,
      domains: Object.keys(domainCounts).length,
      evidenceLayers: evidenceSummary.length,
    })

    return summary
  } catch (err) {
    logger.warn(`[profileIntegration] 资料摘要收集失败`, { symbol, error: err instanceof Error ? err.message : String(err) })
    return emptySummary
  }
}

/**
 * 将分析结论自动归档到资料体系
 *
 * 归档为一条 analysis 类型的资料条目到 D7 成长前沿，
 * 作为分析历史记录，便于回溯。
 *
 * 异步非阻塞，不等待结果
 */
export function archiveAnalysisToProfile(result: AnalysisResult): void {
  // 后台执行，不阻塞
  void (async () => {
    try {
      const { bulkSaveProfileItems } = await import('../profile/profileService.js')

      const item = buildAnalysisProfileItem(result)
      await bulkSaveProfileItems([item])

      logger.info(`[profileIntegration] 分析结论已归档到资料体系`, {
        symbol: result.symbol,
        docId: result.docId,
        rating: result.conclusion?.rating,
      })
    } catch (err) {
      logger.warn(`[profileIntegration] 分析结论归档失败`, {
        symbol: result.symbol,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })()
}

/**
 * 构建分析结论资料条目
 */
function buildAnalysisProfileItem(result: AnalysisResult): Omit<
  ProfileItem,
  'id' | 'dataHash' | 'collectedAt' | 'schemaVersion' | 'version'
> {
  const conclusion = result.conclusion
  const title = `${result.internal.stockName ?? result.symbol} 分析结论（${formatDate(result.createdAt)}）`

  const summary = conclusion
    ? `评级：${ratingLabel(conclusion.rating)}，置信度：${((conclusion.confidence ?? 0) * 100).toFixed(0)}%。${conclusion.summary.slice(0, 100)}`
    : '分析结论生成失败'

  // 构建内容（结构化）
  const keyPoints: string[] = []
  if (conclusion?.opportunities?.length) {
    keyPoints.push(...conclusion.opportunities.slice(0, 3))
  }
  if (conclusion?.keyRisks?.length) {
    keyPoints.push(...conclusion.keyRisks.slice(0, 3))
  }

  // 质量分：基于合理性校验结果 + 置信度
  const baseQuality = result.reasonableness.passed ? 80 : 60
  const confidenceBonus = (conclusion?.confidence ?? 0.5) * 20
  const qualityScore = Math.min(100, Math.round(baseQuality + confidenceBonus))

  // 情绪
  const sentiment = conclusion?.rating === 'strong_buy' || conclusion?.rating === 'buy'
    ? 'positive'
    : conclusion?.rating === 'sell' || conclusion?.rating === 'strong_sell'
    ? 'negative'
    : 'neutral'

  // 关联评分层（全部层，因为分析结论是综合的）
  const relatedLayers = result.factorExecution
    .map((f) => f.factorId)
    .filter((id) => id.startsWith('l')) as ScoreLayerId[]

  return {
    symbol: result.symbol,
    domain: 'D7',
    itemType: 'analysis_note',
    title,
    summary,
    source: 'V9分析引擎',
    sourceUrl: '',
    publishedAt: result.createdAt,
    qualityScore,
    dataQuality: qualityScore >= 75 ? 'high' : qualityScore >= 50 ? 'medium' : 'low',
    sentiment,
    topicTags: [
      '分析结论',
      ratingLabel(conclusion?.rating ?? 'hold'),
      result.reasonableness.passed ? '已验证' : '待验证',
    ],
    relatedLayers,
    evidenceWeight: 0.7,
    isUserGenerated: false,
    originalStore: STORE_NAME.analysisResults,
    originalKey: result.docId,
    crossReferences: [],
  }
}

// ============================================================
// 辅助函数
// ============================================================

function ratingLabel(rating: string): string {
  const labels: Record<string, string> = {
    strong_buy: '强烈买入',
    buy: '买入',
    hold: '持有',
    sell: '卖出',
    strong_sell: '强烈卖出',
  }
  return labels[rating] ?? rating
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
