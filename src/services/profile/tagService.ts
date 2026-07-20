/**
 * 八域资料体系 - 标签服务
 *
 * 提供资料条目的自动打标功能，包括：
 * - 主题标签（基于关键词词典）
 * - 情绪标签（基于情感分析）
 * - 风险标签（基于风险关键词）
 * - 质量标签（基于来源和内容结构）
 *
 * 同时管理全局标签库的 CRUD 和使用统计。
 *
 * @module services/profile/tagService
 * @created 2026-07-21
 * @doc [V9-DOC-DATA-030]
 */

import { getLogger } from '@/lib/logger'
import { STORE_NAME } from '@/config/dbConfig'
import { sendWriteEnvelope, queryByIndex, queryGet, queryList } from '@/data/dataLayerHelpers'
import type { ProfileItem, ProfileTag, TagCategory } from '@/data/types/types.profile'
import { nanoid } from 'nanoid'

const logger = getLogger()

// ============================================================
// 内置主题标签词典
// ============================================================

interface TagRule {
  tag: string
  category: TagCategory
  keywords: string[]
}

const TOPIC_TAG_RULES: TagRule[] = [
  // 行业主题
  { tag: '新能源', category: 'topic', keywords: ['新能源', '光伏', '风电', '储能', '锂电池', '动力电池'] },
  { tag: '人工智能', category: 'topic', keywords: ['ai', '人工智能', '大模型', '算力', '芯片', '半导体'] },
  { tag: '消费', category: 'topic', keywords: ['消费', '白酒', '食品饮料', '零售', '电商', '旅游'] },
  { tag: '医药', category: 'topic', keywords: ['医药', '创新药', '医疗', 'biotech', 'cxo', '疫苗'] },
  { tag: '金融', category: 'topic', keywords: ['银行', '保险', '券商', '金融', '信托', '基金'] },
  { tag: '房地产', category: 'topic', keywords: ['房地产', '地产', '物业', '楼市', '房价'] },
  { tag: '汽车', category: 'topic', keywords: ['汽车', '新能源车', '自动驾驶', '智能驾驶'] },
  { tag: '军工', category: 'topic', keywords: ['军工', '国防', '航天', '航空'] },
  // 投资主题
  { tag: '护城河', category: 'topic', keywords: ['护城河', '壁垒', '垄断', '竞争优势'] },
  { tag: '成长性', category: 'topic', keywords: ['增长', '成长', '扩张', '第二曲线', '新业务'] },
  { tag: '估值', category: 'topic', keywords: ['估值', 'pe', 'pb', '目标价', '低估', '高估'] },
  { tag: '业绩', category: 'topic', keywords: ['业绩', '营收', '净利润', '盈利', '财报'] },
  { tag: '政策', category: 'topic', keywords: ['政策', '监管', '新规', '补贴', '扶持'] },
]

const RISK_TAG_RULES: TagRule[] = [
  { tag: '业绩风险', category: 'risk', keywords: ['亏损', '下滑', '不及预期', '爆雷', '恶化'] },
  { tag: '政策风险', category: 'risk', keywords: ['监管', '处罚', '合规', '反垄断', '调查'] },
  { tag: '财务风险', category: 'risk', keywords: ['负债', '现金流', '债务', '违约', 'st'] },
  { tag: '行业风险', category: 'risk', keywords: ['产能过剩', '价格战', '内卷', '替代'] },
  { tag: '技术风险', category: 'risk', keywords: ['技术迭代', '路线之争', '研发失败'] },
]

const QUALITY_TAG_RULES: TagRule[] = [
  { tag: '深度报告', category: 'quality', keywords: ['深度', '专题', '全面分析', '综合分析'] },
  { tag: '数据详实', category: 'quality', keywords: ['数据', '统计', '调研', '实地'] },
  { tag: '一手信息', category: 'quality', keywords: ['独家', '专访', '调研纪要', '电话会'] },
]

// ============================================================
// 自动打标主函数
// ============================================================

/**
 * 为资料条目自动打标
 *
 * 打标内容：
 * - topicTags: 主题标签（基于关键词匹配）
 * - riskTags: 风险标签（基于风险关键词）
 * - qualityScore: 质量评分（基于来源+内容结构）
 */
export async function autoTagItem(item: ProfileItem): Promise<ProfileItem> {
  const text = `${item.title} ${item.summary}`.toLowerCase()

  // 主题标签
  const topicTags = matchTags(text, TOPIC_TAG_RULES)

  // 风险标签
  const riskTags = matchTags(text, RISK_TAG_RULES)

  // 质量标签
  const qualityTags = matchTags(text, QUALITY_TAG_RULES)

  // 质量评分
  const qualityScore = calculateQualityScore(item, qualityTags)

  const tagged: ProfileItem = {
    ...item,
    topicTags: [...new Set([...(item.topicTags ?? []), ...topicTags])],
    riskTags: [...new Set([...(item.riskTags ?? []), ...riskTags])],
    qualityScore: item.qualityScore ?? qualityScore,
  }

  // 更新标签使用统计
  const allTags = [...topicTags, ...riskTags]
  if (allTags.length > 0) {
    void incrementTagUsage(allTags).catch((err) => {
      logger.warn('[tagService] 更新标签使用统计失败', { error: err.message })
    })
  }

  return tagged
}

/**
 * 根据规则匹配标签
 */
function matchTags(text: string, rules: TagRule[]): string[] {
  const matched: string[] = []
  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matched.push(rule.tag)
        break // 一个标签只要命中一个关键词就算
      }
    }
  }
  return matched
}

/**
 * 计算质量评分（0-100）
 *
 * 评分维度：
 * - 来源权重（40%）
 * - 内容长度（20%）
 * - 结构完整性（20%）
 * - 质量标签加成（20%）
 */
function calculateQualityScore(item: ProfileItem, qualityTags: string[]): number {
  let score = 50 // 基础分

  // 来源权重（40分）
  const sourceWeight = getSourceWeight(item.source)
  score += sourceWeight * 40

  // 内容长度（20分）
  const contentLen = (item.content?.length ?? item.summary.length)
  if (contentLen > 2000) score += 20
  else if (contentLen > 1000) score += 15
  else if (contentLen > 500) score += 10
  else if (contentLen > 200) score += 5

  // 结构完整性（20分）
  if (item.content) score += 10 // 有完整内容
  if (item.sourceUrl) score += 5 // 有来源链接
  if (item.summary.length > 50) score += 5 // 摘要完整

  // 质量标签加成（20分）
  score += qualityTags.length * 8

  return Math.min(100, Math.max(0, Math.round(score)))
}

/**
 * 获取来源权重（0-1）
 */
function getSourceWeight(source: string): number {
  const sourceLower = source.toLowerCase()

  // 权威机构
  const authoritative = [
    '证监会', '交易所', '央行', '国务院', '统计局', '国资委',
    'sec', 'fed', 'pboc',
  ]
  if (authoritative.some((s) => sourceLower.includes(s.toLowerCase()))) return 1.0

  // 头部券商
  const topBrokers = [
    '中信证券', '中金公司', '华泰证券', '国泰君安', '海通证券',
    '广发证券', '招商证券', '中信建投', '申万宏源', '银河证券',
  ]
  if (topBrokers.some((s) => sourceLower.includes(s.toLowerCase()))) return 0.85

  // 主流财经媒体
  const media = [
    '财新', '第一财经', '21世纪经济报道', '证券时报', '中国证券报',
    '上海证券报', '华尔街见闻', '雪球', '东方财富', '同花顺',
    'bloomberg', 'reuters', 'wsj',
  ]
  if (media.some((s) => sourceLower.includes(s.toLowerCase()))) return 0.7

  // 公司公告
  if (sourceLower.includes('公告') || sourceLower.includes('notice')) return 0.9

  // 普通来源
  return 0.5
}

// ============================================================
// 标签库管理
// ============================================================

/**
 * 获取所有标签
 */
export async function listAllTags(category?: TagCategory): Promise<ProfileTag[]> {
  const tags = await queryList<ProfileTag>(STORE_NAME.profileTags)
  if (category) {
    return tags.filter((t) => t.category === category)
  }
  return tags.sort((a, b) => b.usageCount - a.usageCount)
}

/**
 * 按名称查找标签
 */
export async function findTagByName(name: string): Promise<ProfileTag | undefined> {
  const tags = await queryByIndex<ProfileTag>(STORE_NAME.profileTags, 'by-name', name)
  return tags[0]
}

/**
 * 创建自定义标签
 */
export async function createTag(params: {
  name: string
  category: TagCategory
  description?: string
  color?: string
  parentId?: string
}): Promise<ProfileTag> {
  const existing = await findTagByName(params.name)
  if (existing) return existing

  const now = Date.now()
  const tag: ProfileTag = {
    id: nanoid(8),
    name: params.name,
    category: params.category,
    description: params.description,
    color: params.color,
    parentId: params.parentId,
    childrenIds: [],
    usageCount: 0,
    isSystem: false,
    createdAt: now,
    lastUsedAt: now,
  }

  await sendWriteEnvelope('saveProfileTag', tag, 'analyzer')

  // 如果有父标签，更新父标签的 childrenIds
  if (params.parentId) {
    await addChildTag(params.parentId, tag.id)
  }

  return tag
}

/**
 * 删除标签
 */
export async function deleteTag(id: string): Promise<void> {
  await sendWriteEnvelope('deleteProfileTag', { id }, 'analyzer')
}

/**
 * 增加标签使用次数
 */
export async function incrementTagUsage(tagNames: string[]): Promise<void> {
  for (const name of tagNames) {
    const tag = await findTagByName(name)
    if (tag) {
      const updated: ProfileTag = {
        ...tag,
        usageCount: tag.usageCount + 1,
        lastUsedAt: Date.now(),
      }
      await sendWriteEnvelope('saveProfileTag', updated, 'analyzer')
    }
  }
}

/**
 * 添加子标签
 */
async function addChildTag(parentId: string, childId: string): Promise<void> {
  const parent = await queryGet<ProfileTag>(STORE_NAME.profileTags, parentId)
  if (parent) {
    const updated: ProfileTag = {
      ...parent,
      childrenIds: [...(parent.childrenIds ?? []), childId],
    }
    await sendWriteEnvelope('saveProfileTag', updated, 'analyzer')
  }
}

/**
 * 初始化系统内置标签
 */
export async function seedSystemTags(): Promise<void> {
  const existing = await listAllTags()
  if (existing.length > 0) return // 已初始化

  const now = Date.now()
  const systemTags: ProfileTag[] = [
    // 主题标签
    ...TOPIC_TAG_RULES.map((rule, i) => ({
      id: `sys_topic_${i}`,
      name: rule.tag,
      category: rule.category as TagCategory,
      usageCount: 0,
      isSystem: true,
      createdAt: now,
    })),
    // 风险标签
    ...RISK_TAG_RULES.map((rule, i) => ({
      id: `sys_risk_${i}`,
      name: rule.tag,
      category: rule.category as TagCategory,
      usageCount: 0,
      isSystem: true,
      createdAt: now,
    })),
    // 质量标签
    ...QUALITY_TAG_RULES.map((rule, i) => ({
      id: `sys_quality_${i}`,
      name: rule.tag,
      category: rule.category as TagCategory,
      usageCount: 0,
      isSystem: true,
      createdAt: now,
    })),
  ] as ProfileTag[]

  for (const tag of systemTags) {
    await sendWriteEnvelope('saveProfileTag', tag, 'analyzer')
  }

  logger.info(`[tagService] 系统标签初始化完成`, { count: systemTags.length })
}
