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
