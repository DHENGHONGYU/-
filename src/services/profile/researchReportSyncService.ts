/**
 * 券商研报 → 资料条目 同步适配器
 *
 * 将券商研报（东财研报 API / LLM 搜索 / Tushare）自动同步到
 * 八域资料体系的 profile_items，作为 D3/D4/D6 域的核心资料来源。
 *
 * 设计原则（第一性原则）：
 * - 不重复存储内容：资料条目通过 contentRef 指向原始数据
 * - 质量优先：券商研报质量高，是 D3/D6 域的核心证据来源
 * - 评级加权：研报评级（买入/增持/中性/减持/卖出）直接映射到情绪和证据权重
 *
 * 数据来源：
 * - L1: 东方财富研报 API（零鉴权，已验证可用）
 * - L2: DeepSeek LLM 联网搜索（兜底/补充）
 * - L3: Tushare 研报接口（需 API Key）
 *
 * @module services/profile
 * @updated 2026-07-21
 * @doc [V9-DOC-DATA-028, V9-DOC-DATA-029]
 */

import { getLogger } from '@/lib/logger'
import type { ResearchReport } from '@/services/data-collector/dimensionDataTypes'
import type { ProfileItem, ProfileDomain, ScoreLayerId, SentimentLabel } from '@/data/types/types.profile'
import { STORE_NAME } from '@/config/dbConfig'
import { autoTagItem } from './tagService'
import { bulkSaveProfileItems } from './profileService'

const logger = getLogger()

// ============================================================
// 常量与配置
// ============================================================

/** 研报默认归属域：D3 公司基本面 */
const DEFAULT_DOMAIN: ProfileDomain = 'D3'

/** 最低质量分门槛（研报质量普遍较高，门槛设高一些） */
const MIN_QUALITY_THRESHOLD = 50

/** 券商评级 → 情绪映射 */
const RATING_TO_SENTIMENT: Record<string, SentimentLabel> = {
  '买入': 'positive',
  '增持': 'positive',
  '强烈推荐': 'positive',
  '推荐': 'positive',
  '优于大市': 'positive',
  '跑赢行业': 'positive',
  '增持-A': 'positive',
  '买入-A': 'positive',
  '中性': 'neutral',
  '持有': 'neutral',
  '同步大市': 'neutral',
  '跑平行业': 'neutral',
  '减持': 'negative',
  '卖出': 'negative',
  '回避': 'negative',
  '减持-A': 'negative',
  '卖出-A': 'negative',
  '强烈卖出': 'negative',
}

/** 券商评级 → 证据权重调整系数 */
const RATING_WEIGHT_FACTOR: Record<string, number> = {
  '买入': 1.2,
  '增持': 1.1,
  '强烈推荐': 1.2,
  '推荐': 1.1,
  '优于大市': 1.05,
  '跑赢行业': 1.05,
  '中性': 1.0,
  '持有': 1.0,
  '同步大市': 0.95,
  '减持': 0.9,
  '卖出': 0.9,
  '回避': 0.85,
}

/** 知名券商权重加成（头部券商研报可信度更高） */
const TOP_INSTITUTIONS = new Set([
  '中信证券', '中金公司', '华泰证券', '国泰君安', '海通证券',
  '招商证券', '广发证券', '申万宏源', '国信证券', '东方证券',
  '兴业证券', '长江证券', '安信证券', '东吴证券', '天风证券',
  '中信建投', '华泰联合', '国泰君安国际',
])

// ============================================================
// 分类函数：研报 → 域
// ============================================================

/**
 * 研报分类到八域
 *
 * 研报主要归属 D3（公司基本面）和 D6（估值定价），
 * 部分行业研报归属 D1（行业产业），
 * 深度报告可能涉及 D7（成长前沿）。
 *
 * 基于标题关键词 + 评级维度加权投票。
 */
export function classifyResearchReportToDomain(report: Pick<ResearchReport, 'title' | 'summary'>): ProfileDomain {
  const text = `${report.title} ${report.summary}`.toLowerCase()

  const scores: Record<ProfileDomain, number> = {
    D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0, D7: 0, D8: 0,
  }

  // D3 基础分（研报默认偏向公司基本面）
  scores.D3 = 3

  // D1 行业产业
  if (text.includes('行业') || text.includes('产业') || text.includes('景气度') || text.includes('产业链')) {
    scores.D1 += 3
  }
  if (text.includes('市场规模') || text.includes('渗透率') || text.includes('竞争格局')) {
    scores.D1 += 2
  }

  // D3 公司基本面
  if (text.includes('业绩') || text.includes('营收') || text.includes('净利润') || text.includes('盈利')) {
    scores.D3 += 2
  }
  if (text.includes('护城河') || text.includes('商业模式') || text.includes('竞争力') || text.includes('主营业务')) {
    scores.D3 += 2
  }
  if (text.includes('产能') || text.includes('扩张') || text.includes('新产品') || text.includes('技术突破')) {
    scores.D3 += 1
  }

  // D4 竞争对比
  if (text.includes('竞品') || text.includes('对比') || text.includes('份额') || text.includes('排名') || text.includes('竞争对手')) {
    scores.D4 += 3
  }
  if (text.includes('龙头') || text.includes('赶超') || text.includes('第一') || text.includes('市场份额')) {
    scores.D4 += 2
  }

  // D5 财务分析（研报核心域之一）
  if (text.includes('财务') || text.includes('roe') || text.includes('现金流') || text.includes('负债')) {
    scores.D5 += 4
  }
  if (text.includes('杜邦') || text.includes('分红') || text.includes('资产负债表') || text.includes('毛利率')) {
    scores.D5 += 2
  }

  // D6 估值定价（研报核心域）
  if (text.includes('估值') || text.includes('pe') || text.includes('pb') || text.includes('目标价')) {
    scores.D6 += 3
  }
  if (text.includes('评级') || text.includes('买入') || text.includes('增持') || text.includes('卖出') || text.includes('减持')) {
    scores.D6 += 2
  }
  if (text.includes('低估') || text.includes('高估') || text.includes('合理估值') || text.includes('一致预期')) {
    scores.D6 += 1
  }

  // D7 成长前沿
  if (text.includes('增长') || text.includes('第二曲线') || text.includes('新业务') || text.includes('空间') || text.includes('成长性')) {
    scores.D7 += 3
  }
  if (text.includes('情景') || text.includes('推演') || text.includes('天花板')) {
    scores.D7 += 2
  }
  // 强 D7 特征额外加权
  if (text.includes('第二曲线')) {
    scores.D7 += 2
  }

  // 找出最高分的域
  let maxScore = 0
  let maxDomain: ProfileDomain = DEFAULT_DOMAIN
  for (const [domain, score] of Object.entries(scores) as [ProfileDomain, number][]) {
    if (score > maxScore) {
      maxScore = score
      maxDomain = domain
    }
  }

  return maxDomain
}

// ============================================================
// 转换函数：ResearchReport → ProfileItem
// ============================================================

/**
 * 计算研报质量分
 *
 * 基于：券商影响力 + 评级明确度 + 目标价信息 + 摘要完整度
 */
function calcQualityScore(report: ResearchReport): number {
  let score = 50 // 基础分

  // 券商影响力
  if (TOP_INSTITUTIONS.has(report.institution)) {
    score += 15
  } else if (report.institution && report.institution.length > 0) {
    score += 8
  }

  // 评级明确度（有明确评级的加分）
  if (report.rating && report.rating.length > 0) {
    score += 10
  }

  // 目标价信息（有目标价的研报信息密度更高）
  if (report.targetPrice != null && report.targetPrice > 0) {
    score += 8
  }

  // 摘要完整度
  if (report.summary && report.summary.length > 50) {
    score += 5
  }
  if (report.summary && report.summary.length > 100) {
    score += 5
  }

  // 有分析师署名的加分
  if (report.author && report.author.length > 0) {
    score += 3
  }

  // 裁剪到 [20, 100]
  return Math.max(20, Math.min(100, Math.round(score)))
}

/**
 * 计算证据权重
 *
 * 研报的证据权重取决于：质量分 + 评级权重 + 券商影响力
 */
function calcEvidenceWeight(report: ResearchReport, qualityScore: number): number {
  // 基础权重：质量分 / 100 * 0.7
  let weight = (qualityScore / 100) * 0.7

  // 评级权重调整
  const ratingFactor = RATING_WEIGHT_FACTOR[report.rating] ?? 1.0
  weight *= ratingFactor

  // 头部券商额外加成
  if (TOP_INSTITUTIONS.has(report.institution)) {
    weight += 0.05
  }

  // 有目标价的加成（可量化的证据更有价值）
  if (report.targetPrice != null) {
    weight += 0.05
  }

  // 裁剪到 [0.1, 0.95]
  return Math.max(0.1, Math.min(0.95, Number(weight.toFixed(2))))
}

/**
 * 获取评级对应的情绪标签
 */
function getSentimentFromRating(rating: string): SentimentLabel {
  return RATING_TO_SENTIMENT[rating] ?? 'neutral'
}

/**
 * 研报 → 资料条目 转换
 */
export function researchReportToProfileItem(
  report: ResearchReport,
  symbol: string,
  options: { domain?: ProfileDomain } = {},
): Omit<ProfileItem, 'id' | 'dataHash' | 'collectedAt' | 'schemaVersion' | 'version'> {
  const domain = options.domain ?? classifyResearchReportToDomain(report)
  const qualityScore = calcQualityScore(report)
  const evidenceWeight = calcEvidenceWeight(report, qualityScore)
  const sentiment = getSentimentFromRating(report.rating)

  // 关联评分层
  const relatedLayers = getLayersForDomain(domain)

  // 证据说明
  const evidenceNote = buildEvidenceNote(report, domain, qualityScore)

  // 主题标签
  const topicTags = extractTopicTags(report)

  return {
    symbol,
    domain,
    itemType: 'research_report',
    subType: report.rating || '研报',

    title: report.title,
    summary: report.summary || '',
    content: evidenceNote,
    keyPoints: report.summary ? extractKeyPoints(report.summary) : undefined,

    source: report.institution || '券商研报',
    sourceUrl: undefined, // 研报 API 通常不直接提供 URL
    author: report.author || undefined,
    publishedAt: new Date(report.date).getTime() || Date.now(),

    topicTags,
    sentiment,
    qualityScore,

    relatedLayers,
    evidenceWeight,

    isUserGenerated: false,

    originalStore: STORE_NAME.profileItems, // 研报数据通过 API 获取，不存独立 store
    originalKey: report.id,
  }
}

/**
 * 根据域获取关联评分层
 */
function getLayersForDomain(domain: ProfileDomain): ScoreLayerId[] {
  const map: Record<ProfileDomain, ScoreLayerId[]> = {
    D1: ['lMinus1'],
    D2: ['l0'],
    D3: ['l1'],
    D4: ['l2'],
    D5: ['l3f'],
    D6: ['l3v'],
    D7: ['l4', 'l5', 'l6'],
    D8: ['l7', 'l8'],
  }
  return map[domain]
}

/**
 * 构建证据说明
 */
function buildEvidenceNote(report: ResearchReport, _domain: ProfileDomain, qualityScore: number): string {
  const parts: string[] = []

  if (report.institution) {
    parts.push(`${report.institution}${report.author ? ` ${report.author}` : ''} 发布`)
  }

  if (report.rating) {
    parts.push(`评级：${report.rating}`)
  }

  if (report.targetPrice != null) {
    parts.push(`目标价：${report.targetPrice}`)
  }

  if (qualityScore >= 80) {
    parts.push('高质量研报')
  } else if (qualityScore >= 60) {
    parts.push('有参考价值')
  }

  return parts.join('，')
}

/**
 * 提取主题标签
 */
function extractTopicTags(report: ResearchReport): string[] {
  const tags: string[] = []

  // 券商标签
  if (report.institution) {
    tags.push(report.institution)
  }

  // 评级标签
  if (report.rating) {
    tags.push(report.rating)
  }

  // 从标题提取关键词标签
  const title = report.title
  const keywordTags = [
    { kw: '业绩', tag: '业绩' },
    { kw: '估值', tag: '估值' },
    { kw: '行业', tag: '行业' },
    { kw: '财务', tag: '财务' },
    { kw: '成长', tag: '成长性' },
    { kw: '盈利', tag: '盈利能力' },
    { kw: '风险', tag: '风险' },
    { kw: '政策', tag: '政策' },
    { kw: '产能', tag: '产能' },
    { kw: '新产品', tag: '新产品' },
  ]

  for (const { kw, tag } of keywordTags) {
    if (title.includes(kw) && !tags.includes(tag)) {
      tags.push(tag)
    }
  }

  // 最多 8 个标签
  return tags.slice(0, 8)
}

/**
 * 从摘要中提取核心观点（简单按句号/分号切分，取前 3 句）
 */
function extractKeyPoints(summary: string): string[] {
  const sentences = summary
    .split(/[。；;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5 && s.length < 80)

  return sentences.slice(0, 3)
}

// ============================================================
// 批量同步入口
// ============================================================

export interface SyncResearchReportsOptions {
  /** 最大同步条数 */
  limit?: number
  /** 最低质量分门槛 */
  minQuality?: number
  /** 指定域（不指定则自动分类） */
  domain?: ProfileDomain
}

/**
 * 将券商研报批量同步到资料体系
 *
 * @param symbol 股票代码
 * @param reports 研报数组
 * @param options 同步选项
 * @returns 实际同步的条数
 */
export async function syncResearchReportsToProfile(
  symbol: string,
  reports: ResearchReport[],
  options: SyncResearchReportsOptions = {},
): Promise<number> {
  const {
    limit = 15,
    minQuality = MIN_QUALITY_THRESHOLD,
    domain,
  } = options

  if (reports.length === 0) {
    logger.info(`[researchSync] 无研报数据，跳过同步`, { symbol })
    return 0
  }

  logger.info(`[researchSync] 开始同步券商研报`, {
    symbol,
    totalReports: reports.length,
    limit,
    minQuality,
  })

  // 1. 转换 + 质量过滤
  const items: Omit<ProfileItem, 'id' | 'dataHash' | 'collectedAt' | 'schemaVersion' | 'version'>[] = []
  let skippedLowQuality = 0

  for (const report of reports) {
    const item = researchReportToProfileItem(report, symbol, { domain })

    if (item.qualityScore != null && item.qualityScore < minQuality) {
      skippedLowQuality++
      continue
    }

    items.push(item)

    if (items.length >= limit) {
      break
    }
  }

  if (items.length === 0) {
    logger.info(`[researchSync] 过滤后无合格研报`, {
      symbol,
      skippedLowQuality,
    })
    return 0
  }

  // 2. 自动打标（autoTagItem 为异步函数，逐条容错）
  const taggedItems = await Promise.all(
    items.map(async (item) => {
      try {
        return await autoTagItem(item as ProfileItem)
      } catch {
        return item as ProfileItem
      }
    }),
  )

  // 3. 批量写入
  try {
    const syncResult = await bulkSaveProfileItems(taggedItems)

    logger.info(`[researchSync] 同步完成`, {
      symbol,
      total: reports.length,
      converted: taggedItems.length,
      saved: syncResult.saved,
      skippedLowQuality,
    })

    return syncResult.saved
  } catch (err) {
    logger.error(`[researchSync] 同步失败`, {
      symbol,
      error: err instanceof Error ? err.message : String(err),
    })
    return 0
  }
}

/**
 * 单份研报同步
 */
export async function syncSingleResearchReport(
  report: ResearchReport,
  symbol: string,
): Promise<boolean> {
  const count = await syncResearchReportsToProfile(symbol, [report], { limit: 1 })
  return count > 0
}
