/**
 * 社区帖 → 资料条目 同步适配器
 *
 * 将社区精选帖子（雪球/股吧/知乎等）自动同步到八域资料体系的 profile_items，
 * 作为 D8 市场信号域的重要输入来源，反映市场情绪与散户/大V观点。
 *
 * 设计原则（第一性原则）：
 * - 不重复存储内容：资料条目通过 contentRef 指向原始采集数据
 * - 不侵入采集流程：异步/按需同步，不影响采集性能
 * - 质量优先：社区帖噪声大，严格质量门槛，仅同步高质量内容
 * - 情绪加权：社区帖的情绪是重要的市场信号，映射到证据链
 *
 * 数据来源：
 * - L1: LLM 联网搜索（雪球深度长文/机构分析/大V观点）
 * - L2: 东方财富股吧爬虫（兜底，噪声较大）
 *
 * @module services/profile
 * @updated 2026-07-20
 * @doc [V9-DOC-DATA-028, V9-DOC-DATA-029]
 */

import { getLogger } from '@/lib/logger'
import type { CommunityPost } from '@/services/data-collector/dimensionDataTypes'
import type { ProfileItem, ProfileDomain, ScoreLayerId, SentimentLabel } from '@/data/types/types.profile'
import { STORE_NAME } from '@/config/dbConfig'
import { autoTagItem } from './tagService'
import { bulkSaveProfileItems } from './profileService'

const logger = getLogger()

// ============================================================
// 常量与配置
// ============================================================

/** 社区帖默认归属域：D8 市场信号 */
const DEFAULT_DOMAIN: ProfileDomain = 'D8'

/** 社区帖关联的评分层：L7 第二曲线（市场情绪）+ L8 技术筹码（资金/人气） */
const DEFAULT_LAYERS: ScoreLayerId[] = ['l7', 'l8']

/** 最低质量分门槛（低于此分的社区帖不同步） */
const MIN_QUALITY_THRESHOLD = 40

/** 来源权重（用于质量分校准） */
const SOURCE_QUALITY_WEIGHT: Record<string, number> = {
  xueqiu: 1.2,         // 雪球：深度长文多，质量高
  '韭研公社': 1.15,     // 韭研公社：研究型社区
  zhihu: 1.05,          // 知乎：分析质量参差不齐
  eastmoney_guba: 0.8,  // 东方财富股吧：噪声大，质量偏低
  '东方财富股吧': 0.8,
  '36氪': 1.1,
  default: 0.9,
}

/** 互动热度权重（阅读/评论/点赞 → 证据权重） */
const ENGAGEMENT_WEIGHT = {
  viewsPer: 0.0001,     // 每 1 万阅读增加 0.01 权重
  commentsPer: 0.005,   // 每 100 评论增加 0.5 权重
  likesPer: 0.002,      // 每 500 点赞增加 1.0 权重
}

/** 社区帖类型映射 */
const SOURCE_TO_SUBTYPE: Record<string, string> = {
  xueqiu: '雪球深度',
  '韭研公社': '研报解读',
  eastmoney_guba: '股吧讨论',
  '东方财富股吧': '股吧讨论',
  zhihu: '知乎分析',
  '36氪': '行业报道',
}

// ============================================================
// 分类函数：社区帖 → 域
// ============================================================

/**
 * 社区帖分类到八域
 *
 * 社区帖主要归属 D8（市场信号），但部分高质量深度分析
 * 可能涉及其他域（如行业分析→D1、公司分析→D3等）。
 * 基于关键词加权投票决定最终归属。
 */
export function classifyCommunityPostToDomain(post: Pick<CommunityPost, 'title' | 'content' | 'source'>): ProfileDomain {
  const text = `${post.title} ${post.content ?? ''}`.toLowerCase()

  const scores: Record<ProfileDomain, number> = {
    D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0, D7: 0, D8: 0,
  }

  // D8 基础分（社区帖默认偏向市场信号）
  scores.D8 = 3

  // D1 行业产业
  if (text.includes('行业') || text.includes('产业') || text.includes('景气度') || text.includes('产业链')) {
    scores.D1 += 2
  }
  if (text.includes('市场规模') || text.includes('渗透率') || text.includes('政策')) {
    scores.D1 += 1
  }

  // D3 公司基本面
  if (text.includes('年报') || text.includes('季报') || text.includes('业绩') || text.includes('营收') || text.includes('净利润')) {
    scores.D3 += 3
  }
  if (text.includes('护城河') || text.includes('商业模式') || text.includes('竞争力') || text.includes('主营业务')) {
    scores.D3 += 2
  }

  // D5 财务分析
  if (text.includes('财务') || text.includes('ROE') || text.includes('现金流') || text.includes('负债')) {
    scores.D5 += 2
  }
  if (text.includes('杜邦') || text.includes('分红') || text.includes('EPS')) {
    scores.D5 += 1
  }

  // D6 估值定价
  if (text.includes('估值') || text.includes('PE') || text.includes('PB') || text.includes('目标价')) {
    scores.D6 += 2
  }
  if (text.includes('低估') || text.includes('高估') || text.includes('评级') || text.includes('买入') || text.includes('卖出')) {
    scores.D6 += 1
  }

  // D7 成长前沿
  if (text.includes('增长') || text.includes('第二曲线') || text.includes('新业务') || text.includes('空间')) {
    scores.D7 += 2
  }
  if (text.includes('情景') || text.includes('推演') || text.includes('天花板')) {
    scores.D7 += 1
  }
  // 强 D7 特征额外加权
  if (text.includes('第二曲线')) {
    scores.D7 += 2
  }

  // D8 市场信号（默认归属，增强关键词）
  if (text.includes('涨停') || text.includes('跌停') || text.includes('大涨') || text.includes('大跌')) {
    scores.D8 += 2
  }
  if (text.includes('资金') || text.includes('北向') || text.includes('主力') || text.includes('筹码') || text.includes('散户')) {
    scores.D8 += 2
  }
  if (text.includes('技术面') || text.includes('MACD') || text.includes('均线') || text.includes('支撑位')) {
    scores.D8 += 2
  }
  if (text.includes('情绪') || text.includes('人气') || text.includes('热度')) {
    scores.D8 += 1
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
// 转换函数：CommunityPost → ProfileItem
// ============================================================

/**
 * 计算社区帖质量分
 *
 * 基于：基础质量分（LLM评估或默认）+ 来源加权 + 互动热度
 */
function calcQualityScore(post: CommunityPost): number {
  // 基础分（LLM 评估的 qualityScore 优先，否则根据来源给基础分）
  const baseScore = post.qualityScore ?? (post.source.includes('xueqiu') ? 60 : 45)

  // 来源加权
  const weight = SOURCE_QUALITY_WEIGHT[post.source]
  let sourceWeight: number
  if (weight !== undefined) {
    sourceWeight = weight
  } else {
    sourceWeight = 0.9
    logger.warn(`[communitySyncService] 未知来源 "${post.source}"，使用默认权重 0.9`)
  }
  const weightedScore = baseScore * sourceWeight

  // 互动热度加分（高质量内容通常互动多，但要防止水军刷量）
  const views = post.views ?? 0
  const comments = post.comments ?? 0
  const likes = post.likes ?? 0

  const engagementRaw = views * ENGAGEMENT_WEIGHT.viewsPer +
    comments * ENGAGEMENT_WEIGHT.commentsPer +
    likes * ENGAGEMENT_WEIGHT.likesPer
  const engagementBonus = Math.min(15, engagementRaw)
  const hasKeyPoints = post.keyPoints && post.keyPoints.length >= 3
  const keyPointsBonus = hasKeyPoints ? 5 : 0

  let score = weightedScore + engagementBonus + keyPointsBonus

  // 裁剪到 [10, 100]
  const finalScore = Math.max(10, Math.min(100, Math.round(score)))

  logger.debug(`[communitySyncService] calcQualityScore: source=${post.source}, base=${baseScore}, weight=${sourceWeight}, weighted=${weightedScore.toFixed(1)}, engagement=${engagementBonus.toFixed(1)}(${engagementRaw.toFixed(1)} raw), keyPoints=${post.keyPoints?.length ?? 0}(+${keyPointsBonus}), final=${finalScore}`)

  return finalScore
}

/**
 * 计算证据权重
 *
 * 社区帖的证据权重取决于：质量分 + 互动热度 + 情绪明确度
 */
function calcEvidenceWeight(post: CommunityPost, qualityScore: number): number {
  // 基础权重：质量分 / 100 * 0.6
  let weight = (qualityScore / 100) * 0.6

  // 互动热度加权（对数缩放，避免极端值）
  const views = post.views ?? 0
  const comments = post.comments ?? 0
  const likes = post.likes ?? 0

  const engagementScore =
    Math.log10(1 + views) * 0.02 +
    Math.log10(1 + comments) * 0.05 +
    Math.log10(1 + likes) * 0.03

  weight += engagementScore

  // 情绪明确度（positive/negative 比 neutral 权重高）
  if (post.sentiment === 'positive' || post.sentiment === 'negative') {
    weight += 0.05
  }

  // 裁剪到 [0.05, 0.9]
  return Math.max(0.05, Math.min(0.9, Number(weight.toFixed(2))))
}

/**
 * 社区帖 → 资料条目 转换
 */
export function communityPostToProfileItem(
  post: CommunityPost,
  symbol: string,
  options: { domain?: ProfileDomain } = {},
): Omit<ProfileItem, 'id' | 'dataHash' | 'collectedAt' | 'schemaVersion' | 'version'> {
  const domain = options.domain ?? classifyCommunityPostToDomain(post)
  const qualityScore = calcQualityScore(post)
  const evidenceWeight = calcEvidenceWeight(post, qualityScore)
  const subType = SOURCE_TO_SUBTYPE[post.source] ?? '社区帖'

  // 生成摘要（如果 content 太长则截取）
  const content = post.content ?? ''
  const summary = content.length > 300
    ? `${content.slice(0, 300)}...`
    : content

  // 情绪标签
  const sentiment = (post.sentiment as SentimentLabel | undefined) ?? 'neutral'

  // 关联评分层
  const relatedLayers = domain === DEFAULT_DOMAIN
    ? DEFAULT_LAYERS
    : getLayersForDomain(domain)

  // 证据说明（ProfileItem 无 evidenceNote 字段，并入完整内容末尾保留）
  const evidenceNote = buildEvidenceNote(post, domain, qualityScore)

  return {
    symbol,
    domain,
    itemType: 'community',
    subType,

    title: post.title,
    summary,
    content: content ? `${content}\n\n---\n${evidenceNote}` : evidenceNote,
    keyPoints: post.keyPoints,

    source: post.source,
    sourceUrl: post.url,
    author: post.author,
    publishedAt: new Date(post.date).getTime() || Date.now(),

    topicTags: extractTopicTags(post),
    sentiment,
    qualityScore,

    relatedLayers,
    evidenceWeight,

    isUserGenerated: false,

    originalStore: STORE_NAME.profileItems, // 社区帖直接进入 profile_items，无原始 store
    originalKey: post.id,
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
function buildEvidenceNote(post: CommunityPost, _domain: ProfileDomain, qualityScore: number): string {
  const parts: string[] = []

  if (post.author) {
    parts.push(`${post.author} 在 ${post.source} 发表`)
  } else {
    parts.push(`来自 ${post.source}`)
  }

  if (post.views != null && post.views > 0) {
    parts.push(`阅读 ${formatNumber(post.views)}`)
  }
  if (post.comments != null && post.comments > 0) {
    parts.push(`评论 ${formatNumber(post.comments)}`)
  }

  if (qualityScore >= 80) {
    parts.push('高质量深度分析')
  } else if (qualityScore >= 60) {
    parts.push('有一定参考价值')
  } else {
    parts.push('普通讨论帖')
  }

  if (post.sentiment === 'positive') {
    parts.push('偏多情绪')
  } else if (post.sentiment === 'negative') {
    parts.push('偏空情绪')
  }

  return parts.join('，')
}

/**
 * 提取主题标签
 */
function extractTopicTags(post: CommunityPost): string[] {
  const tags: string[] = []

  // 来源标签
  if (post.source) {
    tags.push(post.source)
  }

  // 从标题提取潜在标签（关键词匹配）
  const title = post.title
  const keywordTags = [
    { kw: '业绩', tag: '业绩' },
    { kw: '财报', tag: '财报' },
    { kw: '估值', tag: '估值' },
    { kw: '行业', tag: '行业' },
    { kw: '技术', tag: '技术面' },
    { kw: '资金', tag: '资金流向' },
    { kw: '北向', tag: '北向资金' },
    { kw: '主力', tag: '主力动向' },
    { kw: '散户', tag: '散户情绪' },
    { kw: '护城河', tag: '护城河' },
    { kw: '成长', tag: '成长性' },
    { kw: '风险', tag: '风险' },
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
 * 数字格式化
 */
function formatNumber(n: number): string {
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1)}万`
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`
  }
  return String(n)
}

// ============================================================
// 批量同步入口
// ============================================================

export interface SyncCommunityOptions {
  /** 最大同步条数 */
  limit?: number
  /** 最低质量分门槛 */
  minQuality?: number
  /** 指定域（不指定则自动分类） */
  domain?: ProfileDomain
}

/**
 * 将社区帖批量同步到资料体系
 *
 * @param symbol 股票代码
 * @param options 同步选项
 * @returns 实际同步的条数
 *
 * @description
 * 从采集管线获取社区精选帖子，转换为资料条目并写入 profile_items。
 * 自动应用质量门槛过滤和去重。
 */
export async function syncCommunityToProfile(
  symbol: string,
  posts: CommunityPost[],
  options: SyncCommunityOptions = {},
): Promise<number> {
  const {
    limit = 20,
    minQuality = MIN_QUALITY_THRESHOLD,
    domain,
  } = options

  if (posts.length === 0) {
    logger.info(`[communitySync] 无社区帖数据，跳过同步`, { symbol })
    return 0
  }

  logger.info(`[communitySync] 开始同步社区帖`, {
    symbol,
    totalPosts: posts.length,
    limit,
    minQuality,
  })

  // 1. 转换 + 质量过滤
  const items: Omit<ProfileItem, 'id' | 'dataHash' | 'collectedAt' | 'schemaVersion' | 'version'>[] = []
  let skippedLowQuality = 0

  for (const post of posts) {
    const item = communityPostToProfileItem(post, symbol, { domain })

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
    logger.info(`[communitySync] 过滤后无合格社区帖`, {
      symbol,
      skippedLowQuality,
    })
    return 0
  }

  // 2. 自动打标（参考 newsSyncService 模式，autoTagItem 为异步函数，逐条容错）
  const taggedItems = await Promise.all(
    items.map(async (item) => {
      try {
        return await autoTagItem(item as ProfileItem)
      } catch {
        return item as ProfileItem
      }
    }),
  )

  // 3. 批量写入（bulkSaveProfileItems 内部已处理去重）
  try {
    const syncResult = await bulkSaveProfileItems(taggedItems)

    logger.info(`[communitySync] 同步完成`, {
      symbol,
      total: posts.length,
      converted: taggedItems.length,
      saved: syncResult.saved,
      skippedLowQuality,
    })

    return syncResult.saved
  } catch (err) {
    logger.error(`[communitySync] 同步失败`, {
      symbol,
      error: err instanceof Error ? err.message : String(err),
    })
    return 0
  }
}

/**
 * 单条社区帖同步（用于新增/更新时触发）
 */
export async function syncSingleCommunityPost(
  post: CommunityPost,
  symbol: string,
): Promise<boolean> {
  const count = await syncCommunityToProfile(symbol, [post], { limit: 1 })
  return count > 0
}
