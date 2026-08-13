/**
 * 新闻 → 资料条目 同步适配器
 *
 * 将现有 news store 的新闻文章自动同步到八域资料体系的 profile_items，
 * 实现"数据不重复存储，资料体系增量构建"的目标。
 *
 * 设计原则（第一性原则）：
 * - 不重复存储内容：资料条目通过 contentRef 指向原始 news store
 * - 不侵入采集流程：异步/按需同步，不影响新闻采集性能
 * - 增量同步：基于时间戳，只同步新增/更新的新闻
 * - 自动分类：根据关键词/行业/情绪将新闻分到 D1-D8 各域
 *
 * @module services/profile
 * @updated 2026-07-20
 * @doc [V9-DOC-DATA-028]
 */

import { getLogger } from '@/lib/logger'
import type { NewsArticle, NewsStockMap, ProfileItem, ProfileDomain, ScoreLayerId } from '@/data/types'
import { ENVELOPE_ACTION, MODULE_ID, STORE_NAME } from '@/config/dbConfig'
import { dataBridge } from '@/core/databridge'
import { autoTagItem } from './tagService'

const logger = getLogger()

// ============================================================
// 新闻分类规则（关键词 → 域映射）
// ============================================================

/** 各域的关键词匹配规则 */
const DOMAIN_KEYWORDS: Record<ProfileDomain, string[]> = {
  D1: [ // 行业产业
    '行业', '产业', '景气度', '产能', '供需', '产业链', '上游', '下游',
    '市场规模', '渗透率', '竞争格局', '集中度', 'CR', '市占率',
  ],
  D2: [ // 宏观环境
    'GDP', 'CPI', 'PPI', '利率', '加息', '降息', '降准', '货币政策',
    '美联储', '央行', '汇率', '人民币', '美元', '通胀', '通缩',
    '经济', '宏观', '财政', '基建', '地产政策',
  ],
  D3: [ // 公司基本面
    '年报', '中报', '季报', '业绩', '营收', '净利润', '毛利率',
    '主营业务', '商业模式', '护城河', '竞争力', '产能扩张', '新产品',
    '技术突破', '专利', '研发',
  ],
  D4: [ // 竞争对比
    '竞品', '竞争对手', '对比', 'PK', '超越', '落后', '份额',
    '排名', '第一', '龙头', '赶超', '价格战',
  ],
  D5: [ // 财务分析
    '财报', '财务', '资产负债', '现金流', '杜邦', 'ROE', 'ROA',
    '负债率', '偿债', '分红', '股息', '每股收益', 'EPS', 'PE', 'PB',
  ],
  D6: [ // 估值定价
    '估值', 'PE', 'PB', 'PEG', '目标价', '评级', '买入', '卖出',
    '增持', '减持', '低估', '高估', '合理估值', '一致预期',
  ],
  D7: [ // 成长前沿
    '增长', '成长', '第二曲线', '新业务', '新品类', '新市场',
    '情景分析', '情景推演', '空间', '天花板', '渗透率提升',
    'Hype', '炒作', '概念', '题材',
  ],
  D8: [ // 市场信号
    '涨停', '跌停', '大涨', '大跌', '成交量', '换手率', '资金流入',
    '资金流出', '北向', '南向', '主力', '散户', '筹码', '技术面',
    'MACD', 'KDJ', '均线', '支撑位', '压力位', '社区', '股吧',
  ],
}

// ============================================================
// 新闻 → 域 分类器
// ============================================================

/**
 * 根据新闻标题和内容，自动分类到 D1-D8 域
 *
 * 算法：关键词匹配 + 权重投票，取最高分的域
 * 若所有域得分都很低，默认分到 D7（成长前沿，新闻默认域）
 */
export function classifyNewsToDomain(article: Pick<NewsArticle, 'title' | 'content' | 'category'>): ProfileDomain {
  const text = `${article.title} ${article.content}`.toLowerCase()
  const scores: Record<ProfileDomain, number> = {
    D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0, D7: 0, D8: 0,
  }

  for (const domain of Object.keys(DOMAIN_KEYWORDS) as ProfileDomain[]) {
    for (const keyword of DOMAIN_KEYWORDS[domain]) {
      if (text.includes(keyword.toLowerCase())) {
        scores[domain] += 1
      }
    }
  }

  // 标题命中权重加倍
  const title = article.title.toLowerCase()
  for (const domain of Object.keys(DOMAIN_KEYWORDS) as ProfileDomain[]) {
    for (const keyword of DOMAIN_KEYWORDS[domain]) {
      if (title.includes(keyword.toLowerCase())) {
        scores[domain] += 1
      }
    }
  }

  // 找出最高分的域
  let maxDomain: ProfileDomain = 'D7' // 默认
  let maxScore = 0

  for (const domain of Object.keys(scores) as ProfileDomain[]) {
    if (scores[domain] > maxScore) {
      maxScore = scores[domain]
      maxDomain = domain
    }
  }

  // 得分太低（<2）时，根据 category 做二次判断
  if (maxScore < 2 && article.category) {
    const cat = article.category.toLowerCase()
    if (cat.includes('宏观') || cat.includes('经济')) maxDomain = 'D2'
    else if (cat.includes('公司') || cat.includes('公告')) maxDomain = 'D3'
    else if (cat.includes('财务') || cat.includes('财报')) maxDomain = 'D5'
    else if (cat.includes('行业')) maxDomain = 'D1'
    else if (cat.includes('市场') || cat.includes('行情')) maxDomain = 'D8'
  }

  return maxDomain
}

// ============================================================
// 新闻 → 资料条目 转换器
// ============================================================

/**
 * 将新闻文章转换为资料条目
 *
 * 特点：
 * - 不重复存储内容：summary 存摘要，正文按需从 news store 加载
 * - 自动分类到域
 * - 自动打标（情绪/质量/主题）
 * - 保留原始引用（originalStore + originalKey）
 */
export async function newsToProfileItem(
  article: NewsArticle,
  symbol: string,
  options: { domain?: ProfileDomain; relevanceScore?: number } = {},
): Promise<Omit<ProfileItem, 'id' | 'dataHash' | 'collectedAt' | 'schemaVersion' | 'version'>> {
  const domain = options.domain ?? classifyNewsToDomain(article)
  const publishTime = new Date(article.publishTime).getTime()

  // 质量评分：基础分 + 来源加权 + 相关性
  let qualityScore = 50
  const sourceBonus: Record<string, number> = {
    '新华社': 25, '人民日报': 25, '证券时报': 20, '上海证券报': 20,
    '中国证券报': 20, '财新': 20, '第一财经': 15, '东方财富': 10,
  }
  qualityScore += sourceBonus[article.source] ?? 0
  qualityScore += (options.relevanceScore ?? 0.5) * 20
  qualityScore = Math.max(10, Math.min(100, qualityScore))

  const item: Omit<ProfileItem, 'id' | 'dataHash' | 'collectedAt' | 'schemaVersion' | 'version'> = {
    symbol,
    domain,
    itemType: 'news',
    title: article.title,
    summary: article.content.slice(0, 200),
    source: article.source,
    sourceUrl: article.url,
    publishedAt: isNaN(publishTime) ? Date.now() : publishTime,
    sentiment: article.sentiment,
    qualityScore,
    dataQuality: qualityScore >= 70 ? 'high' : qualityScore >= 40 ? 'medium' : 'low',
    topicTags: article.keywords?.slice(0, 5) ?? [],
    relatedLayers: domainToLayers(domain),
    evidenceWeight: Math.max(0.1, Math.min(0.6, qualityScore / 100 * 0.6)),
    isUserGenerated: false,
    originalStore: STORE_NAME.news,
    originalKey: article.id,
  }

  // 自动打标补充
  return (await autoTagItem(item as ProfileItem))
}

// ============================================================
// 批量同步：新闻 → 资料条目
// ============================================================

/**
 * 将某只股票的新闻批量同步到资料体系
 *
 * 流程：
 * 1. 从 newsStockMap 查询关联的新闻 ID
 * 2. 从 news store 读取新闻详情
 * 3. 分类到各域 + 自动打标
 * 4. 批量写入 profile_items（带去重）
 *
 * @param symbol 股票代码
 * @param options.limit 最多同步多少条（默认 50）
 * @returns 同步的条目数
 */
export async function syncNewsToProfile(
  symbol: string,
  options: { limit?: number } = {},
): Promise<number> {
  const { limit = 50 } = options

  try {
    logger.info(`[newsSync] 开始同步新闻到资料体系`, { symbol, limit })

    // 1. 查询股票-新闻关联
    const mapResult = await dataBridge.query<NewsStockMap[]>({
      action: ENVELOPE_ACTION.queryByIndex,
      store: STORE_NAME.newsStockMap,
      indexName: 'by-symbol-relevance',
      indexValue: [symbol],
      source: MODULE_ID.analyzer,
    })

    if (!mapResult.success || !mapResult.data || mapResult.data.length === 0) {
      logger.info(`[newsSync] 无关联新闻，跳过`, { symbol })
      return 0
    }

    const stockMaps = mapResult.data.slice(0, limit)

    // 2. 读取新闻详情
    const articles: NewsArticle[] = []
    for (const map of stockMaps) {
      const newsResult = await dataBridge.query<NewsArticle>({
        action: ENVELOPE_ACTION.queryGet,
        store: STORE_NAME.news,
        key: map.newsId,
        source: MODULE_ID.analyzer,
      })
      if (newsResult.success && newsResult.data) {
        articles.push(newsResult.data)
      }
    }

    if (articles.length === 0) {
      logger.info(`[newsSync] 未找到新闻详情，跳过`, { symbol })
      return 0
    }

    // 3. 转换为资料条目
    const profileItems = await Promise.all(
      articles.map((article, index) =>
        newsToProfileItem(article, symbol, {
          relevanceScore: stockMaps[index]?.relevanceScore,
        }),
      ),
    )

    // 4. 批量写入
    const { bulkSaveProfileItems } = await import('./profileService')
    await bulkSaveProfileItems(profileItems)

    logger.info(`[newsSync] 新闻同步完成`, {
      symbol,
      syncedCount: profileItems.length,
      totalNews: articles.length,
    })

    return profileItems.length
  } catch (err) {
    logger.warn(`[newsSync] 新闻同步失败`, {
      symbol,
      error: err instanceof Error ? err.message : String(err),
    })
    return 0
  }
}

// ============================================================
// 辅助函数
// ============================================================

/** 域 → 评分层映射（从 profileService 复用，但这里避免循环引用） */
function domainToLayers(domain: ProfileDomain): ScoreLayerId[] {
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

// 防止 logger 报 unused
void logger
