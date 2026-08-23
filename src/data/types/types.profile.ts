/**
 * @fileoverview 八域资料体系类型定义
 *
 * 八域资料体系（ADR-010）：将分散的资讯、研报、公告、社区帖、评分报告等
 * 统一归集到 8 个研究域（D1-D8），每域对应 V6 评分模型的一个或多个层级，
 * 形成"资料 → 证据 → 评分"的完整证据链。
 *
 * 域映射：
 *   D1 行业产业 → l1 行业评分 / l0 宏观环境
 *   D2 政策监管 → l0 宏观环境
 *   D3 公司基本面 → l1 护城河
 *   D4 竞争对比 → l2 竞品格局
 *   D5 财务分析 → l3f 财务健康
 *   D6 估值定价 → l3v 估值水平
 *   D7 成长前沿 → l4 第二曲线 / l5 情景推演 / l6 业绩兑现
 *   D8 市场信号 → l7 筹码博弈 / l8 技术面
 *
 * @module data/types/types.profile
 * @created 2026-07-21
 * @doc [V9-DOC-DATA-028, V9-DOC-DATA-029, V9-DOC-DATA-030, V9-DOC-DATA-031]
 */

import { COLOR_SHADES } from '@/constants/theme.tokens'

// ============================================================
// 核心枚举
// ============================================================

/** 八域标识 */
export type ProfileDomain = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8'

/** 资料条目类型 */
export type ProfileItemType =
  | 'news'              // 新闻资讯
  | 'research_report'    // 券商研报
  | 'notice'            // 公司公告
  | 'community_post'     // 社区帖子
  | 'community'          // 社区帖子（兼容旧命名）
  | 'local_doc'          // 本地文档
  | 'financial_report'   // 财务报告
  | 'industry_report'    // 行业报告
  | 'score_doc'          // 评分文档
  | 'score_report'       // 评分综合报告
  | 'score_layer'        // 评分分层报告
  | 'score_diff'         // 评分版本差异
  | 'derived_metric'     // 衍生指标
  | 'analysis_note'      // 研究笔记
  | 'note'               // 笔记（兼容旧命名）
  | 'other'              // 其他

/** 情绪标签 */
export type SentimentLabel = 'positive' | 'neutral' | 'negative'

/** 证据类型 */
export type EvidenceType =
  | 'profile_item'      // 资料条目型证据
  | 'derived_metric'    // 衍生指标型证据
  | 'expert_judgment'   // 专家判断型证据

/** 评分层 ID（V6 评分模型 11 层，小写命名） */
export type ScoreLayerId =
  | 'lMinus1'  // L-1 行业评分
  | 'l0'       // L0 宏观环境
  | 'l1'       // L1 护城河
  | 'l2'       // L2 竞品格局
  | 'l3f'      // L3f 财务健康
  | 'l3v'      // L3v 估值水平
  | 'l4'       // L4 第二曲线
  | 'l5'       // L5 情景推演
  | 'l6'       // L6 业绩兑现
  | 'l7'       // L7 筹码博弈
  | 'l8'       // L8 技术面

/** 标签类别 */
export type TagCategory =
  | 'topic'      // 主题标签
  | 'risk'       // 风险标签
  | 'catalyst'   // 催化标签
  | 'quality'    // 质量标签
  | 'custom'     // 自定义标签

/** 数据质量等级 */
export type DataQuality = 'low' | 'medium' | 'high'

// ============================================================
// 交叉引用
// ============================================================

export interface ProfileCrossReference {
  /** 目标资料 ID */
  targetId: string
  /** 目标资料类型 */
  targetType: ProfileItemType
  /** 关系类型 */
  relation: 'part_of' | 'references' | 'compares' | 'supports' | 'contradicts'
  /** 关系描述 */
  description?: string
}

// ============================================================
// 域元数据 — 颜色全部从 COLOR_SHADES 读取，禁止裸 hex
// ============================================================

export interface DomainMeta {
  domain: ProfileDomain
  name: string
  description: string
  color: string
  icon: string
  layers: ScoreLayerId[]
}

export const DOMAIN_META: Record<ProfileDomain, DomainMeta> = {
  D1: {
    domain: 'D1',
    name: '行业产业',
    description: '行业景气度、产业链、竞争格局、市场规模',
    color: COLOR_SHADES.blue.hex[500],
    icon: '🏭',
    layers: ['lMinus1', 'l0'],
  },
  D2: {
    domain: 'D2',
    name: '政策监管',
    description: '政策法规、监管动态、行业标准',
    color: COLOR_SHADES.purple.hex[500],
    icon: '📋',
    layers: ['l0'],
  },
  D3: {
    domain: 'D3',
    name: '公司基本面',
    description: '商业模式、护城河、主营业务、产能扩张',
    color: COLOR_SHADES.emerald.hex[500],
    icon: '🏢',
    layers: ['l1'],
  },
  D4: {
    domain: 'D4',
    name: '竞争对比',
    description: '竞品分析、市场份额、行业排名、龙头优势',
    color: COLOR_SHADES.amber.hex[500],
    icon: '⚔️',
    layers: ['l2'],
  },
  D5: {
    domain: 'D5',
    name: '财务分析',
    description: '财务报表、ROE、现金流、杜邦分析、分红',
    color: COLOR_SHADES.cyan.hex[500],
    icon: '📊',
    layers: ['l3f'],
  },
  D6: {
    domain: 'D6',
    name: '估值定价',
    description: 'PE/PB、目标价、评级、估值分位、一致预期',
    color: COLOR_SHADES.red.hex[500],
    icon: '💰',
    layers: ['l3v'],
  },
  D7: {
    domain: 'D7',
    name: '成长前沿',
    description: '第二曲线、新业务、情景推演、业绩兑现、Hype周期',
    color: COLOR_SHADES.pink.hex[500],
    icon: '🚀',
    layers: ['l4', 'l5', 'l6'],
  },
  D8: {
    domain: 'D8',
    name: '市场信号',
    description: '筹码博弈、技术面、资金流向、龙虎榜、量价',
    color: COLOR_SHADES.indigo.hex[500],
    icon: '📈',
    layers: ['l7', 'l8'],
  },
}

// ============================================================
// 资料条目
// ============================================================

/**
 * 资料条目（profile_items 表主键）
 *
 * 所有类型的资料统一存储在此表中，通过 itemType 区分类型，
 * 通过 domain 归属到八域，通过 relatedLayers 关联到评分层。
 */
export interface ProfileItem {
  /** 唯一 ID，格式：{symbol}_{domain}_{itemType}_{hash} */
  id: string
  /** 股票代码 */
  symbol: string
  /** 所属域 */
  domain: ProfileDomain
  /** 资料类型 */
  itemType: ProfileItemType
  /** 子类型（如研报子类型、公告子类型） */
  subType?: string
  /** 标题 */
  title: string
  /** 摘要/内容预览 */
  summary: string
  /** 完整内容（Markdown 或纯文本） */
  content?: string
  /** 作者/分析师 */
  author?: string
  /** 来源（如"东方财富"、"中信证券"、"雪球"） */
  source: string
  /** 原始 URL（如有） */
  sourceUrl?: string
  /** 发布时间戳（ms） */
  publishedAt: number
  /** 收录时间戳（ms） */
  collectedAt: number
  /** 情绪标签 */
  sentiment: SentimentLabel
  /** 情绪置信度（0-1） */
  sentimentConfidence?: number
  /** 质量评分（0-100） */
  qualityScore?: number
  /** 数据质量等级 */
  dataQuality?: DataQuality
  /** 证据权重（0-1），在对应层中的证据贡献度 */
  evidenceWeight?: number
  /** 关联的评分层（可多层） */
  relatedLayers: ScoreLayerId[]
  /** 主题标签（自动+手动） */
  topicTags?: string[]
  /** 风险标签 */
  riskTags?: string[]
  /** 催化标签 */
  catalystTags?: string[]
  /** 自定义标签 */
  customTags?: string[]
  /** 数据哈希（用于去重，FNV-1a 32位） */
  dataHash: number
  /** 原始数据 ID（如 newsId、postId、docId） */
  sourceId?: string
  /** 原始数据所在 store */
  originalStore?: string
  /** 原始数据 key */
  originalKey?: string
  /** 是否用户生成内容 */
  isUserGenerated?: boolean
  /** 交叉引用 */
  crossReferences?: ProfileCrossReference[]
  /** 阅读/浏览次数 */
  viewCount?: number
  /** 是否收藏 */
  isBookmarked?: boolean
  /** 关联的证据 ID（反向引用） */
  evidenceIds?: string[]
  /** 关键点/要点列表 */
  keyPoints?: string[]
  /** Schema 版本 */
  schemaVersion?: number
  /** 资料版本号 */
  version?: number
}

// ============================================================
// 评分证据
// ============================================================

/**
 * 评分证据（score_evidence 表）
 *
 * 每条证据对应评分模型中某一层的一个支撑点，
 * 关联到具体的资料条目或衍生指标，带有权重和置信度。
 */
export interface ScoreEvidence {
  /** 唯一 ID，格式：{symbol}_{layer}_{type}_{hash} */
  id: string
  /** 股票代码 */
  symbol: string
  /** 评分层 */
  layer: ScoreLayerId
  /** 证据类型 */
  evidenceType: EvidenceType
  /** 证据标题 */
  title: string
  /** 证据描述/推理过程 */
  description: string
  /** 证据权重（0-1），在该层中的贡献占比 */
  weight: number
  /** 置信度（0-1） */
  confidence: number
  /** 对评分的影响方向 */
  sentiment: SentimentLabel
  /** 关联的资料条目 ID */
  profileItemId?: string
  /** 关联的衍生指标 key */
  metricKey?: string
  /** 关联的衍生指标值 */
  metricValue?: number
  /** 来源描述 */
  source: string
  /** 创建时间戳（ms） */
  createdAt: number
  /** 评分版本号（对应 score_docs 的 version） */
  scoreVersion?: number
}

// ============================================================
// 股票资料包
// ============================================================

/**
 * 股票资料包元数据（stock_profiles 表）
 *
 * 每只股票一个资料包，记录资料的整体统计信息和状态。
 */
export interface StockProfile {
  /** 股票代码（主键） */
  symbol: string
  /** 股票名称 */
  stockName: string
  /** 资料总数 */
  totalItems: number
  /** 各域资料数量 */
  domainCounts: Record<ProfileDomain, number>
  /** 各类型资料数量 */
  typeCounts: Record<string, number>
  /** 证据总数 */
  totalEvidence: number
  /** 各层证据数量 */
  layerEvidenceCounts: Record<ScoreLayerId, number>
  /** 证据覆盖率（0-1），有证据的层数 / 总层数 */
  evidenceCoverage: number
  /** 最后更新时间戳（ms） */
  lastUpdatedAt: number
  /** 最后同步的资料来源 */
  lastSyncSources: string[]
  /** 质量平均分（0-100） */
  avgQualityScore?: number
  /** 自定义备注 */
  notes?: string
}

// ============================================================
// 资料标签
// ============================================================

/**
 * 资料标签（profile_tags 表）
 *
 * 全局标签库，支持层级结构和使用统计。
 */
export interface ProfileTag {
  /** 标签 ID（主键） */
  id: string
  /** 标签名称 */
  name: string
  /** 标签类别 */
  category: TagCategory
  /** 父标签 ID（支持层级） */
  parentId?: string
  /** 子标签 ID 列表 */
  childrenIds?: string[]
  /** 标签描述 */
  description?: string
  /** 标签颜色 */
  color?: string
  /** 使用次数 */
  usageCount: number
  /** 是否为系统内置标签 */
  isSystem: boolean
  /** 创建时间戳（ms） */
  createdAt: number
  /** 最后使用时间戳（ms） */
  lastUsedAt?: number
}

// ============================================================
// 辅助类型
// ============================================================

/** 资料查询筛选条件 */
export interface ProfileQueryFilter {
  symbol: string
  domain?: ProfileDomain
  itemType?: ProfileItemType
  sentiment?: SentimentLabel
  minQuality?: number
  source?: string
  keyword?: string
  limit?: number
  offset?: number
  sortBy?: 'publishedAt' | 'qualityScore' | 'collectedAt'
  sortOrder?: 'asc' | 'desc'
}

/** 同步选项 */
export interface SyncOptions {
  /** 是否跳过重复（基于 dataHash） */
  skipDuplicates?: boolean
  /** 最低质量分阈值 */
  minQuality?: number
  /** 是否自动打标 */
  autoTag?: boolean
  /** 是否触发证据链构建 */
  triggerEvidenceBuild?: boolean
}

/** 同步结果 */
export interface SyncResult {
  /** 成功保存的条目数 */
  saved: number
  /** 跳过的重复条目数 */
  skippedDuplicates: number
  /** 因质量低跳过的条目数 */
  skippedLowQuality: number
  /** 失败的条目数 */
  failed: number
  /** 失败详情 */
  failures?: Array<{ title: string; error: string }>
}
