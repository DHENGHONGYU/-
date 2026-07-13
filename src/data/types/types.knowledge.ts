/**
 * @fileoverview 知识库/资讯域类型（L1 知识库业务域）
 *
 * V6 Pro 迁移：本地知识库 + 资讯与情感
 *
 * @module data/types/types.knowledge
 * @updated 2026-07-07 - PR-1：从 data/types.ts 拆分
/** 本地知识库文档 */
export interface LocalDoc {
  id: string
  symbol: string
  name: string
  content: string
  category: '研报' | '财报' | '行业分析' | '新闻' | '策略笔记' | '其他'
  tags: string[]
  sourcePath: string
  size: number
  addedAt: number
  /** 可选的嵌入向量（384维，由 localEmbeddingService 生成） */
  embedding?: number[]
  /** 数据来源标记（如：用户导入、Tushare、券商API、公开数据等） */
  source?: string
  /** 授权状态 */
  authorizationStatus?: 'authorized' | 'unauthorized' | 'pending' | 'public_domain'
}

/** 外部财经源抓取资讯 */
export interface NewsArticle {
  id: string
  title: string
  content: string
  url: string
  source: string
  category: string
  publishTime: string
  fetchTime: string
  sentiment: 'positive' | 'negative' | 'neutral'
  sentimentConfidence: number
  relatedStocks: string[]
  keywords: string[]
  hash: string
}

/** 股票-资讯多对多关联 */
export interface NewsStockMap {
  id: string // {symbol}_{newsId}
  symbol: string
  newsId: string
  relevanceScore: number
  isTitleMatch: boolean
  isContentMatch: boolean
  industryMatch: boolean
}

/** 情感分析缓存 */
export interface SentimentCache {
  id: string // sent_{contentHash}
  contentHash: string
  sentiment: 'positive' | 'negative' | 'neutral'
  confidence: number
  method: 'rule' | 'llm' | 'hybrid'
  analyzedAt: number
  llmModel?: string
}

/** 资讯收藏 */
export interface NewsBookmark {
  id: string
  bookmarkedAt: number
}
