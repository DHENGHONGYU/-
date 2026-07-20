/**
 * 本地知识库 → 资料体系同步适配器
 *
 * 将 local_docs 中的研报/财报/行业分析等文档同步为资料条目。
 * 复用 localDocs store，不重复存储正文，仅建立索引和元数据。
 *
 * 分类映射规则：
 *   研报     → D7 成长前沿（券商研报，含目标价/评级）
 *   财报     → D5 财务分析（公司财务报告）
 *   行业分析 → D1 行业产业（行业层面研究）
 *   新闻     → D8 市场信号（资讯类）
 *   策略笔记 → 按内容关键词动态分类
 *   其他     → D8 市场信号（兜底）
 *
 * @module services/profile/localDocSyncService
 * @updated 2026-07-20
 * @doc [V9-DOC-DATA-028, V9-DOC-DATA-029]
 */

import type { LocalDoc } from '@/data/types/types.knowledge'
import type {
  ProfileDomain,
  ProfileItem,
  ProfileItemType,
  ScoreLayerId,
} from '@/data/types/types.profile'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { autoTagItem } from './tagService'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

// ============================================================
// 分类映射
// ============================================================

const CATEGORY_TO_DOMAIN: Record<LocalDoc['category'], ProfileDomain> = {
  研报: 'D7',
  财报: 'D5',
  行业分析: 'D1',
  新闻: 'D8',
  策略笔记: 'D8',
  其他: 'D8',
}

const CATEGORY_TO_ITEM_TYPE: Record<LocalDoc['category'], ProfileItemType> = {
  研报: 'research_report',
  财报: 'financial_report',
  行业分析: 'industry_report',
  新闻: 'news',
  策略笔记: 'note',
  其他: 'other',
}

// 策略笔记按关键词进一步细分到具体域
const STRATEGY_NOTE_KEYWORDS: Array<{ domain: ProfileDomain; keywords: string[] }> = [
  { domain: 'D1', keywords: ['行业', '产业', '赛道', '格局', '集中度', 'CR5'] },
  { domain: 'D2', keywords: ['宏观', '美联储', '加息', '降息', 'GDP', 'CPI', 'PMI', '汇率'] },
  { domain: 'D3', keywords: ['护城河', '竞争优势', '壁垒', '品牌', '渠道', '管理', '治理'] },
  { domain: 'D5', keywords: ['财务', '财报', 'ROE', '毛利率', '净利率', '现金流', '资产负债'] },
  { domain: 'D6', keywords: ['估值', 'PE', 'PB', 'DCF', '目标价', '安全边际', 'PEG'] },
  { domain: 'D7', keywords: ['成长', '第二曲线', '新产品', '扩产', '研发', '技术', '创新'] },
  { domain: 'D8', keywords: ['股价', '走势', '行情', '北向', '资金', '成交量', '筹码'] },
]

// 研报中的内容关键词 → 额外关联的评分层
const RESEARCH_REPORT_LAYER_KEYWORDS: Array<{ layer: ScoreLayerId; keywords: string[] }> = [
  { layer: 'l1', keywords: ['护城河', '竞争优势', '壁垒', '品牌力'] },
  { layer: 'l2', keywords: ['竞品', '竞争对手', '行业格局', '市场份额'] },
  { layer: 'l3f', keywords: ['财务', '财报', 'ROE', '毛利率', '业绩'] },
  { layer: 'l3v', keywords: ['估值', 'PE', 'PB', '目标价', '安全边际', 'PEG'] },
  { layer: 'l4', keywords: ['第二曲线', '新产品', '技术', '创新', '研发'] },
  { layer: 'l7', keywords: ['北向', '资金', '机构持仓', '筹码'] },
]

// ============================================================
// 核心函数：本地文档 → 资料条目
// ============================================================

/**
 * 将 LocalDoc 转换为 ProfileItem（不带 id/collectedAt/schemaVersion/version）
 */
export function localDocToProfileItem(
  doc: LocalDoc,
): Omit<
  import('@/data/types/types.profile').ProfileItem,
  'id' | 'collectedAt' | 'schemaVersion' | 'version' | 'dataHash'
> {
  const domain = determineDomain(doc)
  const itemType = CATEGORY_TO_ITEM_TYPE[doc.category]

  // 基础元数据
  const title = doc.name
  const source = doc.source || doc.category
  const sourceUrl = '' // 本地文件无 URL，sourcePath 存原始路径

  // 质量评分（基于文件大小、是否有标签、授权状态）
  const qualityScore = calculateQualityScore(doc)

  // 情绪（本地文档默认中性，研报可根据关键词推断）
  const sentiment = inferSentiment(doc)

  // 主题标签
  const topicTags = [...doc.tags]

  // 关联评分层
  const relatedLayers = inferRelatedLayers(doc)

  // 证据权重（研报 > 财报 > 行业分析 > 其他）
  const evidenceWeight = calculateEvidenceWeight(doc)

  // 摘要（取 content 前 200 字）
  const summary = doc.content.slice(0, 200).trim()

  return {
    symbol: doc.symbol === 'ALL' ? '' : doc.symbol,
    domain,
    itemType,
    title,
    summary: summary || `[${doc.category}] ${doc.name}`,
    source,
    sourceUrl: sourceUrl || undefined,
    author: undefined,
    publishedAt: doc.addedAt, // 用添加时间代替发布时间
    qualityScore,
    dataQuality: qualityScore >= 75 ? 'high' : qualityScore >= 50 ? 'medium' : 'low',
    sentiment,
    topicTags,
    relatedLayers,
    evidenceWeight,
    isUserGenerated: doc.authorizationStatus !== 'public_domain',
    originalStore: STORE_NAME.localDocs,
    originalKey: doc.id,
    crossReferences: [],
  }
}

// ============================================================
// 辅助函数
// ============================================================

function determineDomain(doc: LocalDoc): ProfileDomain {
  // 策略笔记按内容关键词细分
  if (doc.category === '策略笔记') {
    const text = `${doc.name} ${doc.content.slice(0, 500)}`
    for (const rule of STRATEGY_NOTE_KEYWORDS) {
      if (rule.keywords.some((kw) => text.includes(kw))) {
        return rule.domain
      }
    }
  }

  return CATEGORY_TO_DOMAIN[doc.category] || 'D8'
}

function calculateQualityScore(doc: LocalDoc): number {
  let score = 40 // 基础分

  // 文件大小（有内容的文档更有价值）
  if (doc.size > 10000) score += 15 // >10KB
  else if (doc.size > 2000) score += 10 // >2KB
  else if (doc.size > 500) score += 5 // >500B

  // 标签数量
  if (doc.tags.length >= 5) score += 10
  else if (doc.tags.length >= 3) score += 7
  else if (doc.tags.length >= 1) score += 3

  // 有嵌入向量（可语义搜索）
  if (doc.embedding) score += 10

  // 授权状态
  if (doc.authorizationStatus === 'authorized') score += 10
  else if (doc.authorizationStatus === 'public_domain') score += 8
  else if (doc.authorizationStatus === 'pending') score += 3

  // 研报类加成
  if (doc.category === '研报') score += 10
  if (doc.category === '财报') score += 8

  return Math.min(100, Math.round(score))
}

function inferSentiment(doc: LocalDoc): 'positive' | 'negative' | 'neutral' {
  const text = `${doc.name} ${doc.content.slice(0, 300)}`
  const positiveWords = ['增长', '提升', '超预期', '利好', '买入', '增持', '推荐', '看好', '突破', '创新高']
  const negativeWords = ['下降', '下滑', '低于预期', '利空', '卖出', '减持', '风险', '承压', '亏损', '下滑']

  let posCount = 0
  let negCount = 0

  for (const word of positiveWords) {
    if (text.includes(word)) posCount++
  }
  for (const word of negativeWords) {
    if (text.includes(word)) negCount++
  }

  if (posCount > negCount + 1) return 'positive'
  if (negCount > posCount + 1) return 'negative'
  return 'neutral'
}

function inferRelatedLayers(doc: LocalDoc): ScoreLayerId[] {
  const layers: ScoreLayerId[] = []
  const text = `${doc.name} ${doc.content.slice(0, 500)}`

  for (const rule of RESEARCH_REPORT_LAYER_KEYWORDS) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      layers.push(rule.layer)
    }
  }

  // 按文档类型保底
  if (layers.length === 0) {
    if (doc.category === '研报') layers.push('l3v', 'l4')
    else if (doc.category === '财报') layers.push('l3f')
    else if (doc.category === '行业分析') layers.push('l1', 'l2')
    else layers.push('l7')
  }

  return Array.from(new Set(layers))
}

function calculateEvidenceWeight(doc: LocalDoc): number {
  const baseWeights: Record<LocalDoc['category'], number> = {
    研报: 0.75,
    财报: 0.85,
    行业分析: 0.6,
    新闻: 0.4,
    策略笔记: 0.35,
    其他: 0.3,
  }

  const base = baseWeights[doc.category] || 0.3
  const qualityBonus = (calculateQualityScore(doc) / 100) * 0.15

  return Math.min(0.95, Math.round((base + qualityBonus) * 100) / 100)
}

// ============================================================
// 批量同步
// ============================================================

/**
 * 将某只股票的本地知识库文档批量同步到资料体系
 *
 * 流程：
 * 1. 从 local_docs 查询该股票的文档
 * 2. 分类到各域 + 自动打标
 * 3. 批量写入 profile_items（带去重）
 */
export async function syncLocalDocsToProfile(
  symbol: string,
  options: {
    categories?: LocalDoc['category'][]
    limit?: number
  } = {},
): Promise<number> {
  const { categories, limit = 50 } = options

  try {
    logger.info(`[localDocSync] 开始同步本地文档到资料体系`, { symbol, limit, categories })

    // 1. 查询本地文档
    // 注：local_docs 的 keyPath 是 id，可能有 by-symbol 索引
    let docs: LocalDoc[] = []
    try {
      const result = await dataBridge.query<LocalDoc[]>({
        action: ENVELOPE_ACTION.queryByIndex,
        store: STORE_NAME.localDocs,
        indexName: 'by-symbol',
        indexValue: [symbol],
        source: MODULE_ID.analyzer,
      })
      if (result.success && result.data) {
        docs = result.data
      }
    } catch {
      // 索引不存在时跳过
      logger.info(`[localDocSync] local_docs 无 by-symbol 索引，跳过查询`)
      return 0
    }

    // 2. 按分类过滤
    if (categories && categories.length > 0) {
      docs = docs.filter((d) => categories.includes(d.category))
    }

    // 3. 按添加时间倒序，取最新 N 条
    docs.sort((a, b) => b.addedAt - a.addedAt)
    docs = docs.slice(0, limit)

    if (docs.length === 0) {
      logger.info(`[localDocSync] 无匹配文档，跳过`, { symbol })
      return 0
    }

    // 4. 转换为资料条目
    const { bulkSaveProfileItems } = await import('./profileService')
    const profileItems = docs.map((doc) => localDocToProfileItem(doc))

    // 5. 自动打标
    for (const item of profileItems) {
      const tagged = await autoTagItem(item as ProfileItem)
      item.topicTags = tagged.topicTags
      item.relatedLayers = Array.from(new Set([...(item.relatedLayers ?? []), ...(tagged.relatedLayers ?? [])]))
    }

    // 6. 批量写入
    await bulkSaveProfileItems(profileItems)

    logger.info(`[localDocSync] 本地文档同步完成`, {
      symbol,
      syncedCount: profileItems.length,
      totalDocs: docs.length,
    })

    return profileItems.length
  } catch (err) {
    logger.warn(`[localDocSync] 本地文档同步失败`, {
      symbol,
      error: err instanceof Error ? err.message : String(err),
    })
    return 0
  }
}

/**
 * 同步单篇本地文档到资料体系
 */
export async function syncSingleLocalDoc(docId: string): Promise<boolean> {
  try {
    const result = await dataBridge.query<LocalDoc>({
      action: ENVELOPE_ACTION.queryGet,
      store: STORE_NAME.localDocs,
      key: docId,
      source: MODULE_ID.analyzer,
    })

    if (!result.success || !result.data) {
      logger.warn(`[localDocSync] 文档不存在`, { docId })
      return false
    }

    const item = localDocToProfileItem(result.data)
    const tagged = await autoTagItem(item as ProfileItem)
    item.topicTags = tagged.topicTags
    item.relatedLayers = Array.from(new Set([...(item.relatedLayers ?? []), ...(tagged.relatedLayers ?? [])]))

    const { bulkSaveProfileItems } = await import('./profileService')
    await bulkSaveProfileItems([item])

    logger.info(`[localDocSync] 单文档同步完成`, { docId, domain: item.domain })
    return true
  } catch (err) {
    logger.warn(`[localDocSync] 单文档同步失败`, {
      docId,
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}
