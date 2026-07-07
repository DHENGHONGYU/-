// @module analysisNewsStore
// @lifecycle @Analysis
// 分析舱-智能资讯页面的全局状态管理（Zustand）。
// 从 analysis/NewsPage 组件内 4 个 useState 迁移至独立 Store。
//
// 管理范围：
// - 数据层：articles / loading
// - UI 层：filter / selectedArticle
//
// @migration 从 analysis/NewsPage.tsx 的 4 个 useState 迁移而来
import { create } from 'zustand'
import type { NewsArticle } from '@/data/types'
import type { NewsFilterState } from '@/types/modules/news.types'
import { listNews, saveNewsArticles } from '@/services/news/newsService'
import { generateMockArticles } from '@/services/news/newsService'
import {
  aggregateSentimentTrend,
  extractStockOptions,
  extractIndustryOptions,
} from '@/services/news/sentimentTrendEngine'
import type { SentimentTrendDimension, SentimentTrendSeries } from '@/types/modules/news.types'
import { getLogger } from '@/lib/logger'

const logger = getLogger()

export interface AnalysisNewsState {
  articles: NewsArticle[]
  loading: boolean
  filter: NewsFilterState
  selectedArticle: NewsArticle | null
  /** 情感趋势数据 */
  sentimentTrend: SentimentTrendSeries | null
  /** 股票选项列表 */
  sentimentStockOptions: string[]
  /** 行业选项列表 */
  sentimentIndustryOptions: string[]

  // Actions
  setArticles: (articles: NewsArticle[]) => void
  setLoading: (loading: boolean) => void
  setFilter: (filter: NewsFilterState) => void
  selectArticle: (article: NewsArticle | null) => void
  reset: () => void
  fetchArticles: () => Promise<void>
  // @compliance [DF-002] generateMockArticles 封装 Service 调用，组件通过 Store action 间接调用
  // 整改背景：原 NewsPage 直接 import Service 函数，现通过 Store action 中转
  // 相关规范：docs/implementation/data-flow-spec.md 第5.1节
  generateMockArticles: () => Promise<void>
  /** 计算情感趋势（封装 sentimentTrendEngine 的聚合与选项提取） */
  computeSentimentTrend: (dimension: SentimentTrendDimension, value?: string) => void
}

const DEFAULT_FILTER: NewsFilterState = {
  keyword: '',
  category: '',
  sentiment: '',
  source: '',
}

const initialState = {
  articles: [] as NewsArticle[],
  loading: false,
  filter: { ...DEFAULT_FILTER },
  selectedArticle: null as NewsArticle | null,
  sentimentTrend: null as SentimentTrendSeries | null,
  sentimentStockOptions: [] as string[],
  sentimentIndustryOptions: [] as string[],
}

export const useAnalysisNewsStore = create<AnalysisNewsState>((set, get) => ({
  ...initialState,

  setArticles: (articles) => set({ articles }),
  setLoading: (loading) => set({ loading }),
  setFilter: (filter) => set({ filter }),
  selectArticle: (article) => set({ selectedArticle: article }),

  reset: () => set(initialState),

  fetchArticles: async () => {
    const { filter } = get()
    set({ loading: true })
    try {
      const result = await listNews({
        keyword: filter.keyword || undefined,
        category: filter.category || undefined,
        sentiment: filter.sentiment || undefined,
        source: filter.source || undefined,
      })
      if (result.success && result.data) {
        set({ articles: result.data })
      }
    } finally {
      set({ loading: false })
    }
  },

  // @compliance [DF-002] generateMockArticles 封装 Service 调用
  // - 防重入锁：通过 loading 状态防止并发调用
  // - 日志追踪：logger.info 打印核心分支
  generateMockArticles: async () => {
    const { loading } = get()
    // @note 防重入锁
    if (loading) {
      logger.info('[analysisNewsStore] generateMockArticles skipped: loading=true')
      return
    }
    set({ loading: true })
    try {
      const mockArticles = generateMockArticles(5)
      const saveResult = await saveNewsArticles(mockArticles)
      if (saveResult.success) {
        logger.info('[analysisNewsStore] generateMockArticles: saved', {
          count: saveResult.data?.length ?? 0,
        })
        // 保存成功后刷新列表
        const { fetchArticles } = get()
        await fetchArticles()
        logger.info('[analysisNewsStore] generateMockArticles: refreshed list')
      } else {
        logger.info('[analysisNewsStore] generateMockArticles: save failed', {
          error: saveResult.error,
        })
      }
    } finally {
      set({ loading: false })
    }
  },

  computeSentimentTrend: (dimension, value) => {
    const { articles } = get()
    logger.info('[analysisNewsStore] computeSentimentTrend', { dimension, value, articleCount: articles.length })

    const stockOptions = extractStockOptions(articles)
    const industryOptions = extractIndustryOptions(articles)
    const trend = aggregateSentimentTrend(articles, {
      dimension,
      value: value || undefined,
      fillGaps: true,
    })

    set({
      sentimentTrend: trend,
      sentimentStockOptions: stockOptions,
      sentimentIndustryOptions: industryOptions,
    })
    logger.info('[analysisNewsStore] computeSentimentTrend 完成', {
      pointCount: trend.data.length,
      stockOptions: stockOptions.length,
      industryOptions: industryOptions.length,
    })
  },
}))
