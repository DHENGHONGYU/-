/**
 * @fileoverview 维度 03-08 业务数据类型定义
 *
 * 将原本内联于 multiSourceFetcher.ts 的类型提取为独立模块，
 * 供 tushareAdapter.ts、crawlerProvider.ts 与 multiSourceFetcher.ts 共同引用，
 * 避免循环依赖。
  * @doc [V9-DOC-BACK-012, V9-DOC-BACK-033, V9-DOC-BACK-021, V9-DOC-QA-066, V9-DOC-BACK-023]
*/

/** 筹码数据（维度 03） */
export interface ChipData {
  /** 股东户数 */
  shareholderCount?: number
  /** 户均持股 */
  avgSharesPerHolder?: number
  /** 筹码集中度（0-100, 越高越集中） */
  concentration?: number
  /** 主力持仓比例 */
  institutionalHolding?: number
  /** 变化趋势：'increasing' | 'decreasing' | 'stable' */
  trend?: 'increasing' | 'decreasing' | 'stable'
  /** 数据日期 */
  date: string
  /** 数据来源标签（采集管线使用） */
  _source?: string
}

/** 重大事项/新闻（维度 04/05） */
export interface NewsItem {
  id: string
  title: string
  content: string
  source: string
  date: string
  category: 'announcement' | 'hot_news' | 'research'
  url?: string
  sentiment?: 'positive' | 'negative' | 'neutral'
  /** 数据来源标签（采集管线使用） */
  _source?: string
}

/** 行业竞品对比（维度 06） */
export interface CompetitorData {
  symbol: string
  name: string
  /** 市盈率 */
  pe?: number
  /** 市净率 */
  pb?: number
  /** 营收增长率 */
  revenueGrowth?: number
  /** 净利润增长率 */
  profitGrowth?: number
  /** 行业排名 */
  rank?: number
  /** 数据来源标签（采集管线使用） */
  _source?: string
}

/** 关联指数分析（维度 07） */
export interface IndexCorrelation {
  indexCode: string
  indexName: string
  /** 与标的的相关性系数 -1~1 */
  correlation: number
  /** 贝塔系数 */
  beta?: number
  /** 近一月贡献度 */
  contribution?: number
  /** 数据来源标签（采集管线使用） */
  _source?: string
}

/** 研报摘要（维度 08） */
export interface ResearchReport {
  id: string
  title: string
  author: string
  institution: string
  rating: string
  targetPrice?: number
  date: string
  summary: string
  /** 数据来源标签（采集管线使用） */
  _source?: string
}

/** 社区帖子（雪球/股吧等 UGC 内容，供 communitySyncService 归集到八域资料体系） */
export interface CommunityPost {
  /** 帖子唯一 ID */
  id: string
  /** 标题 */
  title: string
  /** 正文内容 */
  content?: string
  /** 来源平台标识（如 xueqiu / eastmoney） */
  source: string
  /** 原文链接 */
  url?: string
  /** 作者 */
  author?: string
  /** 发布日期（ISO 字符串） */
  date: string
  /** 关键点/要点列表 */
  keyPoints?: string[]
  /** 外部预评质量分（0-100） */
  qualityScore?: number
  /** 阅读数 */
  views?: number
  /** 评论数 */
  comments?: number
  /** 点赞数 */
  likes?: number
  /** 情绪标签 */
  sentiment?: 'positive' | 'negative' | 'neutral'
  /** 数据来源标签（采集管线使用） */
  _source?: string
}

// ── 维度 15 分红股本 ──

/** 分红记录（维度 15 分红股本） */
export interface DividendRecord {
  /** 除权除息日 */
  exDividendDate: string
  /** 每股派息（税前，元） */
  cashDividendPerShare: number
  /** 每股送股 */
  bonusShareRatio: number
  /** 每股转增 */
  transferShareRatio: number
  /** 股权登记日 */
  recordDate: string
  /** 分红实施公告日 */
  announceDate: string
  /** 分红方案说明 */
  planExplanation: string
  /** 数据来源标签 */
  _source?: string
}

/** 股本与分红摘要（维度 15 分红股本） */
export interface DividendShareSummary {
  /** 股票代码 */
  symbol: string
  /** 近 12 个月股息率（%） */
  dividendYield: number
  /** 近 3 年累计分红金额（亿元），缺失时标注 [MISSING] */
  totalDividend3Y: number
  /** 近 3 年分红率（%），缺失时标注 [MISSING] */
  payoutRatio3Y: number
  /** 历史分红记录（近 5 年） */
  history: DividendRecord[]
  /** 总股本（亿股） */
  totalShares: number
  /** 流通股本（亿股） */
  floatShares: number
  /** 限售股解禁：下一批解禁日期 */
  nextUnlockDate?: string
  /** 限售股解禁：下一批解禁数量（亿股） */
  nextUnlockShares?: number
  /** 是否有回购计划 */
  hasBuybackPlan: boolean
  /** 是否有增发计划 */
  hasRightsIssue: boolean
  /** 数据来源标签 */
  _source?: string
}

// ── 维度 16 一致预期与评级 ──

/** 一致预期数据（维度 16 一致预期与评级） */
export interface ConsensusEstimate {
  /** 预测年度 */
  fiscalYear: number
  /** 预测营收（亿元） */
  revenueEstimate: number
  /** 预测净利润（亿元） */
  netProfitEstimate: number
  /** 预测 EPS（元） */
  epsEstimate: number
  /** 分析师数量 */
  analystCount: number
  /** 预测最高 EPS */
  epsHigh: number
  /** 预测最低 EPS */
  epsLow: number
  /** 数据来源标签 */
  _source?: string
}

/** 评级汇总（维度 16 一致预期与评级） */
export interface RatingSummary {
  /** 买入评级数 */
  buyCount: number
  /** 增持评级数 */
  overweightCount: number
  /** 持有评级数 */
  holdCount: number
  /** 减持评级数 */
  underweightCount: number
  /** 卖出评级数 */
  sellCount: number
  /** 综合评级（1-5，1=强力买入，5=卖出） */
  consensusRating: number
  /** 综合目标价（元） */
  consensusTargetPrice: number
  /** 目标价最高值 */
  targetPriceHigh: number
  /** 目标价最低值 */
  targetPriceLow: number
  /** 最近评级变化趋势：'upgrade' | 'downgrade' | 'stable' */
  recentTrend: 'upgrade' | 'downgrade' | 'stable'
  /** 数据来源标签 */
  _source?: string
}

/** 一致预期与评级完整数据（维度 16） */
export interface ConsensusAndRating {
  symbol: string
  /** 未来 3 年一致预期 */
  estimates: ConsensusEstimate[]
  /** 评级汇总 */
  rating: RatingSummary
  /** 数据日期 */
  dataDate: string
  /** 数据来源标签 */
  _source?: string
}
