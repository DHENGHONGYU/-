/**
 * 八域资料体系 - 资料条目服务
 *
 * 提供资料条目的 CRUD、查询、去重、统计等核心功能，
 * 是所有同步适配器（新闻/研报/公告/社区/本地文档/评分报告）的统一写入入口。
 *
 * @module services/profile/profileService
 * @created 2026-07-21
 * @doc [V9-DOC-DATA-028, V9-DOC-DATA-029]
 */

import { getLogger } from '@/lib/logger'
import { STORE_NAME } from '@/config/dbConfig'
import { sendWriteEnvelope, queryByIndex, queryGet } from '@/data/dataLayerHelpers'
import type {
  ProfileItem,
  ProfileDomain,
  ProfileItemType,
  ProfileQueryFilter,
  ScoreLayerId,
  SentimentLabel,
  StockProfile,
  SyncOptions,
  SyncResult,
} from '@/data/types/types.profile'
import { DOMAIN_META } from '@/data/types/types.profile'
import { autoTagItem } from './tagService'
import { ragRetriever } from '@/services/scoring/v6-engine/ragRetriever'

const logger = getLogger()

// ============================================================
// 辅助：FNV-1a 32位哈希（用于去重）
// ============================================================

function fnv1a32(str: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return hash >>> 0
}

/**
 * 生成资料条目的 dataHash（基于标题+摘要）
 */
export function computeDataHash(title: string, summary: string): number {
  return fnv1a32(`${title.trim().toLowerCase()}|${summary.trim().toLowerCase()}`)
}

/**
 * 生成资料条目 ID
 */
export function makeProfileItemId(
  symbol: string,
  domain: ProfileDomain,
  itemType: ProfileItemType,
  dataHash: number,
): string {
  return `${symbol}_${domain}_${itemType}_${dataHash}`
}

// ============================================================
// 写入操作
// ============================================================

/**
 * 保存单条资料条目
 *
 * 自动补齐：
 * - collectedAt（如缺失）
 * - dataHash（如缺失，基于 title+summary 计算）
 * - id（如缺失，基于 symbol+domain+itemType+dataHash）
 * - relatedLayers（如缺失，基于 domain 推导）
 * - sentiment（默认 neutral）
 * - 自动打标（如开启）
 */
export async function saveProfileItem(
  item: Partial<ProfileItem> & Pick<ProfileItem, 'symbol' | 'domain' | 'itemType' | 'title' | 'summary'>,
  options: { autoTag?: boolean } = {},
): Promise<ProfileItem> {
  const finalItem = await prepareItem(item, options)
  await sendWriteEnvelope('saveProfileItem', finalItem, 'analyzer')

  // ── RAG: 自动添加到向量索引（异步，不阻塞主流程） ──
  if (finalItem.content && finalItem.content.length > 50) {
    ragRetriever.addDocument(finalItem).catch((err) => {
      logger.warn('[ProfileService] RAG 索引更新失败', { itemId: finalItem.id, error: err })
    })
  }

  return finalItem
}

/**
 * 批量保存资料条目
 *
 * 内部已处理去重（基于 dataHash 检查已存在条目）。
 * 返回 SyncResult 统计信息。
 */
export async function bulkSaveProfileItems(
  items: Array<Partial<ProfileItem> & Pick<ProfileItem, 'symbol' | 'domain' | 'itemType' | 'title' | 'summary'>>,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const { skipDuplicates = true, minQuality = 0, autoTag = true } = options

  const result: SyncResult = {
    saved: 0,
    skippedDuplicates: 0,
    skippedLowQuality: 0,
    failed: 0,
    failures: [],
  }

  if (items.length === 0) return result

  const firstItem = items[0]!
  const symbol = firstItem.symbol
  const toSave: ProfileItem[] = []

  for (const item of items) {
    try {
      // 质量过滤
      if (minQuality > 0 && (item.qualityScore ?? 0) < minQuality) {
        result.skippedLowQuality++
        continue
      }

      const prepared = await prepareItem(item, { autoTag })

      // 去重检查
      if (skipDuplicates) {
        const exists = await checkDuplicate(item.symbol, prepared.dataHash)
        if (exists) {
          result.skippedDuplicates++
          continue
        }
      }

      toSave.push(prepared)
    } catch (err) {
      result.failed++
      result.failures?.push({
        title: item.title,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (toSave.length > 0) {
    try {
      await sendWriteEnvelope('bulkSaveProfileItems', toSave, 'analyzer')
      result.saved = toSave.length
    } catch (err) {
      result.failed += toSave.length
      for (const item of toSave) {
        result.failures?.push({
          title: item.title,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  // 更新资料包统计
  if (result.saved > 0 && symbol) {
    void updateProfileStats(symbol).catch((err) => {
      logger.warn('[profileService] 更新资料包统计失败', { symbol, error: err instanceof Error ? err.message : String(err) })
    })

    // ── RAG: 批量添加到向量索引（异步，不阻塞主流程） ──
    for (const item of toSave) {
      if (item.content && item.content.length > 50) {
        ragRetriever.addDocument(item).catch((err) => {
          logger.warn('[ProfileService] RAG 批量索引更新失败', { itemId: item.id, error: err })
        })
      }
    }
  }

  logger.info(`[profileService] 批量保存完成`, {
    symbol,
    total: items.length,
    saved: result.saved,
    skippedDuplicates: result.skippedDuplicates,
    skippedLowQuality: result.skippedLowQuality,
    failed: result.failed,
  })

  return result
}

/**
 * 准备资料条目（补齐缺失字段 + 自动打标）
 */
async function prepareItem(
  item: Partial<ProfileItem> & Pick<ProfileItem, 'symbol' | 'domain' | 'itemType' | 'title' | 'summary'>,
  options: { autoTag?: boolean },
): Promise<ProfileItem> {
  const now = Date.now()
  const dataHash = item.dataHash ?? computeDataHash(item.title, item.summary)
  const id = item.id ?? makeProfileItemId(item.symbol, item.domain, item.itemType, dataHash)

  // 基于 domain 推导默认 relatedLayers
  const relatedLayers = item.relatedLayers ?? DOMAIN_META[item.domain].layers

  const baseItem: ProfileItem = {
    id,
    symbol: item.symbol,
    domain: item.domain,
    itemType: item.itemType,
    subType: item.subType,
    title: item.title,
    summary: item.summary,
    content: item.content,
    author: item.author,
    source: item.source ?? 'unknown',
    sourceUrl: item.sourceUrl,
    publishedAt: item.publishedAt ?? now,
    collectedAt: item.collectedAt ?? now,
    sentiment: item.sentiment ?? 'neutral',
    sentimentConfidence: item.sentimentConfidence,
    qualityScore: item.qualityScore,
    dataQuality: item.dataQuality,
    evidenceWeight: item.evidenceWeight,
    relatedLayers,
    topicTags: item.topicTags,
    riskTags: item.riskTags,
    catalystTags: item.catalystTags,
    customTags: item.customTags,
    dataHash,
    sourceId: item.sourceId,
    originalStore: item.originalStore,
    originalKey: item.originalKey,
    isUserGenerated: item.isUserGenerated,
    crossReferences: item.crossReferences,
    viewCount: item.viewCount ?? 0,
    isBookmarked: item.isBookmarked ?? false,
    evidenceIds: item.evidenceIds,
    schemaVersion: item.schemaVersion ?? 1,
    version: item.version ?? 1,
  }

  // 自动打标
  if ((options.autoTag ?? false) === true) {
    try {
      return await autoTagItem(baseItem)
    } catch (err) {
      logger.warn('[profileService] 自动打标失败', { itemId: id, error: err instanceof Error ? err.message : String(err) })
      return baseItem
    }
  }

  return baseItem
}

/**
 * 检查重复（基于 symbol + dataHash）
 */
async function checkDuplicate(symbol: string, dataHash: number): Promise<boolean> {
  try {
    const existing = await queryByIndex<ProfileItem>(STORE_NAME.profileItems, 'by-hash', dataHash)
    return existing.some((item) => item.symbol === symbol)
  } catch {
    return false
  }
}

/**
 * 删除资料条目
 */
export async function deleteProfileItem(id: string): Promise<void> {
  await sendWriteEnvelope('deleteProfileItem', { id }, 'analyzer')
}

// ============================================================
// 查询操作
// ============================================================

/**
 * 根据 ID 获取单条资料
 */
export async function getProfileItem(id: string): Promise<ProfileItem | undefined> {
  return queryGet<ProfileItem>(STORE_NAME.profileItems, id)
}

/**
 * 按股票代码列出所有资料（按质量分降序）
 */
export async function listProfileItemsBySymbol(symbol: string, limit?: number): Promise<ProfileItem[]> {
  const items = await queryByIndex<ProfileItem>(STORE_NAME.profileItems, 'by-symbol', symbol)
  const sorted = items.sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0))
  if (typeof limit === 'number' && limit > 0) return sorted.slice(0, limit)
  return sorted
}

/**
 * 按域列出资料
 */
export async function listProfileItemsByDomain(
  symbol: string,
  domain: ProfileDomain,
  limit?: number,
): Promise<ProfileItem[]> {
  const items = await queryByIndex<ProfileItem>(
    STORE_NAME.profileItems,
    'by-symbol-domain-quality',
    [symbol, domain],
  )
  if (typeof limit === 'number' && limit > 0) return items.slice(0, limit)
  return items
}

/**
 * 按类型列出资料
 */
export async function listProfileItemsByType(
  symbol: string,
  itemType: ProfileItemType,
  limit?: number,
): Promise<ProfileItem[]> {
  const items = await queryByIndex<ProfileItem>(STORE_NAME.profileItems, 'by-symbol-type', [symbol, itemType])
  if (typeof limit === 'number' && limit > 0) return items.slice(0, limit)
  return items
}

/**
 * 综合查询（支持多条件筛选）
 */
export async function queryProfileItems(filter: ProfileQueryFilter): Promise<ProfileItem[]> {
  const {
    symbol,
    domain,
    itemType,
    sentiment,
    minQuality,
    source,
    keyword,
    limit,
    sortBy = 'publishedAt',
    sortOrder = 'desc',
  } = filter

  // 基础查询：按 symbol-domain-quality 索引
  let items: ProfileItem[]
  if (domain) {
    items = await queryByIndex<ProfileItem>(STORE_NAME.profileItems, 'by-symbol-domain-quality', [symbol, domain])
  } else if (itemType) {
    items = await queryByIndex<ProfileItem>(STORE_NAME.profileItems, 'by-symbol-type', [symbol, itemType])
  } else {
    items = await queryByIndex<ProfileItem>(STORE_NAME.profileItems, 'by-symbol', symbol)
  }

  // 客户端筛选
  if (sentiment) {
    items = items.filter((i) => i.sentiment === sentiment)
  }
  if (typeof minQuality === 'number' && minQuality > 0) {
    const minQ = minQuality
    items = items.filter((i) => (i.qualityScore ?? 0) >= minQ)
  }
  if ((source ?? '') !== '') {
    items = items.filter((i) => i.source === source)
  }
  if ((keyword ?? '').trim() !== '') {
    const kw = keyword!.toLowerCase()
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(kw) ||
        i.summary.toLowerCase().includes(kw) ||
        ((i.topicTags ?? []).some((t) => t.toLowerCase().includes(kw))),
    )
  }

  // 排序
  items.sort((a, b) => {
    const av = a[sortBy] ?? 0
    const bv = b[sortBy] ?? 0
    return sortOrder === 'desc' ? (bv) - (av) : (av) - (bv)
  })

  if (typeof limit === 'number' && limit > 0) return items.slice(0, limit)
  return items
}

// ============================================================
// 统计操作
// ============================================================

/**
 * 计算各域资料数量
 */
export async function getDomainCounts(symbol: string): Promise<Record<ProfileDomain, number>> {
  const items = await queryByIndex<ProfileItem>(STORE_NAME.profileItems, 'by-symbol', symbol)
  const counts: Record<ProfileDomain, number> = {
    D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0, D7: 0, D8: 0,
  }
  for (const item of items) {
    counts[item.domain]++
  }
  return counts
}

/**
 * 计算各类型资料数量
 */
export async function getTypeCounts(symbol: string): Promise<Record<string, number>> {
  const items = await queryByIndex<ProfileItem>(STORE_NAME.profileItems, 'by-symbol', symbol)
  const counts: Record<string, number> = {}
  for (const item of items) {
    counts[item.itemType] = (counts[item.itemType] ?? 0) + 1
  }
  return counts
}

// ============================================================
// 资料包操作
// ============================================================

/**
 * 获取股票资料包元数据
 */
export async function getStockProfile(symbol: string): Promise<StockProfile | null> {
  const profile = await queryGet<StockProfile>(STORE_NAME.stockProfiles, symbol)
  return profile ?? null
}

/**
 * 获取或创建资料包
 */
export async function getOrCreateProfile(symbol: string, stockName?: string): Promise<StockProfile> {
  const existing = await getStockProfile(symbol)
  if (existing) return existing

  const now = Date.now()
  const profile: StockProfile = {
    symbol,
    stockName: stockName ?? symbol,
    totalItems: 0,
    domainCounts: { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0, D7: 0, D8: 0 },
    typeCounts: {},
    totalEvidence: 0,
    layerEvidenceCounts: {
      lMinus1: 0, l0: 0, l1: 0, l2: 0, l3f: 0, l3v: 0,
      l4: 0, l5: 0, l6: 0, l7: 0, l8: 0,
    },
    evidenceCoverage: 0,
    lastUpdatedAt: now,
    lastSyncSources: [],
  }

  await sendWriteEnvelope('saveStockProfile', profile, 'analyzer')
  return profile
}

/**
 * 更新资料包统计信息（重新计算）
 */
export async function updateProfileStats(symbol: string): Promise<StockProfile> {
  const profile = await getOrCreateProfile(symbol)
  const [domainCounts, typeCounts] = await Promise.all([
    getDomainCounts(symbol),
    getTypeCounts(symbol),
  ])

  const totalItems = Object.values(domainCounts).reduce((a, b) => a + b, 0)
  const now = Date.now()

  // 计算平均质量分
  const items = await listProfileItemsBySymbol(symbol)
  const avgQualityScore = items.length > 0
    ? items.reduce((sum, i) => sum + (i.qualityScore ?? 0), 0) / items.length
    : undefined

  const updated: StockProfile = {
    ...profile,
    totalItems,
    domainCounts,
    typeCounts,
    avgQualityScore,
    lastUpdatedAt: now,
  }

  await sendWriteEnvelope('saveStockProfile', updated, 'analyzer')
  return updated
}

// ============================================================
// 域 ↔ 评分层 映射工具
// ============================================================

/**
 * 域 → 评分层映射
 */
export function domainToLayers(domain: ProfileDomain): ScoreLayerId[] {
  return DOMAIN_META[domain].layers
}

/**
 * 评分层 → 域映射
 */
export function layerToDomain(layer: ScoreLayerId): ProfileDomain {
  const mapping: Partial<Record<ScoreLayerId, ProfileDomain>> = {
    lMinus1: 'D1',
    l0: 'D2',
    l1: 'D3',
    l2: 'D4',
    l3f: 'D5',
    l3v: 'D6',
    l4: 'D7',
    l5: 'D7',
    l6: 'D7',
    l7: 'D8',
    l8: 'D8',
  }
  return mapping[layer] ?? 'D3'
}

// ============================================================
// 情绪映射工具
// ============================================================

/**
 * 从文本推断情绪（简单关键词法）
 */
export function inferSentiment(text: string): { sentiment: SentimentLabel; confidence: number } {
  const lower = text.toLowerCase()

  const positiveWords = [
    '增长', '上涨', '利好', '突破', '超预期', '增持', '买入', '推荐',
    '看好', '强劲', '优秀', '改善', '提升', '创新高', '爆发',
    'growth', 'rise', 'bullish', 'buy', 'outperform', 'strong',
  ]
  const negativeWords = [
    '下跌', '亏损', '利空', '下滑', '减持', '卖出', '降级',
    '风险', '恶化', '下降', '疲软', '低迷', '暴雷', '违约',
    'decline', 'fall', 'bearish', 'sell', 'underperform', 'weak',
    'risk', 'loss',
  ]

  let posCount = 0
  let negCount = 0

  for (const word of positiveWords) {
    if (lower.includes(word)) posCount++
  }
  for (const word of negativeWords) {
    if (lower.includes(word)) negCount++
  }

  const total = posCount + negCount
  if (total === 0) {
    return { sentiment: 'neutral', confidence: 0.3 }
  }

  const confidence = Math.min(0.9, 0.3 + total * 0.15)
  if (posCount > negCount) {
    return { sentiment: 'positive', confidence }
  } else if (negCount > posCount) {
    return { sentiment: 'negative', confidence }
  } else {
    return { sentiment: 'neutral', confidence: confidence * 0.5 }
  }
}
