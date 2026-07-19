/**
 * @module news.types
 * @description 智能资讯模块类型定义（DA-008 情感趋势扩展）。
 * 所有情感聚合数据结构、维度枚举与配置选项均在此声明，
 * 供 Store、引擎、组件统一引用，禁止在 UI 层内联定义。
/** 情感趋势维度  * @doc [V9-DOC-QA-066]
*/
export type SentimentTrendDimension = 'global' | 'stock' | 'industry'

/** 情感类型（与 NewsArticle.sentiment 对齐） */
export type SentimentType = 'positive' | 'negative' | 'neutral'

/** 单日期情感分布数据点 */
export interface SentimentTrendPoint {
  /** 日期（ISO 8601，例如 2026-01-01） */
  date: string
  /** 正面资讯数量 */
  positive: number
  /** 负面资讯数量 */
  negative: number
  /** 中性资讯数量 */
  neutral: number
  /** 当日资讯总数 */
  total: number
  /** 正面占比（0~1） */
  positiveRatio: number
  /** 负面占比（0~1） */
  negativeRatio: number
  /** 中性占比（0~1） */
  neutralRatio: number
}

/** 情感趋势聚合结果 */
export interface SentimentTrendSeries {
  /** 维度类型 */
  dimension: SentimentTrendDimension
  /** 维度值（股票代码/行业分类/全局为空） */
  value: string
  /** 按日期排序的趋势点 */
  data: SentimentTrendPoint[]
  /** 统计摘要 */
  summary: {
    totalArticles: number
    positiveCount: number
    negativeCount: number
    neutralCount: number
    avgDailyArticles: number
  }
}

/** 情感趋势聚合选项 */
export interface SentimentTrendOptions {
  /** 聚合维度 */
  dimension: SentimentTrendDimension
  /** 维度筛选值（股票代码或行业分类），global 时可省略 */
  value?: string
  /** 起始日期（含） */
  startDate?: string
  /** 结束日期（含） */
  endDate?: string
  /** 是否填充无资讯的空日期 */
  fillGaps?: boolean
}

/** 资讯筛选状态（从 components/news/NewsFilterPanel 迁移） */
export interface NewsFilterState {
  keyword: string
  category: string
  sentiment: '' | 'positive' | 'negative' | 'neutral'
  source: string
}
