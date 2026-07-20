/**
 * 评分报告 → 资料体系归档集成
 *
 * 将 score_docs 中的 V6 评分报告自动归档到资料体系，
 * 作为评分证据链的核心来源之一，同时供历史回溯使用。
 *
 * 归档策略：
 * - 每次生成新的 ScoreDocVersion 后，自动归档为一条评分报告型资料
 * - 按层拆分：每一层评分都可单独作为一条资料条目，用于对应域的证据
 * - 版本对比：与上一版本的差异单独归档，方便追踪评分变化
 *
 * 域映射：
 *   综合评分报告 → D5 财务分析（作为总览）
 *   L1 护城河   → D3 公司基本面
 *   L2 竞品格局 → D4 竞争对比
 *   L3f 财务    → D5 财务分析
 *   L3v 估值    → D6 估值定价
 *   L4 第二曲线 → D7 成长前沿
 *   L5 情景推演 → D7 成长前沿
 *   L6 业绩兑现 → D7 成长前沿
 *   L7 筹码     → D8 市场信号
 *   L8 技术面   → D8 市场信号
 *
 * @module services/profile/scoreDocArchiveService
 * @updated 2026-07-20
 * @doc [V9-DOC-DATA-028, V9-DOC-DATA-031]
 */

import type { ScoreDocVersion, V6LayerScore } from '@/data/types/types.scoreDoc'
import type {
  ProfileDomain,
  ScoreLayerId,
} from '@/data/types/types.profile'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { autoTagItem } from './tagService'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 层 → 域 映射
// ============================================================

const LAYER_TO_DOMAIN: Record<string, ProfileDomain> = {
  l1: 'D3',    // 护城河 → 公司基本面
  l2: 'D4',    // 竞品格局 → 竞争对比
  l3f: 'D5',   // 财务健康 → 财务分析
  l3v: 'D6',   // 估值水平 → 估值定价
  l4: 'D7',    // 第二曲线 → 成长前沿
  l5: 'D7',    // 情景推演 → 成长前沿
  l6: 'D7',    // 业绩兑现 → 成长前沿
  l7: 'D8',    // 筹码分析 → 市场信号
  l8: 'D8',    // 技术分析 → 市场信号
}

const LAYER_LABELS: Record<string, string> = {
  l1: 'L1 护城河',
  l2: 'L2 竞品格局',
  l3f: 'L3a 财务健康',
  l3v: 'L3v 估值安全边际',
  l4: 'L4 第二曲线',
  l5: 'L5 情景推演',
  l6: 'L6 业绩兑现临界点',
  l7: 'L7 筹码博弈',
  l8: 'L8 技术信号',
}

// ============================================================
// 核心函数：评分报告 → 资料条目
// ============================================================

/**
 * 将完整的 ScoreDocVersion 转换为一组资料条目
 *
 * 产出：
 * - 1 条综合评分报告（D5）
 * - N 条各层评分详情（按层分布到各域）
 * - 1 条版本差异（如果有上一版本）
 */
export async function scoreDocToProfileItems(
  doc: ScoreDocVersion,
): Promise<Array<Omit<
  import('@/data/types/types.profile').ProfileItem,
  'id' | 'collectedAt' | 'schemaVersion' | 'version' | 'dataHash'
>>> {
  const items: Array<Omit<any, 'id' | 'collectedAt' | 'schemaVersion' | 'version' | 'dataHash'>> = []

  // 1. 综合评分报告
  items.push(buildCompositeReportItem(doc))

  // 2. 各层评分详情
  for (const [layerId, layerScore] of Object.entries(doc.layers)) {
    items.push(buildLayerScoreItem(doc, layerId, layerScore as V6LayerScore))
  }

  // 3. 版本差异（如果有）
  if (doc.changeFromPrev) {
    items.push(buildVersionDiffItem(doc))
  }

  // 自动打标
  for (const item of items) {
    const tagged = await autoTagItem(item as any)
    item.topicTags = Array.from(new Set([...(item.topicTags || []), ...(tagged.topicTags || [])]))
    item.relatedLayers = Array.from(new Set([...(item.relatedLayers || []), ...(tagged.relatedLayers || [])]))
  }

  return items
}

// ============================================================
// 单条资料条目构建
// ============================================================

function buildCompositeReportItem(doc: ScoreDocVersion) {
  const title = `${doc.stockName} V6评分报告 v${doc.version}（${doc.scoreDate}）`
  const summary = `综合评分 ${doc.composite}/100，${doc.recommendation.label}，目标价 ${doc.targetPrice.base}元。`

  const contentLines = [
    `# ${title}`,
    '',
    `## 基本信息`,
    '',
    `- 股票：${doc.stockName}（${doc.symbol}）`,
    `- 评分日期：${doc.scoreDate}`,
    `- 报告版本：v${doc.version}`,
    `- 使用模型：${doc.modelUsed}`,
    `- 市场：${doc.market}`,
    doc.industry ? `- 行业：${doc.industry}` : '',
    '',
    `## 评分概览`,
    '',
    `- **综合评分**：${doc.composite}/100`,
    `- **L3v 估值层**：${doc.l3v}/100`,
    `- **投资建议**：${doc.recommendation.label}`,
    `- **目标价（中性）**：${doc.targetPrice.base} 元`,
    `- **目标价（乐观）**：${doc.targetPrice.bull} 元`,
    `- **目标价（悲观）**：${doc.targetPrice.bear} 元`,
    '',
    `## 各层评分`,
    '',
  ]

  for (const [layerId, layer] of Object.entries(doc.layers)) {
    const layerScore = layer as V6LayerScore
    const label = LAYER_LABELS[layerId] || layerId
    contentLines.push(`- ${label}：${layerScore.score}/100 — ${layerScore.reason || ''}`)
  }

  contentLines.push(
    '',
    `## 关键催化剂`,
    '',
    ...doc.keyCatalysts.map((c) => `- ${c}`),
    '',
    `## 关键风险`,
    '',
    ...doc.keyRisks.map((r) => `- ${r}`),
  )

  return {
    symbol: doc.symbol,
    domain: 'D5' as ProfileDomain,
    itemType: 'score_report' as const,
    title,
    summary,
    source: 'V6评分引擎',
    sourceUrl: undefined,
    publishedAt: new Date(doc.createdAt).getTime(),
    author: doc.modelUsed,
    qualityScore: 95,
    dataQuality: 'high' as const,
    sentiment: doc.composite >= 60 ? 'positive' : doc.composite >= 40 ? 'neutral' : 'negative',
    topicTags: ['V6评分', '综合报告', doc.recommendation.label],
    relatedLayers: Object.keys(doc.layers).filter((l) => LAYER_TO_DOMAIN[l]) as ScoreLayerId[],
    evidenceWeight: 0.95,
    isUserGenerated: false,
    originalStore: STORE_NAME.scoreDocs,
    originalKey: doc.docId,
    crossReferences: [],
  }
}

function buildLayerScoreItem(
  doc: ScoreDocVersion,
  layerId: string,
  layerScore: V6LayerScore,
) {
  const label = LAYER_LABELS[layerId] || layerId
  const domain = LAYER_TO_DOMAIN[layerId] || 'D5'
  const title = `${label} — ${doc.stockName} v${doc.version}`
  const summary = `评分 ${layerScore.score}/100（权重 ${(layerScore.weight * 100).toFixed(1)}%）。${layerScore.reason || ''}`

  return {
    symbol: doc.symbol,
    domain,
    itemType: 'score_layer' as const,
    title,
    summary,
    source: 'V6评分引擎',
    sourceUrl: undefined,
    publishedAt: new Date(doc.createdAt).getTime(),
    author: doc.modelUsed,
    qualityScore: 92,
    dataQuality: 'high' as const,
    sentiment: layerScore.score >= 60 ? 'positive' : layerScore.score >= 40 ? 'neutral' : 'negative',
    topicTags: ['V6评分', label],
    relatedLayers: [layerId as ScoreLayerId],
    evidenceWeight: 0.9,
    isUserGenerated: false,
    originalStore: STORE_NAME.scoreDocs,
    originalKey: `${doc.docId}#${layerId}`,
    crossReferences: [
      {
        targetId: doc.docId,
        targetType: 'score_doc',
        relation: 'part_of' as const,
        description: `属于 ${doc.stockName} 综合评分报告 v${doc.version}`,
      },
    ],
  }
}

function buildVersionDiffItem(doc: ScoreDocVersion) {
  const diff = doc.changeFromPrev!
  const title = `${doc.stockName} 评分变动 v${doc.version - 1}→v${doc.version}（${doc.scoreDate}）`
  const summary = `综合评分变动 ${diff.compositeDelta > 0 ? '+' : ''}${diff.compositeDelta}，L3v 变动 ${diff.l3vDelta > 0 ? '+' : ''}${diff.l3vDelta}。`

  // 构建各层变动详情（用于补充 summary）
  const layerDiffs: string[] = []
  for (const [layerId, delta] of Object.entries(diff.layerChanges)) {
    const label = LAYER_LABELS[layerId] || layerId
    const sign = (delta as number) > 0 ? '+' : ''
    layerDiffs.push(`${label}${sign}${delta}`)
  }
  const fullSummary = summary + ' ' + layerDiffs.join('，') + '。'

  return {
    symbol: doc.symbol,
    domain: 'D5' as ProfileDomain,
    itemType: 'score_diff' as const,
    title,
    summary: fullSummary,
    source: 'V6评分引擎',
    sourceUrl: undefined,
    publishedAt: new Date(doc.createdAt).getTime(),
    author: doc.modelUsed,
    qualityScore: 90,
    dataQuality: 'high' as const,
    sentiment: diff.compositeDelta > 0 ? 'positive' : diff.compositeDelta < 0 ? 'negative' : 'neutral',
    topicTags: ['V6评分', '版本对比', '评分变动'],
    relatedLayers: Object.keys(diff.layerChanges).filter((l) => LAYER_TO_DOMAIN[l]) as ScoreLayerId[],
    evidenceWeight: 0.85,
    isUserGenerated: false,
    originalStore: STORE_NAME.scoreDocs,
    originalKey: `${doc.docId}#diff`,
    crossReferences: [
      {
        targetId: doc.docId,
        targetType: 'score_doc',
        relation: 'compares' as const,
        description: `对比 ${doc.stockName} 评分报告 v${doc.version - 1} 与 v${doc.version}`,
      },
    ],
  }
}

// ============================================================
// 批量归档
// ============================================================

/**
 * 将某只股票的评分报告归档到资料体系
 *
 * @param symbol 股票代码
 * @param options.limit 归档最近 N 个版本（默认 10）
 */
export async function archiveScoreDocsToProfile(
  symbol: string,
  options: { limit?: number } = {},
): Promise<number> {
  const { limit = 10 } = options

  try {
    logger.info(`[scoreDocArchive] 开始归档评分报告到资料体系`, { symbol, limit })

    // 1. 查询评分文档
    let docs: ScoreDocVersion[] = []
    try {
      const result = await dataBridge.query<ScoreDocVersion[]>({
        action: ENVELOPE_ACTION.queryByIndex,
        store: STORE_NAME.scoreDocs,
        indexName: 'by-symbol-date',
        indexValue: [symbol],
        source: MODULE_ID.analyzer,
      })
      if (result.success && result.data) {
        docs = result.data
      }
    } catch {
      logger.info(`[scoreDocArchive] score_docs 查询失败，跳过归档`)
      return 0
    }

    // 2. 按版本倒序，取最新 N 个
    docs.sort((a, b) => b.version - a.version)
    docs = docs.slice(0, limit)

    if (docs.length === 0) {
      logger.info(`[scoreDocArchive] 无评分报告，跳过`, { symbol })
      return 0
    }

    // 3. 转换为资料条目
    const allItems: any[] = []
    for (const doc of docs) {
      const items = await scoreDocToProfileItems(doc)
      allItems.push(...items)
    }

    // 4. 批量写入
    const { bulkSaveProfileItems } = await import('./profileService')
    await bulkSaveProfileItems(allItems)

    logger.info(`[scoreDocArchive] 评分报告归档完成`, {
      symbol,
      reportCount: docs.length,
      itemCount: allItems.length,
    })

    return allItems.length
  } catch (err) {
    logger.warn(`[scoreDocArchive] 评分报告归档失败`, {
      symbol,
      error: err instanceof Error ? err.message : String(err),
    })
    return 0
  }
}

/**
 * 归档单份评分报告到资料体系
 */
export async function archiveSingleScoreDoc(docId: string): Promise<number> {
  try {
    const result = await dataBridge.query<ScoreDocVersion>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.scoreDocs,
      key: docId,
      source: MODULE_ID.analyzer,
    })

    if (!result.success || !result.data) {
      logger.warn(`[scoreDocArchive] 评分报告不存在`, { docId })
      return 0
    }

    const items = await scoreDocToProfileItems(result.data)
    const { bulkSaveProfileItems } = await import('./profileService')
    await bulkSaveProfileItems(items as any[])

    logger.info(`[scoreDocArchive] 单份报告归档完成`, { docId, itemCount: items.length })
    return items.length
  } catch (err) {
    logger.warn(`[scoreDocArchive] 单份报告归档失败`, {
      docId,
      error: err instanceof Error ? err.message : String(err),
    })
    return 0
  }
}

/**
 * 评分报告生成后的钩子：自动归档最新版
 *
 * 在 scoreDocService.generateReport 成功后调用
 */
export async function onScoreDocGenerated(doc: ScoreDocVersion): Promise<void> {
  try {
    const items = await scoreDocToProfileItems(doc)
    const { bulkSaveProfileItems } = await import('./profileService')
    await bulkSaveProfileItems(items as any[])

    logger.info(`[scoreDocArchive] 新报告自动归档完成`, {
      docId: doc.docId,
      itemCount: items.length,
    })
  } catch (err) {
    logger.warn(`[scoreDocArchive] 新报告自动归档失败`, {
      docId: doc.docId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
