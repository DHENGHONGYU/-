/**
 * 八域资料体系 - 公告同步适配器
 *
 * 将公司公告数据同步到八域资料体系。
 * 公告是高权威度的一手信息，主要归属：
 * - D3 公司基本面：业绩公告、经营公告、重大合同
 * - D5 财务分析：财报、分红、增发
 * - D8 市场信号：停复牌、增减持、回购
 * - D7 成长前沿：并购重组、新项目
 *
 * @module services/profile/noticeSyncService
 * @created 2026-07-21
 * @doc [V9-DOC-DATA-028]
 */

import { getLogger } from '@/lib/logger'
import type { NewsItem } from '@/services/data-collector/dimensionDataTypes'
import type {
  ProfileDomain,
  ProfileItem,
  ScoreLayerId,
  SentimentLabel,
  SyncOptions,
  SyncResult,
} from '@/data/types/types.profile'
import { bulkSaveProfileItems } from './profileService'
import { autoTagItem } from './tagService'

const logger = getLogger()

// ============================================================
// 公告类型 → 域映射
// ============================================================

interface NoticeClassification {
  domain: ProfileDomain
  layers: ScoreLayerId[]
  sentiment?: SentimentLabel
  qualityBase: number
}

/**
 * 根据公告标题关键词分类到八域
 *
 * 公告是权威度最高的一手资料，默认质量分 80+。
 */
export function classifyNoticeToDomain(notice: Pick<NewsItem, 'title' | 'category'>): NoticeClassification {
  const title = notice.title.toLowerCase()

  // D5 财务分析类公告
  if (
    title.includes('年报') || title.includes('半年报') || title.includes('季报') ||
    title.includes('业绩') || title.includes('财报') || title.includes('财务') ||
    title.includes('分红') || title.includes('派息') || title.includes('转增') ||
    title.includes('增发') || title.includes('配股') || title.includes('可转债')
  ) {
    return {
      domain: 'D5',
      layers: ['l3f'],
      qualityBase: 90,
    }
  }

  // D8 市场信号类公告
  if (
    title.includes('停牌') || title.includes('复牌') || title.includes('停复牌') ||
    title.includes('增持') || title.includes('减持') || title.includes('回购') ||
    title.includes('股权激励') || title.includes('员工持股') ||
    title.includes('股东') || title.includes('实控人') || title.includes('股权变更')
  ) {
    let sentiment: SentimentLabel = 'neutral'
    if (title.includes('增持') || title.includes('回购')) sentiment = 'positive'
    if (title.includes('减持')) sentiment = 'negative'

    return {
      domain: 'D8',
      layers: ['l7'],
      sentiment,
      qualityBase: 88,
    }
  }

  // D7 成长前沿类公告
  if (
    title.includes('并购') || title.includes('重组') || title.includes('收购') ||
    title.includes('新项目') || title.includes('投资') || title.includes('产能') ||
    title.includes('战略合作') || title.includes('框架协议') ||
    title.includes('中标') || title.includes('重大合同')
  ) {
    return {
      domain: 'D7',
      layers: ['l4'],
      sentiment: 'positive',
      qualityBase: 85,
    }
  }

  // D3 公司基本面类公告（经营相关）
  if (
    title.includes('经营') || title.includes('主营业务') || title.includes('产品') ||
    title.includes('技术') || title.includes('专利') || title.includes('研发') ||
    title.includes('投产') || title.includes('上线') || title.includes('发布')
  ) {
    return {
      domain: 'D3',
      layers: ['l1'],
      qualityBase: 82,
    }
  }

  // D2 政策监管类公告
  if (
    title.includes('监管') || title.includes('处罚') || title.includes('问询函') ||
    title.includes('关注函') || title.includes('警示') || title.includes('合规')
  ) {
    return {
      domain: 'D2',
      layers: ['l0'],
      sentiment: 'negative',
      qualityBase: 85,
    }
  }

  // 默认 D3 公司基本面
  return {
    domain: 'D3',
    layers: ['l1'],
    qualityBase: 75,
  }
}

// ============================================================
// 公告 → ProfileItem 转换
// ============================================================

/**
 * 将公告转换为资料条目
 */
export async function noticeToProfileItem(
  notice: NewsItem,
  symbol: string,
): Promise<Omit<ProfileItem, 'id' | 'version' | 'dataHash' | 'collectedAt' | 'schemaVersion'>> {
  const classification = classifyNoticeToDomain(notice)

  const item = {
    symbol,
    domain: classification.domain,
    itemType: 'notice' as const,
    subType: notice.category,
    title: notice.title,
    summary: notice.content?.slice(0, 200) ?? notice.title,
    content: notice.content,
    source: notice.source || '公司公告',
    sourceUrl: notice.url,
    publishedAt: new Date(notice.date).getTime() || Date.now(),
    sentiment: classification.sentiment ?? notice.sentiment ?? 'neutral',
    sentimentConfidence: classification.sentiment ? 0.9 : 0.6,
    qualityScore: classification.qualityBase,
    relatedLayers: classification.layers,
    topicTags: [],
    riskTags: [],
    evidenceWeight: 0.85, // 公告权威度高
    isUserGenerated: false,
    originalStore: 'news',
    originalKey: notice.id,
    sourceId: notice.id,
  }

  // 自动打标
  return autoTagItem(item as unknown as ProfileItem)
}

// ============================================================
// 批量同步
// ============================================================

/**
 * 批量同步公告到资料体系
 */
export async function syncNoticesToProfile(
  symbol: string,
  notices: NewsItem[],
  options: SyncOptions = {},
): Promise<SyncResult> {
  const { skipDuplicates = true, minQuality = 0 } = options

  logger.info(`[noticeSync] 开始同步公告到资料体系`, {
    symbol,
    count: notices.length,
  })

  const items: Array<Omit<ProfileItem, 'id' | 'version' | 'dataHash' | 'collectedAt' | 'schemaVersion'>> = []

  for (const notice of notices) {
    try {
      const item = await noticeToProfileItem(notice, symbol)
      items.push(item)
    } catch (err) {
      logger.warn(`[noticeSync] 公告转换失败`, {
        noticeId: notice.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const result = await bulkSaveProfileItems(items, {
    skipDuplicates,
    minQuality,
    autoTag: false, // 已在转换时打标
  })

  logger.info(`[noticeSync] 同步完成`, {
    symbol,
    saved: result.saved,
    skippedDuplicates: result.skippedDuplicates,
    failed: result.failed,
  })

  return result
}

// ============================================================
// 单条保存
// ============================================================

/**
 * 保存单条公告为资料条目
 */
export async function saveNoticeAsProfileItem(
  notice: NewsItem,
  symbol: string,
): Promise<ProfileItem> {
  const item = await noticeToProfileItem(notice, symbol)
  const { saveProfileItem } = await import('./profileService')
  return saveProfileItem(item)
}
